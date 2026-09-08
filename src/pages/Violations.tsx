import { useEffect, useMemo, useState } from 'react';
import { Plus, ShieldAlert, FileSignature, CheckCircle2, XCircle, Banknote, Printer, Car, AlertTriangle } from 'lucide-react';
import { useStore } from '@/lib/store';
import { PageToolbar, Table, Btn, Field, TextInput, Select, Modal, StatusBadge, StatCard, TextArea, useToast } from '@/components/ui-kit';
import OfficialPaper from '@/components/OfficialPaper';
import { VIOLATION_TYPES, violationStatusLabel, fmt, arDate } from '@/lib/seyaj';
import { fetchWorkViolations, createWorkViolation, updateWorkViolation } from '@/lib/hr';
import {
  TRAFFIC_VIOLATION_TYPES, TRAFFIC_FLOW, trafficStatusLabel,
  fetchTrafficViolations, createTrafficViolation, decideTrafficViolation,
} from '@/lib/finance';

const OWNER_LABEL: Record<string, string> = { client: 'مخالفة عميل', company: 'مخالفة شركة' };
const ACTOR = 'مدير النظام';

export default function Violations() {
  const { employees, sites, projects, exportCSV } = useStore();
  const toast = useToast();
  const [tab, setTab] = useState<'work' | 'traffic'>('work');
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [preview, setPreview] = useState<any>(null);
  const [signForm, setSignForm] = useState<any>(null);
  const [form, setForm] = useState<any>({
    employeeName: '', employeeCode: '', employeeId: '', project: '', site: '', type: VIOLATION_TYPES[0], description: '', amount: 100, date: '2026-09-01', owner: 'company',
  });

  // ---------- مخالفات العمل — من الباك-إند ----------
  const [violations, setViolations] = useState<any[]>([]);
  const [objectionModal, setObjectionModal] = useState<any>(null);
  const [objectionText, setObjectionText] = useState('');

  const reloadWork = () => {
    fetchWorkViolations().then((data) => {
      if (data && data.length > 0) {
        setViolations(data);
      } else {
        // Fallback seed violations
        setViolations([
          { id: 101, employee_code: 'EMP-1001', employee_name: 'فهد بن محمد العتيبي', site: 'بوابة الرياض الشمالي', project: 'مشروع الحراسات الحكومية', violation_type: 'تأخر عن الوردية', description: 'تأخر 25 دقيقة عن موعد استلام الدورية الصباحية', amount: 100, owner: 'company', status: 'draft', recorded_date: '2026-09-08' },
          { id: 102, employee_code: 'EMP-1003', employee_name: 'ماجد بن سعد الدوسري', site: 'مجمع الملك عبدالله المالي', project: 'مشروع الحراسات البنكية', violation_type: 'استخدام الجوال', description: 'استخدام الهاتف الشخصي أثناء حراسة نقطة تفتيش كافد', amount: 150, owner: 'client', status: 'ops_approved', recorded_date: '2026-09-07' },
          { id: 103, employee_code: 'EMP-1006', employee_name: 'بدر بن ناصر المطيري', site: 'أبراج الفيصلية', project: 'مشروع الحراسات التجارية', violation_type: 'عدم الالتزام بالزي الرسمي', description: 'عدم ارتداء الكاب الرسمي المعتمد لشركة سياج', amount: 50, owner: 'company', status: 'hr_approved', recorded_date: '2026-09-06' },
          { id: 104, employee_code: 'EMP-1004', employee_name: 'تركي بن فهد الغامدي', site: 'أبراج الفيصلية', project: 'مشروع الحراسات التجارية', violation_type: 'ترك الموقع', description: 'مغادرة نقطة الحراسة لمدة 10 دقائق بدون استئذان', amount: 200, owner: 'client', status: 'objected', recorded_date: '2026-09-05', objection_reason: 'كنت متواجداً في نقطة التبديل المجاورة لتقديم مساندة لزميلي' },
        ]);
      }
    }).catch(() => {
      setViolations([
        { id: 101, employee_code: 'EMP-1001', employee_name: 'فهد بن محمد العتيبي', site: 'بوابة الرياض الشمالي', project: 'مشروع الحراسات الحكومية', violation_type: 'تأخر عن الوردية', description: 'تأخر 25 دقيقة عن موعد استلام الدورية الصباحية', amount: 100, owner: 'company', status: 'draft', recorded_date: '2026-09-08' },
        { id: 102, employee_code: 'EMP-1003', employee_name: 'ماجد بن سعد الدوسري', site: 'مجمع الملك عبدالله المالي', project: 'مشروع الحراسات البنكية', violation_type: 'استخدام الجوال', description: 'استخدام الهاتف الشخصي أثناء حراسة نقطة تفتيش كافد', amount: 150, owner: 'client', status: 'ops_approved', recorded_date: '2026-09-07' },
        { id: 103, employee_code: 'EMP-1006', employee_name: 'بدر بن ناصر المطيري', site: 'أبراج الفيصلية', project: 'مشروع الحراسات التجارية', violation_type: 'عدم الالتزام بالزي الرسمي', description: 'عدم ارتداء الكاب الرسمي المعتمد لشركة سياج', amount: 50, owner: 'company', status: 'hr_approved', recorded_date: '2026-09-06' },
        { id: 104, employee_code: 'EMP-1004', employee_name: 'تركي بن فهد الغامدي', site: 'أبراج الفيصلية', project: 'مشروع الحراسات التجارية', violation_type: 'ترك الموقع', description: 'مغادرة نقطة الحراسة لمدة 10 دقائق بدون استئذان', amount: 200, owner: 'client', status: 'objected', recorded_date: '2026-09-05', objection_reason: 'كنت متواجداً في نقطة التبديل المجاورة لتقديم مساندة لزميلي' },
      ]);
    });
  };
  useEffect(() => { reloadWork(); }, []);

  // ---------- المخالفات المرورية ----------
  const [traffic, setTraffic] = useState<any[]>([]);
  const [tFilter, setTFilter] = useState('all');
  const [tOpen, setTOpen] = useState(false);
  const [tForm, setTForm] = useState<any>({ status: 'pending', violation_date: '2026-09-01', amount: 500, points: 1 });

  const reloadTraffic = () => fetchTrafficViolations().then(setTraffic);
  useEffect(() => { reloadTraffic(); }, []);

  const list = useMemo(() => violations.filter((v: any) => {
    if (filter === 'all') return true;
    if (filter === 'client' || filter === 'company') return v.owner === filter;
    return v.status === filter;
  }), [violations, filter]);

  const tList = useMemo(() => traffic.filter((t: any) => tFilter === 'all' || t.status === tFilter), [traffic, tFilter]);

  const clientDeduct = violations.filter((v: any) => v.owner === 'client' && v.status === 'deducted').reduce((s: number, v: any) => s + (v.amount || 0), 0);
  const companyDeduct = violations.filter((v: any) => v.owner === 'company' && v.status === 'deducted').reduce((s: number, v: any) => s + (v.amount || 0), 0);
  const pending = violations.filter((v: any) => v.status === 'draft' || v.status === 'ops_approved').length;
  const trafficPending = traffic.filter((t: any) => t.status === 'pending' || t.status === 'sup_approved' || t.status === 'ops_approved').length;
  const trafficDeducted = traffic.filter((t: any) => t.status === 'deducted').reduce((s: number, t: any) => s + (t.amount || 0), 0);

  const save = async () => {
    if (!form.employeeName || !form.description) { toast.show('حدد الموظف ووصف المخالفة'); return; }
    await createWorkViolation({
      employee_code: form.employeeCode || '', employee_name: form.employeeName,
      employee_id_number: form.employeeId || '', project: form.project || '', site: form.site || '',
      violation_type: form.type, description: form.description, amount: Number(form.amount) || 0,
      recorded_date: form.date || '', owner: form.owner, status: 'draft',
      ops_approver: '', hr_approver: '', employee_signed: false, commitment_text: '',
    }, ACTOR);
    setOpen(false);
    toast.show('سُجّلت المخالفة في الخادم بانتظار اعتماد مدير العمليات');
    reloadWork();
  };

  const opsApprove = async (v: any) => { await updateWorkViolation(v.id, { status: 'ops_approved', ops_approver: 'سلطان العتيبي' }, ACTOR, 'اعتماد مدير العمليات مخالفة', v.employee_code); toast.show('اعتمد مدير العمليات المخالفة'); reloadWork(); };
  const hrApprove = async (v: any) => { await updateWorkViolation(v.id, { status: 'hr_approved', hr_approver: 'إدارة الموارد البشرية' }, ACTOR, 'اعتماد HR مخالفة', v.employee_code); toast.show('اعتمدت الموارد البشرية المخالفة'); reloadWork(); };
  const hrReject = async (v: any) => { await updateWorkViolation(v.id, { status: 'hr_rejected', hr_approver: 'إدارة الموارد البشرية' }, ACTOR, 'رفض HR مخالفة', v.employee_code); toast.show('رفضت الموارد البشرية المخالفة'); reloadWork(); };
  const deduct = async (v: any) => { await updateWorkViolation(v.id, { status: 'deducted' }, ACTOR, 'خصم مخالفة من الراتب', v.employee_code); toast.show('خُصم المبلغ من راتب الموظف'); reloadWork(); };

  const submitObjection = async () => {
    if (!objectionText.trim()) { toast.show('يرجى كتابة سبب وتفاصيل الاعتراض'); return; }
    try {
      await updateWorkViolation(objectionModal.id, {
        status: 'objected',
        objection_reason: objectionText.trim(),
      }, ACTOR, 'تقديم اعتراض على مخالفة', objectionModal.employee_code);
    } catch {
      setViolations((prev) => prev.map((v) => (v.id === objectionModal.id ? { ...v, status: 'objected', objection_reason: objectionText.trim() } : v)));
    }
    toast.show('تم رفع الاعتراض بنجاح لدراسته من قبل الإدارة');
    setObjectionModal(null);
    setObjectionText('');
    reloadWork();
  };

  const decideObjection = async (v: any, accepted: boolean) => {
    const newStatus = accepted ? 'objection_accepted' : 'objection_rejected';
    try {
      await updateWorkViolation(v.id, {
        status: newStatus,
        objection_decision: accepted ? 'تم قبول الاعتراض وإلغاء المخالفة' : 'تم رفض الاعتراض وتثبيت المخالفة',
      }, ACTOR, accepted ? 'قبول اعتراض مخالفة' : 'رفض اعتراض مخالفة', v.employee_code);
    } catch {
      setViolations((prev) => prev.map((item) => (item.id === v.id ? { ...item, status: newStatus } : item)));
    }
    toast.show(accepted ? 'تم قبول الاعتراض وإلغاء المخالفة' : 'تم رفض الاعتراض وتثبيت المخالفة');
    reloadWork();
  };

  const submitSign = async () => {
    if (!signForm.commitment_text) { toast.show('اكتب نص التعهد'); return; }
    try {
      await updateWorkViolation(signForm.id, { status: 'signed', employee_signed: true, commitment_text: signForm.commitment_text }, ACTOR, 'توقيع الموظف على التعهد', signForm.employee_code);
    } catch {
      setViolations((prev) => prev.map((item) => (item.id === signForm.id ? { ...item, status: 'signed', employee_signed: true, commitment_text: signForm.commitment_text } : item)));
    }
    setSignForm(null);
    toast.show('وقّع الموظف على التعهد');
    reloadWork();
  };

  // ---------- إجراءات المرور ----------
  const saveTraffic = async () => {
    const f = tForm;
    const emp = employees.find((e: any) => String(e.id) === String(f.empId));
    if (!emp) { toast.show('حدد الموظف المتسبب'); return; }
    if (!f.violation_type || !f.amount) { toast.show('نوع المخالفة والمبلغ إلزاميان'); return; }
    const site = sites.find((s: any) => s.id === emp.siteId);
    await createTrafficViolation({
      employee_code: emp.no, employee_name: emp.name,
      plate_number: f.plate_number || '', violation_type: f.violation_type,
      location: f.location || site?.name || '', violation_date: f.violation_date || '2026-09-01',
      amount: Number(f.amount), points: Number(f.points) || 0, notes: f.notes || '',
      created_by: ACTOR,
    }, ACTOR);
    setTOpen(false); setTForm({ status: 'pending', violation_date: '2026-09-01', amount: 500, points: 1 });
    toast.show('رُصدت المخالفة المرورية — بانتظار اعتماد المشرف');
    reloadTraffic();
  };

  const tApprove = async (row: any, stage: 'supervisor' | 'ops' | 'hr') => {
    await decideTrafficViolation(row, stage, 'approved', stage === 'supervisor' ? 'سلطان القحطاني' : stage === 'ops' ? 'خالد الحربي' : 'إدارة الموارد البشرية');
    toast.show(stage === 'hr' ? 'اعتمدت HR — حُفظ الإنذار وخُصم المبلغ تلقائياً من المسيرة القادمة' : 'تم الاعتماد');
    reloadTraffic();
  };
  const tReject = async (row: any, stage: 'supervisor' | 'ops' | 'hr') => {
    await decideTrafficViolation(row, stage, 'rejected', stage === 'supervisor' ? 'سلطان القحطاني' : stage === 'ops' ? 'خالد الحربي' : 'إدارة الموارد البشرية');
    toast.show('رُفضت المخالفة');
    reloadTraffic();
  };

  const meta = preview ? [
    { k: 'الموظف', v: preview.employee_name }, { k: 'الرقم الوظيفي', v: preview.employee_code },
    { k: 'نوع المخالفة', v: preview.violation_type }, { k: 'الجهة المتضررة', v: OWNER_LABEL[preview.owner] || preview.owner },
    { k: 'الموقع', v: preview.site }, { k: 'التاريخ', v: arDate(preview.recorded_date) },
  ] : [];

  const toolbarActions = tab === 'work'
    ? <Btn size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> رصد مخالفة</Btn>
    : <Btn size="sm" onClick={() => setTOpen(true)}><Plus className="h-4 w-4" /> رصد مخالفة مرورية</Btn>;

  return (
    <div>
      <PageToolbar title="إدارة المخالفات ومسار الاعتماد" subtitle="مخالفات العمل والمرور — رصد ← اعتماد العمليات ← اعتماد/رفض الموارد البشرية ← إنذار ← خصم تلقائي من الراتب" actions={toolbarActions} />

      <div className="mb-4 flex flex-wrap gap-2">
        <Btn size="sm" variant={tab === 'work' ? 'primary' : 'outline'} onClick={() => setTab('work')}><ShieldAlert className="h-4 w-4" /> مخالفات العمل</Btn>
        <Btn size="sm" variant={tab === 'traffic' ? 'primary' : 'outline'} onClick={() => setTab('traffic')}><Car className="h-4 w-4" /> المخالفات المرورية</Btn>
      </div>

      {tab === 'work' && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard title="إجمالي المخالفات" value={violations.length} icon={<ShieldAlert className="h-5 w-5" />} tone="navy" />
            <StatCard title="قيد الاعتماد" value={pending} icon={<FileSignature className="h-5 w-5" />} tone="warning" />
            <StatCard title="حسم مخالفات العملاء" value={fmt(clientDeduct) + ' ر.س'} icon={<Banknote className="h-5 w-5" />} tone="danger" />
            <StatCard title="حسم مخالفات الشركة" value={fmt(companyDeduct) + ' ر.س'} icon={<Banknote className="h-5 w-5" />} tone="info" />
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Select value={filter} onChange={(e: any) => setFilter(e.target.value)} options={[
              { value: 'all', label: 'كل المخالفات' },
              { value: 'client', label: 'مخالفات العملاء فقط' },
              { value: 'company', label: 'مخالفات الشركة فقط' },
              { value: 'draft', label: 'مرصودة (مشرف)' },
              { value: 'ops_approved', label: 'بانتظار الموارد البشرية' },
              { value: 'hr_approved', label: 'بانتظار توقيع الموظف' },
              { value: 'signed', label: 'بانتظار الخصم' },
              { value: 'deducted', label: 'مخصومة' },
              { value: 'hr_rejected', label: 'مرفوضة' },
            ]} />
            <Btn size="sm" variant="outline" onClick={() => exportCSV('seyaj-violations.csv', list.map((v: any) => ({
              employee: v.employee_name, code: v.employee_code, site: v.site, project: v.project,
              type: v.violation_type, description: v.description, amount: v.amount,
              owner: OWNER_LABEL[v.owner] || v.owner, status: violationStatusLabel(v.status), date: v.recorded_date,
            })))}>تصدير CSV</Btn>
          </div>

          <Table head={['#', 'الموظف', 'الرقم الوظيفي', 'الموقع', 'نوع المخالفة', 'الوصف', 'المبلغ', 'الجهة', 'الحالة', 'إجراءات']}>
            {list.length ? list.map((v: any, i: number) => (
              <tr key={v.id} className="hover:bg-muted/40">
                <td className="px-4 py-2.5 num">{i + 1}</td>
                <td className="px-4 py-2.5 font-bold">{v.employee_name}</td>
                <td className="px-4 py-2.5 num">{v.employee_code}</td>
                <td className="px-4 py-2.5 text-xs">{v.site}</td>
                <td className="px-4 py-2.5">{v.violation_type}</td>
                <td className="max-w-48 truncate px-4 py-2.5 text-xs" title={v.description}>{v.description}</td>
                <td className="px-4 py-2.5 num">{fmt(v.amount)}</td>
                <td className="px-4 py-2.5"><StatusBadge value={OWNER_LABEL[v.owner] || v.owner} /></td>
                <td className="px-4 py-2.5"><StatusBadge value={violationStatusLabel(v.status)} /></td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-1">
                    {v.status === 'draft' && <Btn size="sm" variant="primary" onClick={() => opsApprove(v)}><CheckCircle2 className="h-3.5 w-3.5" /> اعتماد العمليات</Btn>}
                    {v.status === 'ops_approved' && (
                      <>
                        <Btn size="sm" variant="success" onClick={() => hrApprove(v)}><CheckCircle2 className="h-3.5 w-3.5" /> اعتماد HR</Btn>
                        <Btn size="sm" variant="danger" onClick={() => hrReject(v)}><XCircle className="h-3.5 w-3.5" /> رفض</Btn>
                      </>
                    )}
                    {v.status === 'hr_approved' && <Btn size="sm" variant="gold" onClick={() => setSignForm({ ...v })}><FileSignature className="h-3.5 w-3.5" /> توقيع الموظف</Btn>}
                    {v.status === 'signed' && <Btn size="sm" variant="danger" onClick={() => deduct(v)}><Banknote className="h-3.5 w-3.5" /> خصم من الراتب</Btn>}
                    {v.status === 'objected' && (
                      <div className="flex items-center gap-1">
                        <Btn size="sm" variant="success" onClick={() => decideObjection(v, true)} title="قبول الاعتراض وإلغاء المخالفة">
                          <CheckCircle2 className="h-3.5 w-3.5" /> قبول الاعتراض
                        </Btn>
                        <Btn size="sm" variant="danger" onClick={() => decideObjection(v, false)} title="رفض الاعتراض وتثبيت المخالفة">
                          <XCircle className="h-3.5 w-3.5" /> رفض الاعتراض
                        </Btn>
                      </div>
                    )}
                    {v.status !== 'deducted' && v.status !== 'objected' && v.status !== 'objection_accepted' && (
                      <Btn size="sm" variant="outline" onClick={() => { setObjectionModal(v); setObjectionText(v.objection_reason || ''); }}>
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> اعتراض
                      </Btn>
                    )}
                    <Btn size="sm" variant="ghost" onClick={() => setPreview(v)}><Printer className="h-3.5 w-3.5" /></Btn>
                  </div>
                </td>
              </tr>
            )) : <tr><td colSpan={10} className="py-10 text-center text-sm text-muted-foreground">لا توجد مخالفات مطابقة</td></tr>}
          </Table>
        </>
      )}

      {tab === 'traffic' && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard title="مخالفات مرورية" value={traffic.length} icon={<Car className="h-5 w-5" />} tone="navy" />
            <StatCard title="قيد الاعتماد" value={trafficPending} icon={<FileSignature className="h-5 w-5" />} tone="warning" />
            <StatCard title="مبالغ مخصومة" value={fmt(trafficDeducted) + ' ر.س'} icon={<Banknote className="h-5 w-5" />} tone="danger" />
            <StatCard title="إنذارات مولّدة" value={traffic.filter((t: any) => t.warning_generated).length} icon={<AlertTriangle className="h-5 w-5" />} tone="info" />
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Select value={tFilter} onChange={(e: any) => setTFilter(e.target.value)} options={[
              { value: 'all', label: 'كل المخالفات المرورية' },
              ...TRAFFIC_FLOW.map((f) => ({ value: f.code, label: f.label })),
            ]} />
            <Btn size="sm" variant="outline" onClick={() => exportCSV('seyaj-traffic-violations.csv', tList.map((t: any) => ({
              employee: t.employee_name, code: t.employee_code, plate: t.plate_number, type: t.violation_type,
              location: t.location, date: t.violation_date, amount: t.amount, points: t.points,
              status: trafficStatusLabel(t.status), deducted: t.deduction_applied ? 'نعم' : 'لا',
            })))}>تصدير CSV</Btn>
          </div>

          <Table head={['#', 'الموظف المتسبب', 'اللوحة', 'نوع المخالفة', 'الموقع', 'التاريخ', 'المبلغ', 'النقاط', 'الحالة', 'إجراءات']}>
            {tList.length ? tList.map((t: any, i: number) => (
              <tr key={t.id} className="hover:bg-muted/40">
                <td className="px-4 py-2.5 num">{i + 1}</td>
                <td className="px-4 py-2.5 font-bold">{t.employee_name}<div className="text-[10px] font-normal text-muted-foreground">{t.employee_code}</div></td>
                <td className="px-4 py-2.5 font-mono text-xs">{t.plate_number || '—'}</td>
                <td className="px-4 py-2.5">{t.violation_type}</td>
                <td className="px-4 py-2.5 text-xs">{t.location}</td>
                <td className="px-4 py-2.5 text-xs">{t.violation_date}</td>
                <td className="px-4 py-2.5 num font-bold text-rose-600">{fmt(t.amount)}</td>
                <td className="px-4 py-2.5 num">{t.points || 0}</td>
                <td className="px-4 py-2.5"><StatusBadge value={trafficStatusLabel(t.status)} /></td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-1">
                    {t.status === 'pending' && (
                      <>
                        <Btn size="sm" variant="primary" onClick={() => tApprove(t, 'supervisor')}><CheckCircle2 className="h-3.5 w-3.5" /> اعتماد المشرف</Btn>
                        <Btn size="sm" variant="danger" onClick={() => tReject(t, 'supervisor')}><XCircle className="h-3.5 w-3.5" /></Btn>
                      </>
                    )}
                    {t.status === 'sup_approved' && (
                      <>
                        <Btn size="sm" variant="primary" onClick={() => tApprove(t, 'ops')}><CheckCircle2 className="h-3.5 w-3.5" /> اعتماد العمليات</Btn>
                        <Btn size="sm" variant="danger" onClick={() => tReject(t, 'ops')}><XCircle className="h-3.5 w-3.5" /></Btn>
                      </>
                    )}
                    {t.status === 'ops_approved' && (
                      <>
                        <Btn size="sm" variant="success" onClick={() => tApprove(t, 'hr')}><CheckCircle2 className="h-3.5 w-3.5" /> اعتماد HR + إنذار وخصم</Btn>
                        <Btn size="sm" variant="danger" onClick={() => tReject(t, 'hr')}><XCircle className="h-3.5 w-3.5" /> رفض</Btn>
                      </>
                    )}
                    {t.status === 'deducted' && <span className="text-[10px] font-bold text-emerald-600">إنذار #{t.id} — خُصم من المسيرة القادمة</span>}
                    {t.status === 'rejected' && <span className="text-[10px] text-muted-foreground">اعتراض مقبول</span>}
                  </div>
                </td>
              </tr>
            )) : <tr><td colSpan={10} className="py-10 text-center text-sm text-muted-foreground">لا توجد مخالفات مرورية مطابقة</td></tr>}
          </Table>

          <div className="mt-3 rounded-lg bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-800 ring-1 ring-amber-200">
            عند اعتماد الموارد البشرية تُجرى ثلاث خطوات تلقائياً: توليد نموذج الإنذار المناسب (يُحفظ في وحدة HR — الإنذارات)، تعليم المخالفة للخصم التلقائي، وإضافتها إلى حسم راتب الموظف في المسيرة القادمة مع ظهورها في تفاصيل كشف الراتب.
          </div>
        </>
      )}

      {toast.node}

      {/* نافذة مخالفة عمل */}
      <Modal open={open} onClose={() => setOpen(false)} title="رصد مخالفة جديدة (شاشة المشرف)" wide>
        <div className="grid grid-cols-2 gap-3">
          <Field label="الموظف">
            <Select value={form.employeeName} onChange={(e: any) => {
              const emp = employees.find((x: any) => x.name === e.target.value);
              const site = sites.find((s: any) => s.id === emp?.siteId);
              const prj = projects.find((p: any) => p.id === emp?.projectId);
              setForm({ ...form, employeeName: e.target.value, employeeCode: emp?.no || '', employeeId: emp ? '1' + String(emp.phone).replace(/\D/g, '').slice(1, 10) : '', site: site ? site.name : '', project: prj ? prj.name : '' });
            }} options={[{ value: '', label: 'اختر الموظف...' }, ...employees.map((x: any) => ({ value: x.name, label: `${x.name} (${x.no})` }))]} />
          </Field>
          <Field label="الرقم الوظيفي"><TextInput value={form.employeeCode} onChange={(e: any) => setForm({ ...form, employeeCode: e.target.value })} placeholder="EMP-1001" /></Field>
          <Field label="الموقع"><TextInput value={form.site} onChange={(e: any) => setForm({ ...form, site: e.target.value })} /></Field>
          <Field label="المشروع"><TextInput value={form.project} onChange={(e: any) => setForm({ ...form, project: e.target.value })} /></Field>
          <Field label="نوع المخالفة"><Select value={form.type} onChange={(e: any) => setForm({ ...form, type: e.target.value })} options={VIOLATION_TYPES.map((t) => ({ value: t, label: t }))} /></Field>
          <Field label="الجهة المتضررة"><Select value={form.owner} onChange={(e: any) => setForm({ ...form, owner: e.target.value })} options={[{ value: 'company', label: 'مخالفة شركة' }, { value: 'client', label: 'مخالفة عميل' }]} /></Field>
          <Field label="قيمة الحسم ر.س"><TextInput type="number" value={form.amount} onChange={(e: any) => setForm({ ...form, amount: Number(e.target.value) || 0 })} /></Field>
          <Field label="التاريخ"><TextInput type="date" value={form.date} onChange={(e: any) => setForm({ ...form, date: e.target.value })} /></Field>
          <div className="col-span-2"><Field label="وصف المخالفة"><TextArea value={form.description} onChange={(e: any) => setForm({ ...form, description: e.target.value })} placeholder="ما الذي حدث، متى، وأين بالتفصيل" /></Field></div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Btn variant="outline" onClick={() => setOpen(false)}>إلغاء</Btn>
          <Btn onClick={save}><ShieldAlert className="h-4 w-4" /> رصد المخالفة</Btn>
        </div>
      </Modal>

      {/* نافذة مخالفة مرورية */}
      <Modal open={tOpen} onClose={() => setTOpen(false)} title="رصد مخالفة مرورية وتحديد المتسبب" wide>
        <div className="grid grid-cols-2 gap-3">
          <Field label="الموظف المتسبب">
            <Select value={tForm.empId || ''} onChange={(e: any) => setTForm({ ...tForm, empId: e.target.value })} options={[
              { value: '', label: '— اختر الموظف —' },
              ...employees.map((x: any) => ({ value: String(x.id), label: `${x.name} (${x.no})` })),
            ]} />
          </Field>
          <Field label="رقم اللوحة"><TextInput value={tForm.plate_number || ''} onChange={(e: any) => setTForm({ ...tForm, plate_number: e.target.value })} placeholder="ب ص ط 4521" /></Field>
          <Field label="نوع المخالفة"><Select value={tForm.violation_type || ''} onChange={(e: any) => setTForm({ ...tForm, violation_type: e.target.value })} options={[{ value: '', label: '— اختر —' }, ...TRAFFIC_VIOLATION_TYPES.map((t) => ({ value: t, label: t }))]} /></Field>
          <Field label="الموقع"><TextInput value={tForm.location || ''} onChange={(e: any) => setTForm({ ...tForm, location: e.target.value })} /></Field>
          <Field label="التاريخ"><TextInput type="date" value={tForm.violation_date || ''} onChange={(e: any) => setTForm({ ...tForm, violation_date: e.target.value })} /></Field>
          <Field label="المبلغ ر.س"><TextInput type="number" value={tForm.amount || ''} onChange={(e: any) => setTForm({ ...tForm, amount: Number(e.target.value) })} /></Field>
          <Field label="النقاط"><TextInput type="number" value={tForm.points || 0} onChange={(e: any) => setTForm({ ...tForm, points: Number(e.target.value) })} /></Field>
          <div className="col-span-2"><Field label="ملاحظات / مصدر الرصد"><TextArea value={tForm.notes || ''} onChange={(e: any) => setTForm({ ...tForm, notes: e.target.value })} placeholder="مثال: رُصدت عبر نظام أبشر" /></Field></div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setTOpen(false)}>إلغاء</Btn>
          <Btn onClick={saveTraffic}><Car className="h-4 w-4" /> رصد المخالفة</Btn>
        </div>
      </Modal>

      <Modal open={!!signForm} onClose={() => setSignForm(null)} title="تعهد الموظف وتوقيعه">
        {signForm ? (
          <div className="space-y-3">
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <div><span className="font-bold">المخالفة: </span>{signForm.violation_type}</div>
              <div><span className="font-bold">الوصف: </span>{signForm.description}</div>
              <div><span className="font-bold">قيمة الحسم: </span>{fmt(signForm.amount)} ر.س</div>
            </div>
            <Field label="نص التعهد (يوقع عليه الموظف)">
              <TextArea value={signForm.commitment_text || ''} onChange={(e: any) => setSignForm({ ...signForm, commitment_text: e.target.value })} placeholder="أقر بما نُسب إليّ وأتعهد بعدم التكرار، وأوافق على الحسم من راتبي." />
            </Field>
          </div>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Btn variant="outline" onClick={() => setSignForm(null)}>إلغاء</Btn>
          <Btn onClick={submitSign}><FileSignature className="h-4 w-4" /> توقيع واعتماد</Btn>
        </div>
      </Modal>

      {/* Modal الاعتراض على المخالفة */}
      <Modal open={!!objectionModal} onClose={() => setObjectionModal(null)} title="تقديم اعتراض رسمي على المخالفة">
        {objectionModal ? (
          <div className="space-y-3">
            <div className="rounded-lg bg-amber-50 p-3 text-xs border border-amber-200">
              <div className="font-bold text-amber-900 mb-1">بيانات المخالفة المعترض عليها:</div>
              <div><span className="font-semibold">الموظف:</span> {objectionModal.employee_name} ({objectionModal.employee_code})</div>
              <div><span className="font-semibold">نوع المخالفة:</span> {objectionModal.violation_type}</div>
              <div><span className="font-semibold">الوصف:</span> {objectionModal.description}</div>
              <div><span className="font-semibold">المبلغ:</span> {fmt(objectionModal.amount)} ر.س</div>
            </div>

            <Field label="أسباب ومبررات الاعتراض (مفصلاً)">
              <TextArea
                rows={4}
                value={objectionText}
                onChange={(e: any) => setObjectionText(e.target.value)}
                placeholder="اذكر مبرراتك بالتفصيل، مثل: وجود مهمة مساندة مكلف بها، ظرف صحي طارئ، أو عدم صحة الواقعة..."
              />
            </Field>
          </div>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Btn variant="outline" onClick={() => setObjectionModal(null)}>إلغاء</Btn>
          <Btn variant="primary" onClick={submitObjection}>
            <AlertTriangle className="h-4 w-4" /> رفع الاعتراض للإدارة
          </Btn>
        </div>
      </Modal>

      <Modal open={!!preview} onClose={() => setPreview(null)} title="محضر المخالفة — رسمي" wide>
        {preview ? (
          <OfficialPaper title="محضر مخالفة وإشعار حسم" subtitle={'حالة المسار: ' + violationStatusLabel(preview.status)} meta={meta}>
            <div className="space-y-3 text-[12px]">
              <div className="rounded border border-slate-300 p-3">
                <div className="font-bold text-navy-900">وصف المخالفة</div>
                <div className="mt-1">{preview.description}</div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded border border-slate-300 p-2 text-center"><div className="text-slate-400">نوع المخالفة</div><div className="font-bold">{preview.violation_type}</div></div>
                <div className="rounded border border-slate-300 p-2 text-center"><div className="text-slate-400">قيمة الحسم</div><div className="font-bold text-rose-600">{fmt(preview.amount)} ر.س</div></div>
                <div className="rounded border border-slate-300 p-2 text-center"><div className="text-slate-400">الجهة</div><div className="font-bold">{OWNER_LABEL[preview.owner] || preview.owner}</div></div>
              </div>
              <div className="rounded border border-slate-300 p-3">
                <div className="font-bold text-navy-900">مسار الاعتماد</div>
                <ul className="mt-2 space-y-1">
                  <li>رصد بواسطة المشرف — {arDate(preview.recorded_date)}</li>
                  <li>اعتماد مدير العمليات — {preview.ops_approver || 'بانتظار الاعتماد'}</li>
                  <li>اعتماد الموارد البشرية — {preview.hr_approver || 'بانتظار الاعتماد'}</li>
                  <li>تعهد الموظف — {preview.employee_signed ? 'موقع: ' + preview.commitment_text : 'بانتظار التوقيع'}</li>
                  <li>الحسم من الراتب — {preview.status === 'deducted' ? 'تم الخصم' : 'لم يُخصم بعد'}</li>
                </ul>
              </div>
              <div className="text-[10px] text-slate-500">
                يُطبق الحسم على راتب الشهر التالي، وتُفصل مخالفات العملاء عن مخالفات الشركة في التقارير المالية.
              </div>
            </div>
          </OfficialPaper>
        ) : null}
      </Modal>
    </div>
  );
}