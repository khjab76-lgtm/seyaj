// لوحة الموظف الشاملة — وحدة الموارد البشرية «سياج»
// ملف الموظف هو المركز الرئيسي لكل بياناته — 18 تبويبًا كلها مرتبطة برقم الموظف employee_code
// كل سجل/مستند يُنشأ من أي وحدة يظهر تلقائيًا داخل التبويب المناسب عبر الترشيح الخادمي بالرقم.
import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '@/lib/store';
import {
  PageToolbar, StatCard, Table, Modal, Field, TextInput, TextArea, Select, Btn,
  EmptyRow, StatusBadge, useToast,
} from '@/components/ui-kit';
import {
  Users, FileText, Plus, Trash2, AlertTriangle, Bell, Printer, X,
  Wallet, CalendarClock, ScanText, Lock,
} from 'lucide-react';
import { fetchPayrollByCode } from '@/lib/excelImportData';
import {
  fetchHrDocs, saveHrDoc, updateHrDoc, deleteHrDoc, fetchBankAccounts, fetchEvents, addEvent,
  fetchLeaves, fetchBalances, balanceRemaining, fetchWarnings, expiryStatus,
  empKindOf, todayISO, EVENT_TYPES, DOC_TYPES, uploadDoc,
  fetchMasterByCode, fetchAssignmentsByCode, fetchAttendanceByCode,
  fetchQualificationsByCode, fetchWorkViolationsByCode, fetchTrafficViolationsByCode,
  fetchVisitsByCode, fetchSupportByCode, fetchLettersByCode, fetchAuditByCode,
  QUAL_TYPES, addQualification, deleteQualification,
} from '@/lib/hr';
import { salaryOf, clientOf, violationStatusLabel } from '@/lib/seyaj';
import { trafficStatusLabel } from '@/lib/finance';
import { HR_PAPERS, DocEditForm } from '@/components/HrPapers';
import { fetchApplicationsForEmployee, getFileUrl } from '@/lib/recruitment';
import { getMe } from '@/lib/backend';
import ProfileExtraTabs from '@/pages/hr/ProfileExtraTabs';
import OcrReviewModal from '@/pages/hr/OcrReviewModal';

const ATTACH_TYPES = ['هوية', 'إقامة', 'شهادة تدريب', 'عقد', 'مرفق آخر'];
const LETTER_TYPES = DOC_TYPES.filter((t) => !ATTACH_TYPES.includes(t));

const TABS = [
  { key: 'basic', label: 'البيانات الأساسية' },
  { key: 'work', label: 'البيانات الوظيفية' },
  { key: 'finance', label: 'البيانات المالية' },
  { key: 'bank', label: 'بيانات البنك' },
  { key: 'quals', label: 'المؤهلات والخبرات' },
  { key: 'attendance', label: 'الحضور والانصراف' },
  { key: 'timesheet', label: 'التايم شيت' },
  { key: 'payroll', label: 'الرواتب' },
  { key: 'leaves', label: 'الإجازات' },
  { key: 'issues', label: 'الجزاءات والمخالفات' },
  { key: 'support', label: 'المباشرات' },
  { key: 'transfer', label: 'خطابات التحويل' },
  { key: 'confirm', label: 'خطابات التثبيت' },
  { key: 'letters', label: 'الخطابات الأخرى' },
  { key: 'visits', label: 'زيارات المشرفين' },
  { key: 'recruit', label: 'طلب التوظيف' },
  { key: 'docs', label: 'المرفقات' },
  { key: 'audit', label: 'سجل التعديلات' },
] as const;
type TabKey = typeof TABS[number]['key'];

export default function HrEmployees() {
  const { employees, projects, sites, zones, attendance, violations, insurance, fieldVisits, supportMovements } = useStore();
  const toast = useToast();
  const { code } = useParams();
  const navigate = useNavigate();
  const standalone = !!code;
  const [docs, setDocs] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [warnings, setWarnings] = useState<any[]>([]);
  const [recApps, setRecApps] = useState<any[]>([]);
  const [payRecords, setPayRecords] = useState<any[]>([]);
  const [paySel, setPaySel] = useState<any>(null);
  const [master, setMaster] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [attLive, setAttLive] = useState<any[]>([]);
  const [quals, setQuals] = useState<any[]>([]);
  const [workViols, setWorkViols] = useState<any[]>([]);
  const [trafficViols, setTrafficViols] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [supports, setSupports] = useState<any[]>([]);
  const [letters, setLetters] = useState<any[]>([]);
  const [audits, setAudits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [kindFilter, setKindFilter] = useState('الكل');
  const [sel, setSel] = useState<any>(null);
  const [tab, setTab] = useState<TabKey>('basic');
  const [tsMonth, setTsMonth] = useState('2026-09');
  const [docOpen, setDocOpen] = useState<any>(null);
  const [docDraft, setDocDraft] = useState<any>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [ocrOpen, setOcrOpen] = useState(false);
  const [ocrExisting, setOcrExisting] = useState<{ file_key?: string; file_name?: string; doc_type?: string } | null>(null);
  const [empPhoto, setEmpPhoto] = useState('');
  const [eventOpen, setEventOpen] = useState(false);
  const [qualOpen, setQualOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attachForm, setAttachForm] = useState<any>({ doc_type: 'هوية', doc_date: '', file_key: '', file_name: '' });
  const [eventForm, setEventForm] = useState<any>({ event_type: 'ترقية', event_date: todayISO(), details: '' });
  const [qualForm, setQualForm] = useState<any>({ qual_type: 'مؤهلات علمية', title: '', institution: '', from_date: '', to_date: '', years: '', notes: '' });
  // وضع القراءة فقط: الموظف العادي (دور "user") يقرأ ولا يعدّل؛ المدير/HR (دور "admin") يعدّل.
  const [canEdit, setCanEdit] = useState(false);
  const [roleLoaded, setRoleLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const me = await getMe();
      if (!alive) return;
      setCanEdit(me?.role === 'admin');
      setRoleLoaded(true);
    })();
    return () => { alive = false; };
  }, []);

  const reload = async () => {
    setLoading(true);
    const [d, b, ev, lv, bl, wn] = await Promise.all([
      fetchHrDocs(), fetchBankAccounts(), fetchEvents(), fetchLeaves(), fetchBalances(), fetchWarnings(),
    ]);
    setDocs(d); setBanks(b); setEvents(ev); setLeaves(lv); setBalances(bl); setWarnings(wn);
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);
  useEffect(() => { if (code) { const e = employees.find((x: any) => x.no === code); if (e) { setSel(e); setTab('basic'); } } }, [code, employees]);

  // جلب كل أقسام الملف بالترشيح الخادمي عبر employee_code
  useEffect(() => {
    if (!sel) {
      setRecApps([]); setPayRecords([]); setMaster(null); setAssignments([]); setAttLive([]);
      setQuals([]); setWorkViols([]); setTrafficViols([]); setVisits([]); setSupports([]);
      setLetters([]); setAudits([]);
      return;
    }
    const code = sel.no;
    fetchApplicationsForEmployee(code).then(setRecApps);
    fetchPayrollByCode(code).then(setPayRecords);
    Promise.all([
      fetchMasterByCode(code), fetchAssignmentsByCode(code), fetchAttendanceByCode(code),
      fetchQualificationsByCode(code), fetchWorkViolationsByCode(code), fetchTrafficViolationsByCode(code),
      fetchVisitsByCode(code), fetchSupportByCode(code), fetchLettersByCode(code), fetchAuditByCode(code),
    ]).then(([m, as, at, qs, wv, tv, vs, sp, lt, au]) => {
      setMaster(m[0] || null); setAssignments(as); setAttLive(at); setQuals(qs);
      setWorkViols(wv); setTrafficViols(tv); setVisits(vs); setSupports(sp); setLetters(lt); setAudits(au);
    });
  }, [sel]);

  const siteOf = (id: number) => sites.find((s: any) => s.id === id);
  const zoneOf = (siteId?: number) => {
    const s = siteOf(siteId || 0);
    return zones.find((z: any) => z.id === s?.zoneId)?.name || '';
  };
  const projectOf = (id: number) => projects.find((p: any) => p.id === id);

  // اشتقاق رقم الهوية/الإقامة من مصادرها الفعلية (طلب توظيف محوّل، مخالفة، مساندة)
  // بدل الاشتقاق من رقم الجوال الذي يُنتج أرقاماً وهمية.
  const realIdOf = (emp: any): string => {
    const rec = recApps.find((r: any) => r.employee_code === emp.no && r.id_number);
    if (rec?.id_number) return String(rec.id_number);
    const wv = workViols.find((v: any) => v.employee_id_number);
    if (wv?.employee_id_number) return String(wv.employee_id_number);
    const tv = trafficViols.find((v: any) => v.employee_id_number);
    if (tv?.employee_id_number) return String(tv.employee_id_number);
    const sp = supports.find((s: any) => s.employee_id_number);
    if (sp?.employee_id_number) return String(sp.employee_id_number);
    const idDoc = docs.find((x: any) => x.employee_code === emp.no && (x.doc_type === 'هوية' || x.doc_type === 'إقامة'));
    if (idDoc?.doc_number) return String(idDoc.doc_number);
    return '';
  };

  const buildDoc = (emp: any) => {
    const asg = assignments.find((a: any) => a.active) || assignments[0];
    const basic = asg?.salary ? Number(asg.salary) : salaryOf(emp.job);
    const housing = Math.round(basic * 0.25);
    const transfer = Math.round(basic * 0.1);
    const bank = banks.find((b: any) => b.employee_code === emp.no);
    const idDoc = docs.find((x: any) => x.employee_code === emp.no && x.doc_type === 'هوية');
    const iqama = docs.find((x: any) => x.employee_code === emp.no && x.doc_type === 'إقامة');
    const nat = master?.nationality || emp.nationality || 'سعودي';
    const total = basic + housing + transfer;
    return {
      name: emp.name, nameEn: emp.nameEn || '', idNumber: realIdOf(emp), employeeCode: emp.no,
      nationality: nat, job: emp.job,
      project: asg?.project_name || projectOf(emp.projectId)?.name || '',
      zone: zoneOf(emp.siteId), site: asg?.site_name || siteOf(emp.siteId)?.name || '',
      department: emp.kind === 'إداري' ? 'الإدارة' : 'العمليات',
      hireDate: asg?.start_date || emp.joined, endDate: todayISO(),
      expiryDate: nat === 'سعودي' ? idDoc?.doc_date : iqama?.doc_date || idDoc?.doc_date,
      basicSalary: basic, housingAllowance: housing, transferAllowance: transfer, otherAllowance: 0,
      totalSalary: total, bankName: bank?.bank_name || '', accountNumber: bank?.account_number || '',
      iban: bank?.iban || '', currency: 'SAR', amount: total, docDate: todayISO(),
    };
  };

  // عند فتح نافذة الخطاب: عبّئ المسودة تلقائياً من بيانات الموظف،
  // أو استرجع النسخة المحفوظة عند المعاينة اللاحقة — لتكون قابلة للتعديل قبل الإصدار.
  useEffect(() => {
    if (!docOpen) { setDocDraft(null); return; }
    if (docOpen.saved?.content_json) {
      try {
        const parsed = JSON.parse(docOpen.saved.content_json);
        setDocDraft(parsed && parsed.name ? parsed : buildDoc(docOpen.emp));
      } catch { setDocDraft(buildDoc(docOpen.emp)); }
    } else if (docOpen.emp) {
      setDocDraft(buildDoc(docOpen.emp));
    } else {
      setDocDraft(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docOpen]);

  const filtered = useMemo(() => {
    const s = q.trim();
    return employees.filter((e: any) => {
      const kind = empKindOf(e.job);
      if (kindFilter !== 'الكل' && kind !== kindFilter) return false;
      if (s && !(`${e.name} ${e.no} ${e.job} ${e.phone}`.includes(s))) return false;
      return true;
    });
  }, [employees, q, kindFilter]);

  const empDocs = (code: string) => docs.filter((x: any) => x.employee_code === code);
  const empEvents = (code: string) => events.filter((x: any) => x.employee_code === code);
  const empLeaves = (code: string) => leaves.filter((x: any) => x.employee_code === code);
  const empWarnings = (code: string) => warnings.filter((x: any) => x.employee_code === code);
  const empViolations = (name: string) => violations.filter((v: any) => v.employeeName === name);
  const empInsurance = (name: string) => insurance.filter((v: any) => v.employeeName === name);

  const attRows = useMemo(() => {
    if (!sel) return [];
    const live = attLive.map((a: any) => ({ date: a.work_date, checkIn: a.check_in_time, checkOut: a.check_out_time, status: a.status, src: 'تطبيق الموظف' }));
    const local = attendance.filter((x: any) => x.employeeId === sel.id).map((a: any) => ({ date: a.date, checkIn: a.checkIn, checkOut: a.checkOut, status: a.status, src: 'لوحة التحكم' }));
    const seen = new Set(live.map((r: any) => r.date));
    return [...live, ...local.filter((r: any) => !seen.has(r.date))].sort((a: any, b: any) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [sel, attLive, attendance]);

  const tsSummary = useMemo(() => {
    const inMonth = attRows.filter((r: any) => String(r.date || '').startsWith(tsMonth));
    return {
      total: inMonth.length,
      present: inMonth.filter((r: any) => ['حاضر', 'منصرف'].includes(r.status)).length,
      absent: inMonth.filter((r: any) => r.status === 'غائب').length,
      late: inMonth.filter((r: any) => r.status === 'متأخر').length,
    };
  }, [attRows, tsMonth]);

  const empVisits = useMemo(() => {
    if (!sel) return [];
    const live = visits.map((v: any) => ({ ...v, _src: 'باك-إند' }));
    const local = (fieldVisits || []).filter((v: any) => String(v.rows || '').includes(sel.name) || String(v.rows_data || '').includes(sel.name))
      .map((v: any) => ({ ...v, _src: 'نموذج المرور' }));
    return [...live, ...local];
  }, [sel, visits, fieldVisits]);

  const empSupports = useMemo(() => {
    if (!sel) return [];
    const live = supports.map((s: any) => ({ ...s, _src: 'باك-إند' }));
    const local = (supportMovements || []).filter((s: any) => s.employeeName === sel.name)
      .map((s: any) => ({ employee_code: sel.no, employee_name: s.employeeName, home_site: s.homeSite, covered_site: s.coveredSite, movement_date: s.date, movement_type: s.type, checkin_time: s.checkIn, checkout_time: s.checkOut, note: s.note, _src: 'لوحة التحكم' }));
    return [...live, ...local];
  }, [sel, supports, supportMovements]);

  const transferLetters = letters.filter((l: any) => l.letter_type === 'خطاب تحويل');
  const confirmLetters = letters.filter((l: any) => l.letter_type === 'خطاب تثبيت');
  const otherLetters = letters.filter((l: any) => l.letter_type !== 'خطاب تحويل' && l.letter_type !== 'خطاب تثبيت');

  const alertsFor = (code: string) => {
    const out: { label: string; text: string; severity: string }[] = [];
    for (const x of empDocs(code)) {
      if (!ATTACH_TYPES.includes(x.doc_type) || !x.doc_date) continue;
      const st = expiryStatus(x.doc_date);
      if (st && st.severity !== 'ok') out.push({ label: x.doc_type, text: st.label, severity: st.severity });
    }
    return out;
  };
  const totalAlerts = useMemo(() => employees.reduce((s: number, e: any) => s + alertsFor(e.no).length, 0), [employees, docs]);

  const issueDoc = async () => {
    if (!canEdit) { toast.show('وضع القراءة فقط: الإصدار متاح لإدارة الموارد البشرية'); return; }
    if (!docOpen || !docDraft) return;
    if (!String(docDraft.idNumber || '').trim()) { toast.show('أدخل رقم الهوية/الإقامة قبل الإصدار'); return; }
    setBusy(true);
    const emp = docOpen.emp || sel;
    const payload = {
      employee_code: emp.no, employee_name: docDraft.name || emp.name, doc_type: docOpen.type,
      doc_lang: docOpen.type.includes('إنجليزي') ? 'en' : 'ar',
      doc_date: docDraft.docDate || todayISO(),
      content_json: JSON.stringify(docDraft),
    };
    if (docOpen.saved?.id) await updateHrDoc(docOpen.saved.id, payload, 'مدير الموارد البشرية');
    else await saveHrDoc(payload, 'مدير الموارد البشرية');
    setBusy(false); setDocOpen(null); setDocDraft(null);
    toast.show(docOpen.saved?.id ? 'تم تحديث المستند في ملف الموظف' : 'تم إصدار المستند وحفظه في ملف الموظف');
    reload();
    if (sel) fetchLettersByCode(sel.no).then(setLetters);
  };

  const addAttach = async () => {
    if (!canEdit) { toast.show('وضع القراءة فقط: الإضافة متاحة لإدارة الموارد البشرية'); return; }
    if (!sel) return;
    if (!attachForm.doc_date) { toast.show('أدخل تاريخ الانتهاء'); return; }
    setBusy(true);
    await saveHrDoc({
      employee_code: sel.no, employee_name: sel.name, doc_type: attachForm.doc_type,
      doc_date: attachForm.doc_date, content_json: JSON.stringify({ file_name: attachForm.file_name, file_key: attachForm.file_key }),
    }, 'مدير الموارد البشرية');
    if (attachForm.file_key) {
      await addEvent({ employee_code: sel.no, employee_name: sel.name, event_type: 'مرفق', event_date: todayISO(), details: `${attachForm.doc_type}: ${attachForm.file_name}`, attachment_key: attachForm.file_key }, 'مدير الموارد البشرية');
    }
    setBusy(false); setAttachOpen(false);
    setAttachForm({ doc_type: 'هوية', doc_date: '', file_key: '', file_name: '' });
    toast.show('تمت إضافة المرفق'); reload();
  };

  const addEventSubmit = async () => {
    if (!canEdit) { toast.show('وضع القراءة فقط: التسجيل متاح لإدارة الموارد البشرية'); return; }
    if (!sel) return;
    setBusy(true);
    await addEvent({ employee_code: sel.no, employee_name: sel.name, ...eventForm }, 'مدير الموارد البشرية');
    setBusy(false); setEventOpen(false);
    toast.show('تم تسجيل الحركة الوظيفية'); reload();
    fetchAuditByCode(sel.no).then(setAudits);
  };

  const addQualSubmit = async () => {
    if (!canEdit) { toast.show('وضع القراءة فقط: الإضافة متاحة لإدارة الموارد البشرية'); return; }
    if (!sel) return;
    if (!qualForm.title) { toast.show('أدخل عنوان المؤهل/الخبرة'); return; }
    setBusy(true);
    await addQualification({
      employee_code: sel.no, employee_name: sel.name, qual_type: qualForm.qual_type, title: qualForm.title,
      institution: qualForm.institution, from_date: qualForm.from_date, to_date: qualForm.to_date,
      years: qualForm.years ? Number(qualForm.years) : undefined, notes: qualForm.notes,
    }, 'مدير الموارد البشرية');
    setBusy(false); setQualOpen(false);
    setQualForm({ qual_type: 'مؤهلات علمية', title: '', institution: '', from_date: '', to_date: '', years: '', notes: '' });
    toast.show('تمت إضافة المؤهل/الخبرة لملف الموظف');
    fetchQualificationsByCode(sel.no).then(setQuals);
    fetchAuditByCode(sel.no).then(setAudits);
  };

  const previewRecFile = async (key: string) => {
    const url = await getFileUrl(key);
    if (url) window.open(url, '_blank'); else toast.show('تعذّر توليد رابط المعاينة');
  };

  // صورة الموظف: تُشتق من أول مرفق صورة محفوظ (هوية/إقامة/...) مع بديل الحرف الأول
  useEffect(() => {
    let alive = true;
    setEmpPhoto('');
    if (!sel) return;
    (async () => {
      for (const x of empDocs(sel.no)) {
        if (!ATTACH_TYPES.includes(x.doc_type)) continue;
        let cj: any = {};
        try { cj = JSON.parse(x.content_json || '{}'); } catch { cj = {}; }
        const key = String(cj.file_key || '');
        if (!key) continue;
        if (!/\.(jpe?g|png|webp)$/i.test(String(cj.file_name || key))) continue;
        const url = await getFileUrl(key);
        if (alive && url) { setEmpPhoto(url); return; }
      }
    })();
    return () => { alive = false; };
  }, [sel, docs]);

  const selAlerts = sel ? alertsFor(sel.no) : [];
  const selBal = sel ? balances.find((b: any) => b.employee_code === sel.no) : null;
  const selBank = sel ? banks.find((b: any) => b.employee_code === sel.no) : null;

  const payTotals = useMemo(() => {
    const sum = (k: string) => payRecords.reduce((s: number, p: any) => s + (Number(p[k]) || 0), 0);
    return { gross: sum('gross'), ded: sum('deductions_total'), net: sum('net') };
  }, [payRecords]);
  const deductedViol = workViols.filter((v: any) => v.status === 'deducted').reduce((s: number, v: any) => s + (v.amount || 0), 0)
    + (sel ? empViolations(sel.name).filter((v: any) => v.status === 'deducted').reduce((s: number, v: any) => s + (v.amount || 0), 0) : 0);

  return (
    <div>
      {toast.node}
      {!standalone ? (
        <PageToolbar
          title="ملف الموظف الشامل"
          subtitle="المركز الرئيسي لكل بيانات الموظف — 18 قسمًا مرتبطًا بالرقم الوظيفي employee_code، وكل سجل يُنشأ من أي وحدة يظهر هنا تلقائيًا"
          actions={<Btn variant="outline" size="sm" onClick={reload}>تحديث</Btn>}
        />
      ) : (
        <div className="mb-3 flex items-center justify-between">
          <Btn variant="outline" size="sm" onClick={() => navigate('/hr/employees')}>رجوع لقائمة الموظفين</Btn>
          <Btn variant="outline" size="sm" onClick={reload}>تحديث</Btn>
        </div>
      )}

      {!standalone && (<>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="الموظفون" value={employees.length} icon={<Users className="h-5 w-5" />} tone="navy" />
        <StatCard title="مستندات مصدرة" value={docs.length} icon={<FileText className="h-5 w-5" />} tone="info" />
        <StatCard title="تنبيهات انتهاء" value={totalAlerts} icon={<Bell className="h-5 w-5" />} tone={totalAlerts ? 'danger' : 'success'} />
        <StatCard title="إنذارات مسجلة" value={warnings.length} icon={<AlertTriangle className="h-5 w-5" />} tone="warning" />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TextInput placeholder="بحث بالاسم أو الرقم أو الجوال..." value={q} onChange={(e: any) => setQ(e.target.value)} className="w-72" />
        <Select value={kindFilter} onChange={(e: any) => setKindFilter(e.target.value)} options={[
          { value: 'الكل', label: 'إداري + تشغيلي' }, { value: 'إداري', label: 'إداري' }, { value: 'تشغيلي', label: 'تشغيلي' },
        ]} />
      </div>

      </>)}
      <div className={standalone ? '' : 'grid grid-cols-1 gap-4 lg:grid-cols-3'}>
        {!standalone && (
        <div className="lg:col-span-1">
          <Table head={['الموظف', 'النوع', 'الحالة']}>
            {loading ? <EmptyRow colSpan={3} text="جارٍ التحميل..." /> : filtered.map((e: any) => {
              const kind = empKindOf(e.job);
              const al = alertsFor(e.no).length;
              return (
                <tr key={e.id} className={'cursor-pointer ' + (sel?.id === e.id ? 'bg-gold-500/10' : 'hover:bg-muted/50')} onClick={() => navigate('/hr/employees/' + e.no)}>
                  <td className="px-3 py-2.5 font-bold text-navy-900">{e.name}<div className="text-[10px] font-normal text-muted-foreground">{e.no} — {e.job}</div></td>
                  <td className="px-3 py-2.5"><span className={'rounded px-1.5 py-0.5 text-[10px] font-bold ring-1 ' + (kind === 'إداري' ? 'bg-sky-50 text-sky-700 ring-sky-200' : 'bg-amber-50 text-amber-700 ring-amber-200')}>{kind}</span></td>
                  <td className="px-3 py-2.5">
                    <StatusBadge value={e.status} />
                    {al > 0 && <span className="mr-1 inline-flex items-center gap-0.5 rounded bg-rose-50 px-1 text-[10px] font-bold text-rose-600 ring-1 ring-rose-200"><AlertTriangle className="h-2.5 w-2.5" />{al}</span>}
                  </td>
                </tr>
              );
            })}
          </Table>
        </div>
        )}

        <div className={standalone ? '' : 'lg:col-span-2'}>
          {!sel ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-card text-sm text-muted-foreground shadow-sm">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-900 text-gold-400"><Users className="h-6 w-6" /></span>
              {standalone ? ('جارٍ تحميل ملف الموظف ' + code + '...') : 'اختر موظفاً من القائمة لعرض بطاقة ملفه الشامل'}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border bg-card shadow-lg">
              <div className="relative bg-gradient-to-l from-[#202359] via-[#302E7A] to-[#202359] px-5 pb-14 pt-5">
                <button onClick={() => { if (standalone) navigate('/hr/employees'); else setSel(null); }} title={standalone ? 'رجوع للقائمة' : 'إغلاق الملف'} className="absolute left-4 top-4 rounded-lg bg-white/10 p-1.5 text-white/80 ring-1 ring-white/20 backdrop-blur transition hover:bg-[#ED2024] hover:text-white"><X className="h-4 w-4" /></button>
                <div className="flex items-center gap-4">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-white/10 ring-2 ring-gold-400/50 backdrop-blur">
                    {empPhoto ? (
                      <img src={empPhoto} alt={sel.name} className="h-full w-full object-cover" onError={() => setEmpPhoto('')} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl font-extrabold text-gold-400">{sel.name.trim().charAt(0)}</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-cairo text-xl font-extrabold text-white">{sel.name}</h3>
                    <p className="mt-0.5 truncate text-xs text-white/70">{sel.no} — {sel.job} — {siteOf(sel.siteId)?.name || 'غير مسند'}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className={'rounded-full px-2.5 py-0.5 text-[10px] font-bold ring-1 ' + (empKindOf(sel.job) === 'إداري' ? 'bg-sky-400/15 text-sky-200 ring-sky-300/30' : 'bg-amber-400/15 text-amber-200 ring-amber-300/30')}>{empKindOf(sel.job)}</span>
                      <span className="rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-200 ring-1 ring-emerald-300/30">{sel.status}</span>
                      {roleLoaded && !canEdit && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold text-gold-300 ring-1 ring-gold-400/40"><Lock className="h-2.5 w-2.5" /> وضع القراءة فقط</span>
                      )}
                      {selAlerts.length > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-[#ED2024]/20 px-2.5 py-0.5 text-[10px] font-bold text-red-200 ring-1 ring-red-300/40"><Bell className="h-2.5 w-2.5" />{selAlerts.length} تنبيه انتهاء</span>}
                    </div>
                  </div>
                </div>
              </div>
              <div className="-mt-9 grid grid-cols-2 gap-2 px-5 sm:grid-cols-4">
                {[
                  { label: 'سنوي متبقٍ', value: selBal ? balanceRemaining(selBal).annual : '—', tone: 'text-emerald-700' },
                  { label: 'مرضي متبقٍ', value: selBal ? balanceRemaining(selBal).sick : '—', tone: 'text-sky-700' },
                  { label: 'مسيرات رواتب', value: payRecords.length, tone: 'text-navy-900' },
                  { label: 'تنبيهات انتهاء', value: selAlerts.length, tone: selAlerts.length ? 'text-[#ED2024]' : 'text-navy-900' },
                ].map((s: any) => (
                  <div key={s.label} className="rounded-xl border bg-card px-3 py-2 text-center shadow-sm">
                    <div className="text-[10px] font-medium text-muted-foreground">{s.label}</div>
                    <div className={'num text-lg font-extrabold ' + s.tone}>{s.value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-1 overflow-x-auto border-b px-5 pb-px">
                {TABS.map((t) => (
                  <button key={t.key} onClick={() => setTab(t.key)} className={'-mb-px shrink-0 whitespace-nowrap rounded-t-lg border-b-2 px-3 py-2 text-xs font-bold transition ' + (tab === t.key ? 'border-[#ED2024] bg-muted text-navy-900' : 'border-transparent text-muted-foreground hover:bg-muted/60 hover:text-navy-800')}>
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="p-5">

                {/* 1) البيانات الأساسية */}
                {tab === 'basic' && (
                  <div>
                    {selAlerts.length > 0 && (
                      <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3">
                        <div className="mb-1 flex items-center gap-1 text-xs font-bold text-rose-700"><Bell className="h-3.5 w-3.5" /> تنبيهات الانتهاء</div>
                        {selAlerts.map((a: any, i: number) => (<div key={i} className="text-xs text-rose-700">• {a.label}: {a.text}</div>))}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                      {[
                        ['الرقم الوظيفي', sel.no], ['رقم الهوية', realIdOf(sel) || '—'], ['الجوال', sel.phone], ['البريد', sel.email],
                        ['تاريخ التعيين', sel.joined], ['البصمة', sel.fingerprint], ['الحالة', sel.status],
                        ['المشروع', projectOf(sel.projectId)?.name], ['العميل', clientOf(sel.projectId)], ['المنطقة', zoneOf(sel.siteId)],
                        ['الجنسية', master?.nationality], ['رقم العقد', master?.contract_no], ['رقم التأمينات', master?.insurance_no],
                        ['القسم', master?.department || sel.job], ['الإدارة', master?.administration], ['المؤهل (أساسي)', master?.qualification],
                      ].map(([k, v]: any) => (
                        <div key={k}><span className="text-xs text-muted-foreground">{k}: </span><span className="font-bold text-navy-900">{v || '—'}</span></div>
                      ))}
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-lg bg-slate-50 p-2 ring-1 ring-slate-200"><div className="text-slate-400">سنوي متبقٍ</div><div className="num text-lg font-extrabold text-emerald-700">{selBal ? balanceRemaining(selBal).annual : '—'}</div></div>
                      <div className="rounded-lg bg-slate-50 p-2 ring-1 ring-slate-200"><div className="text-slate-400">مرضي متبقٍ</div><div className="num text-lg font-extrabold text-sky-700">{selBal ? balanceRemaining(selBal).sick : '—'}</div></div>
                      <div className="rounded-lg bg-slate-50 p-2 ring-1 ring-slate-200"><div className="text-slate-400">بدون راتب</div><div className="num text-lg font-extrabold text-rose-600">{selBal?.unpaid_days || 0}</div></div>
                    </div>
                    {canEdit && (
                      <div className="mt-3">
                        <div className="mb-1 text-xs font-bold text-muted-foreground">إصدار مستند رسمي</div>
                        <div className="flex flex-wrap gap-1.5">
                          {LETTER_TYPES.map((t) => (
                            <button key={t} onClick={() => setDocOpen({ type: t, emp: sel })} className="rounded-lg border bg-card px-2.5 py-1 text-xs font-semibold hover:bg-navy-900 hover:text-gold-400">{t}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {!canEdit && roleLoaded && (
                      <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-500">
                        <Lock className="h-3.5 w-3.5" /> هذا الملف للعرض فقط — إصدار وتحديث المستندات متاح لإدارة الموارد البشرية.
                      </div>
                    )}
                  </div>
                )}

                {/* 2) البيانات الوظيفية */}
                {tab === 'work' && (
                  <div className="space-y-4">
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <div className="text-xs font-bold text-muted-foreground">الإسنادات الوظيفية (مشاريع/مواقع/ورديات)</div>
                        <span className="text-[10px] text-muted-foreground">مرتبطة بالرقم {sel.no}</span>
                      </div>
                      <Table head={['المشروع', 'الموقع', 'الدور', 'الوردية', 'أساس الراتب', 'الراتب', 'من', 'إلى', 'الحالة']}>
                        {assignments.length === 0 ? <EmptyRow colSpan={9} text="لا توجد إسنادات مسجلة لهذا الرقم الوظيفي" /> :
                          assignments.map((a: any) => (
                            <tr key={a.id}>
                              <td className="px-3 py-2 text-xs font-bold">{a.project_name || '—'}</td>
                              <td className="px-3 py-2 text-xs">{a.site_name || '—'}</td>
                              <td className="px-3 py-2 text-xs">{a.role || '—'}</td>
                              <td className="px-3 py-2 text-xs">{a.shift_period || '—'}</td>
                              <td className="px-3 py-2 text-xs">{a.pay_basis || '—'}</td>
                              <td className="px-3 py-2 num">{a.salary ?? '—'}</td>
                              <td className="px-3 py-2 text-xs num">{a.start_date || '—'}</td>
                              <td className="px-3 py-2 text-xs num">{a.end_date || '—'}</td>
                              <td className="px-3 py-2"><StatusBadge value={a.active ? 'نشط' : 'منتهي'} /></td>
                            </tr>
                          ))}
                      </Table>
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-xs font-bold text-muted-foreground">الحركة الوظيفية</div>
                        {canEdit && <Btn size="sm" onClick={() => setEventOpen(true)}><Plus className="h-4 w-4" /> تسجيل حركة</Btn>}
                      </div>
                      <Table head={['النوع', 'التاريخ', 'التفاصيل']}>
                        {empEvents(sel.no).length === 0 ? <EmptyRow colSpan={3} text="لا توجد حركات" /> :
                          empEvents(sel.no).map((x: any) => (
                            <tr key={x.id}><td className="px-4 py-2 font-bold">{x.event_type}</td><td className="px-4 py-2 text-xs">{x.event_date}</td><td className="px-4 py-2 text-xs">{x.details || '—'}</td></tr>
                          ))}
                      </Table>
                    </div>
                  </div>
                )}

                {/* 3) البيانات المالية */}
                {tab === 'finance' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div className="rounded-xl bg-emerald-50 p-3 text-center ring-1 ring-emerald-200"><div className="text-[10px] text-emerald-700">إجمالي الاستحقاقات</div><div className="num text-lg font-extrabold text-emerald-700">{payTotals.gross}</div></div>
                      <div className="rounded-xl bg-rose-50 p-3 text-center ring-1 ring-rose-200"><div className="text-[10px] text-rose-700">إجمالي الخصومات</div><div className="num text-lg font-extrabold text-rose-700">{payTotals.ded}</div></div>
                      <div className="rounded-xl bg-navy-900 p-3 text-center"><div className="text-[10px] text-white/70">صافي المسيرات</div><div className="num text-lg font-extrabold text-gold-400">{payTotals.net}</div></div>
                      <div className="rounded-xl bg-amber-50 p-3 text-center ring-1 ring-amber-200"><div className="text-[10px] text-amber-700">حسم مخالفات معتمد</div><div className="num text-lg font-extrabold text-amber-700">{deductedViol}</div></div>
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-bold text-muted-foreground">الراتب الشهري الحالي (تقديري حسب المسمى)</div>
                      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                        {[['أساسي', salaryOf(sel.job)], ['سكن', Math.round(salaryOf(sel.job) * 0.25)], ['نقل', Math.round(salaryOf(sel.job) * 0.1)], ['إجمالي', salaryOf(sel.job) + Math.round(salaryOf(sel.job) * 0.25) + Math.round(salaryOf(sel.job) * 0.1)]].map(([k, v]: any) => (
                          <div key={k} className="rounded-lg bg-slate-50 p-2 ring-1 ring-slate-200"><div className="text-slate-400">{k}</div><div className="num font-extrabold text-navy-900">{v} ر.س</div></div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-bold text-muted-foreground">التأمينات</div>
                      <Table head={['الشركة', 'الخصم الشهري', 'الحالة']}>
                        {empInsurance(sel.name).length === 0 ? <EmptyRow colSpan={3} text="غير مسجّل" /> :
                          empInsurance(sel.name).map((v: any, i: number) => (
                            <tr key={i}><td className="px-4 py-2">{v.company}</td><td className="px-4 py-2 num">{v.monthlyDeduction}</td><td className="px-4 py-2"><StatusBadge value={v.status} /></td></tr>
                          ))}
                      </Table>
                    </div>
                  </div>
                )}

                {/* 4) بيانات البنك */}
                {tab === 'bank' && (
                  <div>
                    <div className="mb-2 rounded-lg border border-sky-200 bg-sky-50 p-2.5 text-xs text-sky-800">
                      <b>الحساب البنكي للموظف:</b> يُسجَّل من صفحة «الرواتب والبنوك»، ويظهر هنا مرتبطًا بالرقم الوظيفي {sel.no}.
                    </div>
                    {selBank ? (
                      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                        <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200"><div className="text-[10px] text-slate-400">البنك</div><div className="font-extrabold text-navy-900">{selBank.bank_name}</div></div>
                        <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200"><div className="text-[10px] text-slate-400">رقم الحساب</div><div className="font-mono font-bold">{selBank.account_number}</div></div>
                        <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200"><div className="text-[10px] text-slate-400">IBAN</div><div className="font-mono font-bold">{selBank.iban || '—'}</div></div>
                        <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200"><div className="text-[10px] text-slate-400">تاريخ التغيير</div><div className="num font-bold">{selBank.changed_at || '—'}</div></div>
                      </div>
                    ) : (
                      <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-200">لا يوجد حساب بنكي مسجّل — سجّله من صفحة «الرواتب والبنوك».</div>
                    )}
                  </div>
                )}

                {/* 5) المؤهلات والخبرات */}
                {tab === 'quals' && (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">سجل المؤهلات والخبرات والدورات — مرتبط بالرقم {sel.no}</div>
                      {canEdit && <Btn size="sm" onClick={() => setQualOpen(true)}><Plus className="h-4 w-4" /> إضافة مؤهل/خبرة</Btn>}
                    </div>
                    <Table head={canEdit ? ['النوع', 'العنوان', 'الجهة/المعهد', 'من', 'إلى', 'سنوات', 'ملاحظات', ''] : ['النوع', 'العنوان', 'الجهة/المعهد', 'من', 'إلى', 'سنوات', 'ملاحظات']}>
                      {quals.length === 0 ? <EmptyRow colSpan={canEdit ? 8 : 7} text="لا توجد مؤهلات أو خبرات مسجلة" /> :
                        quals.map((x: any) => (
                          <tr key={x.id}>
                            <td className="px-3 py-2 text-xs font-bold">{x.qual_type}</td>
                            <td className="px-3 py-2 text-xs">{x.title}</td>
                            <td className="px-3 py-2 text-xs">{x.institution || '—'}</td>
                            <td className="px-3 py-2 text-xs num">{x.from_date || '—'}</td>
                            <td className="px-3 py-2 text-xs num">{x.to_date || '—'}</td>
                            <td className="px-3 py-2 num">{x.years ?? '—'}</td>
                            <td className="px-3 py-2 text-xs">{x.notes || '—'}</td>
                            {canEdit && <td className="px-3 py-2"><button title="حذف" onClick={async () => { await deleteQualification(x.id, 'مدير الموارد البشرية', sel.no, sel.name); fetchQualificationsByCode(sel.no).then(setQuals); fetchAuditByCode(sel.no).then(setAudits); }} className="rounded p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button></td>}
                          </tr>
                        ))}
                    </Table>
                  </div>
                )}

                {/* 6) الحضور والانصراف */}
                {tab === 'attendance' && (
                  <div>
                    <div className="mb-2 text-xs text-muted-foreground">سجل الحضور الفعلي من تطبيق الموظف (GPS/بصمة) ولوحة التحكم — مرتبط بالرقم {sel.no}</div>
                    <Table head={['التاريخ', 'دخول', 'خروج', 'الحالة', 'المصدر']}>
                      {attRows.length === 0 ? <EmptyRow colSpan={5} text="لا توجد سجلات حضور" /> :
                        attRows.slice(0, 60).map((r: any, i: number) => (
                          <tr key={i}><td className="px-4 py-2 text-xs num">{r.date}</td><td className="px-4 py-2 text-xs num">{r.checkIn || '—'}</td><td className="px-4 py-2 text-xs num">{r.checkOut || '—'}</td><td className="px-4 py-2"><StatusBadge value={r.status || '—'} /></td><td className="px-4 py-2 text-[10px] text-muted-foreground">{r.src}</td></tr>
                        ))}
                    </Table>
                  </div>
                )}

                {/* 7) التايم شيت */}
                {tab === 'timesheet' && (
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <CalendarClock className="h-4 w-4 text-navy-900" />
                      <TextInput type="month" value={tsMonth} onChange={(e: any) => setTsMonth(e.target.value)} className="w-40" />
                      <span className="text-[11px] text-muted-foreground">الشبكة التفصيلية الكاملة في «مركز التقارير ← التايم شيت الشهري»</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div className="rounded-xl bg-slate-50 p-3 text-center ring-1 ring-slate-200"><div className="text-[10px] text-slate-400">أيام مسجلة</div><div className="num text-lg font-extrabold text-navy-900">{tsSummary.total}</div></div>
                      <div className="rounded-xl bg-emerald-50 p-3 text-center ring-1 ring-emerald-200"><div className="text-[10px] text-emerald-600">حضور</div><div className="num text-lg font-extrabold text-emerald-700">{tsSummary.present}</div></div>
                      <div className="rounded-xl bg-rose-50 p-3 text-center ring-1 ring-rose-200"><div className="text-[10px] text-rose-600">غياب</div><div className="num text-lg font-extrabold text-rose-700">{tsSummary.absent}</div></div>
                      <div className="rounded-xl bg-amber-50 p-3 text-center ring-1 ring-amber-200"><div className="text-[10px] text-amber-600">تأخير</div><div className="num text-lg font-extrabold text-amber-700">{tsSummary.late}</div></div>
                    </div>
                    <div className="mt-3 overflow-x-auto rounded-lg border">
                      <table className="w-full text-[11px]">
                        <thead className="bg-muted/50"><tr>{attRows.filter((r: any) => String(r.date || '').startsWith(tsMonth)).map((r: any, i: number) => (<th key={i} className="whitespace-nowrap px-2 py-1.5">{String(r.date).slice(8)}</th>))}</tr></thead>
                        <tbody><tr>{attRows.filter((r: any) => String(r.date || '').startsWith(tsMonth)).map((r: any, i: number) => (
                          <td key={i} className={'px-2 py-1.5 text-center font-bold ' + (r.status === 'غائب' ? 'bg-rose-100 text-rose-700' : r.status === 'متأخر' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-700')}>{r.status === 'غائب' ? 'غ' : r.status === 'متأخر' ? 'م' : '1'}</td>
                        ))}</tr></tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 8) الرواتب */}
                {tab === 'payroll' && (
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <Wallet className="h-4 w-4 text-navy-900" /> السجل التاريخي للرواتب المستورد من Excel — كل مسير شهر مستقل، لا يُستبدل ولا يُحذف.
                    </div>
                    <Table head={['الفترة', 'رقم المسير', 'الفرع/المشروع', 'الإجمالي', 'الخصومات', 'الصافي', 'تاريخ الصرف', '']}>
                      {payRecords.length === 0 ? <EmptyRow colSpan={8} text="لا توجد مسيرات مستوردة لهذا الموظف بعد" /> :
                        payRecords.map((p: any) => (
                          <tr key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setPaySel(p)}>
                            <td className="px-4 py-2 font-bold">{p.pay_month} {p.pay_year}</td>
                            <td className="px-4 py-2 num">{p.run_no || '—'}</td>
                            <td className="px-4 py-2">{p.branch || '—'}</td>
                            <td className="px-4 py-2 num">{p.gross}</td>
                            <td className="px-4 py-2 num text-rose-600">{p.deductions_total}</td>
                            <td className="px-4 py-2 num font-extrabold text-navy-900">{p.net}</td>
                            <td className="px-4 py-2 text-xs num">{p.run_date || '—'}</td>
                            <td className="px-4 py-2"><Printer className="h-4 w-4 text-muted-foreground" /></td>
                          </tr>
                        ))}
                    </Table>
                  </div>
                )}

                {/* 9) الإجازات */}
                {tab === 'leaves' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-lg bg-emerald-50 p-2 ring-1 ring-emerald-200"><div className="text-emerald-600">سنوي متبقٍ</div><div className="num text-lg font-extrabold text-emerald-700">{selBal ? balanceRemaining(selBal).annual : '—'}</div></div>
                      <div className="rounded-lg bg-sky-50 p-2 ring-1 ring-sky-200"><div className="text-sky-600">مرضي متبقٍ</div><div className="num text-lg font-extrabold text-sky-700">{selBal ? balanceRemaining(selBal).sick : '—'}</div></div>
                      <div className="rounded-lg bg-rose-50 p-2 ring-1 ring-rose-200"><div className="text-rose-600">بدون راتب</div><div className="num text-lg font-extrabold text-rose-600">{selBal?.unpaid_days || 0}</div></div>
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-bold text-muted-foreground">طلبات الإجازة (دورة الاعتماد الثلاثية)</div>
                      <Table head={['النوع', 'من', 'إلى', 'الأيام', 'الحالة']}>
                        {empLeaves(sel.no).length === 0 ? <EmptyRow colSpan={5} text="لا توجد طلبات إجازة" /> :
                          empLeaves(sel.no).map((x: any) => (
                            <tr key={x.id}><td className="px-4 py-2 font-bold">{x.leave_type}</td><td className="px-4 py-2 text-xs num">{x.start_date}</td><td className="px-4 py-2 text-xs num">{x.end_date}</td><td className="px-4 py-2 num">{x.days_count}</td><td className="px-4 py-2"><StatusBadge value={x.overall_status} /></td></tr>
                          ))}
                      </Table>
                    </div>
                  </div>
                )}

                {/* 10) الجزاءات والمخالفات */}
                {tab === 'issues' && (
                  <div className="space-y-4">
                    <div>
                      <div className="mb-1 text-xs font-bold text-muted-foreground">مخالفات العمل (مرتبطة بالرقم {sel.no})</div>
                      <Table head={['النوع', 'الوصف', 'المبلغ', 'الحالة', 'التاريخ']}>
                        {workViols.length === 0 && empViolations(sel.name).length === 0 ? <EmptyRow colSpan={5} text="لا توجد مخالفات عمل" /> : [
                          ...workViols.map((v: any) => ({ type: v.violation_type, desc: v.description, amount: v.amount, status: violationStatusLabel(v.status), date: v.recorded_date })),
                          ...empViolations(sel.name).map((v: any) => ({ type: v.type, desc: v.description, amount: v.amount, status: violationStatusLabel(v.status), date: v.date })),
                        ].map((v: any, i: number) => (
                          <tr key={i}><td className="px-4 py-2 font-bold">{v.type}</td><td className="max-w-48 truncate px-4 py-2 text-xs" title={v.desc}>{v.desc || '—'}</td><td className="px-4 py-2 num">{v.amount}</td><td className="px-4 py-2"><StatusBadge value={v.status} /></td><td className="px-4 py-2 text-xs num">{v.date || '—'}</td></tr>
                        ))}
                      </Table>
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-bold text-muted-foreground">المخالفات المرورية</div>
                      <Table head={['النوع', 'الموقع', 'المبلغ', 'النقاط', 'الحالة', 'التاريخ']}>
                        {trafficViols.length === 0 ? <EmptyRow colSpan={6} text="لا توجد مخالفات مرورية" /> :
                          trafficViols.map((t: any) => (
                            <tr key={t.id}><td className="px-4 py-2 font-bold">{t.violation_type}</td><td className="px-4 py-2 text-xs">{t.location || '—'}</td><td className="px-4 py-2 num text-rose-600">{t.amount}</td><td className="px-4 py-2 num">{t.points || 0}</td><td className="px-4 py-2"><StatusBadge value={trafficStatusLabel(t.status)} /></td><td className="px-4 py-2 text-xs num">{t.violation_date}</td></tr>
                          ))}
                      </Table>
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-bold text-muted-foreground">الإنذارات</div>
                      <Table head={['النوع', 'الغياب', 'الحالة', 'الإرسال']}>
                        {empWarnings(sel.no).length === 0 ? <EmptyRow colSpan={4} text="لا توجد إنذارات" /> :
                          empWarnings(sel.no).map((w: any) => (
                            <tr key={w.id}><td className="px-4 py-2 font-bold">{w.warning_type}</td><td className="px-4 py-2 num">{w.absence_days} يوم</td><td className="px-4 py-2"><StatusBadge value={w.letter_status === 'sent' ? 'معتمد' : 'معلق'} /></td><td className="px-4 py-2 text-xs">{w.sent_via ? `${w.sent_via} — ${w.sent_date}` : 'لم يُرسل'}</td></tr>
                          ))}
                      </Table>
                    </div>
                  </div>
                )}

                {/* 11–18) التبويبات الإضافية عبر مكوّن مستقل */}
                {['support', 'transfer', 'confirm', 'letters', 'visits', 'recruit', 'docs', 'audit'].includes(tab) && (
                  <ProfileExtraTabs
                    tab={tab} sel={sel} empSupports={empSupports} transferLetters={transferLetters}
                    confirmLetters={confirmLetters} otherLetters={otherLetters} empVisits={empVisits}
                    recApps={recApps} empDocsAll={empDocs(sel.no)} audits={audits} canEdit={canEdit}
                    onPreview={previewRecFile}
                    onDocPreview={(x: any) => setDocOpen({ type: x.doc_type, emp: sel, saved: x })}
                    onDeleteDoc={async (id: number) => { await deleteHrDoc(id, 'مدير الموارد البشرية'); reload(); }}
                    onAddAttach={() => setAttachOpen(true)}
                    onOcr={() => { setOcrExisting(null); setOcrOpen(true); }}
                    onOcrDoc={(x: any) => {
                      let cj: any = {};
                      try { cj = JSON.parse(x.content_json || '{}'); } catch { cj = {}; }
                      setOcrExisting(cj.file_key ? { file_key: cj.file_key, file_name: cj.file_name || x.doc_type, doc_type: x.doc_type } : null);
                      setOcrOpen(true);
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* معاينة/إصدار المستند — تعبئة تلقائية + تحرير قبل الإصدار */}
      <Modal open={!!docOpen} onClose={() => setDocOpen(null)} title={docOpen?.type} wide>
        {docOpen && (() => {
          const Paper = HR_PAPERS[docOpen.type]?.Comp;
          if (!Paper) return <p className="text-sm text-muted-foreground">النموذج غير متوفر.</p>;
          return (
            <div>
              {docDraft && <DocEditForm value={docDraft} onChange={setDocDraft} />}
              <div className="mt-4">
                <Paper e={docDraft || buildDoc(docOpen.emp)} />
              </div>
              <div className="mt-3 flex justify-end gap-2 no-print">
                <Btn variant="ghost" onClick={() => { setDocOpen(null); setDocDraft(null); }}>إغلاق</Btn>
                <Btn disabled={busy} onClick={issueDoc}><FileText className="h-4 w-4" /> {docOpen.saved?.id ? 'تحديث المستند' : 'إصدار وحفظ في ملف الموظف'}</Btn>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* تفاصيل مسير الراتب */}
      <Modal open={!!paySel} onClose={() => setPaySel(null)} title={'مسير ' + (paySel ? paySel.pay_month + ' ' + paySel.pay_year : '')} wide>
        {paySel ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div className="rounded-lg bg-muted p-2"><div className="text-muted-foreground">الوظيفة</div><div className="font-bold">{paySel.job || '—'}</div></div>
              <div className="rounded-lg bg-muted p-2"><div className="text-muted-foreground">الفرع/المشروع</div><div className="font-bold">{paySel.branch || '—'}</div></div>
              <div className="rounded-lg bg-muted p-2"><div className="text-muted-foreground">رقم المسير</div><div className="font-bold num">{paySel.run_no || '—'}</div></div>
              <div className="rounded-lg bg-muted p-2"><div className="text-muted-foreground">تاريخ الصرف</div><div className="font-bold num">{paySel.run_date || '—'}</div></div>
            </div>
            <div>
              <div className="mb-1 text-xs font-bold text-emerald-700">الاستحقاقات</div>
              <Table head={['البند', 'المبلغ']}>
                {[['الأساسي', 'basic'], ['بدل السكن', 'housing'], ['بدل النقل', 'transport'], ['بدل الطعام', 'food'], ['بدل الجوال', 'mobile'], ['بدل أخرى', 'other_allow'], ['الإضافي', 'overtime'], ['المكافآت', 'bonuses'], ['الإجمالي', 'gross']].map((row: any) => (
                  <tr key={row[0]} className={row[0] === 'الإجمالي' ? 'bg-emerald-50/60 font-bold' : ''}><td className="px-4 py-1.5">{row[0]}</td><td className="px-4 py-1.5 num">{paySel[row[1]] ?? 0}</td></tr>
                ))}
              </Table>
            </div>
            <div>
              <div className="mb-1 text-xs font-bold text-rose-700">الخصومات</div>
              <Table head={['البند', 'المبلغ']}>
                {[['التأمينات', 'insurance_ded'], ['السلف', 'advances'], ['التأخير', 'delay_ded'], ['الانسحاب', 'withdrawal_ded'], ['الغياب', 'absence_ded'], ['إجمالي الخصومات', 'deductions_total']].map((row: any) => (
                  <tr key={row[0]} className={row[0] === 'إجمالي الخصومات' ? 'bg-rose-50/60 font-bold' : ''}><td className="px-4 py-1.5">{row[0]}</td><td className="px-4 py-1.5 num">{paySel[row[1]] ?? 0}</td></tr>
                ))}
              </Table>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-navy-900 px-4 py-3 text-white">
              <span className="font-cairo text-sm font-bold">صافي المستحق</span>
              <span className="num text-xl font-extrabold text-gold-400">{paySel.net} ر.س</span>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* إضافة مرفق */}
      <Modal open={attachOpen} onClose={() => setAttachOpen(false)} title="إضافة مرفق / وثيقة" wide>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="نوع الوثيقة"><Select value={attachForm.doc_type} onChange={(e: any) => setAttachForm({ ...attachForm, doc_type: e.target.value })} options={ATTACH_TYPES.map((t) => ({ value: t, label: t }))} /></Field>
          <Field label="تاريخ الانتهاء (للهوية/الإقامة/العقد/الشهادة)"><TextInput type="date" value={attachForm.doc_date} onChange={(e: any) => setAttachForm({ ...attachForm, doc_date: e.target.value })} /></Field>
        </div>
        <div className="mt-3">
          <Field label="ملف المرفق (اختياري)">
            <input type="file" onChange={async (e: any) => {
              const f = e.target.files?.[0]; if (!f) return;
              const up = await uploadDoc(f, 'hr-attachments');
              setAttachForm((p: any) => ({ ...p, file_key: up.object_key, file_name: up.file_name }));
            }} className="text-sm" />
            {attachForm.file_name && <span className="text-xs text-emerald-700">{attachForm.file_name}</span>}
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <Btn variant="outline" disabled={busy} onClick={() => { setOcrExisting(attachForm.file_key ? { file_key: attachForm.file_key, file_name: attachForm.file_name, doc_type: attachForm.doc_type } : null); setOcrOpen(true); }} className="gap-1 text-xs">
            <ScanText className="h-4 w-4" /> قراءة آلية (OCR)
          </Btn>
          <div className="flex gap-2">
            <Btn variant="ghost" onClick={() => setAttachOpen(false)}>إلغاء</Btn>
            <Btn disabled={busy} onClick={addAttach}>{busy ? 'جارٍ الحفظ...' : 'حفظ'}</Btn>
          </div>
        </div>
      </Modal>

      {/* حركة وظيفية */}
      <Modal open={eventOpen} onClose={() => setEventOpen(false)} title="تسجيل حركة وظيفية">
        <div className="grid grid-cols-1 gap-3">
          <Field label="نوع الحركة"><Select value={eventForm.event_type} onChange={(e: any) => setEventForm({ ...eventForm, event_type: e.target.value })} options={EVENT_TYPES.map((t) => ({ value: t, label: t }))} /></Field>
          <Field label="التاريخ"><TextInput type="date" value={eventForm.event_date} onChange={(e: any) => setEventForm({ ...eventForm, event_date: e.target.value })} /></Field>
          <Field label="التفاصيل"><TextArea value={eventForm.details} onChange={(e: any) => setEventForm({ ...eventForm, details: e.target.value })} /></Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setEventOpen(false)}>إلغاء</Btn>
          <Btn disabled={busy} onClick={addEventSubmit}>{busy ? 'جارٍ الحفظ...' : 'حفظ'}</Btn>
        </div>
      </Modal>

      {/* إضافة مؤهل/خبرة */}
      <Modal open={qualOpen} onClose={() => setQualOpen(false)} title="إضافة مؤهل / خبرة">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="النوع"><Select value={qualForm.qual_type} onChange={(e: any) => setQualForm({ ...qualForm, qual_type: e.target.value })} options={QUAL_TYPES.map((t) => ({ value: t, label: t }))} /></Field>
          <Field label="العنوان (المؤهل/المسمى الوظيفي/الدورة)"><TextInput value={qualForm.title} onChange={(e: any) => setQualForm({ ...qualForm, title: e.target.value })} /></Field>
          <Field label="الجهة/المعهد"><TextInput value={qualForm.institution} onChange={(e: any) => setQualForm({ ...qualForm, institution: e.target.value })} /></Field>
          <Field label="سنوات الخبرة"><TextInput type="number" value={qualForm.years} onChange={(e: any) => setQualForm({ ...qualForm, years: e.target.value })} /></Field>
          <Field label="من تاريخ"><TextInput type="date" value={qualForm.from_date} onChange={(e: any) => setQualForm({ ...qualForm, from_date: e.target.value })} /></Field>
          <Field label="إلى تاريخ"><TextInput type="date" value={qualForm.to_date} onChange={(e: any) => setQualForm({ ...qualForm, to_date: e.target.value })} /></Field>
          <div className="sm:col-span-2"><Field label="ملاحظات"><TextArea value={qualForm.notes} onChange={(e: any) => setQualForm({ ...qualForm, notes: e.target.value })} /></Field></div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setQualOpen(false)}>إلغاء</Btn>
          <Btn disabled={busy} onClick={addQualSubmit}>{busy ? 'جارٍ الحفظ...' : 'حفظ'}</Btn>
        </div>
      </Modal>

      {/* شاشة مراجعة واعتماد القراءة الآلية (OCR) */}
      <OcrReviewModal
        open={ocrOpen}
        onClose={() => { setOcrOpen(false); setOcrExisting(null); }}
        employee={sel}
        actor="مدير الموارد البشرية"
        onDone={() => { reload(); if (sel) fetchLettersByCode(sel.no).then(setLetters); }}
        existing={ocrExisting}
      />
    </div>
  );
}