// صفحة الموارد البشرية — الإجازات والأرصدة والتصفية
// دورة الاعتماد: المشرف ← مدير المنطقة/العمليات ← الموارد البشرية،
// مع ترحيل الإجازة المعتمدة تلقائياً إلى رصيد الموظف وحساب مستحقات نهاية الخدمة.
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import {
  PageToolbar, StatCard, Table, Modal, Field, TextInput, TextArea, Select, Btn,
  EmptyRow, StatusBadge, useToast,
} from '@/components/ui-kit';
import { CalendarDays, Wallet, Scale, Plus, Check, X, Paperclip, Eye, Download } from 'lucide-react';
import {
  LEAVE_TYPES, empKindOf, APPROVAL_STAGES,
  fetchBalances, ensureBalance, balanceRemaining,
  fetchLeaves, createLeave, decideLeave, leaveStage, leaveOverall,
  daysBetween, computeSettlement, uploadDoc, getFileUrl, downloadDoc, todayISO,
} from '@/lib/hr';
import { salaryOf } from '@/lib/seyaj';

export default function Leaves() {
  const { employees, violations } = useStore();
  const toast = useToast();
  const [balances, setBalances] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [kindFilter, setKindFilter] = useState('الكل');
  const [reqOpen, setReqOpen] = useState(false);
  const [decide, setDecide] = useState<any>(null);
  const [settle, setSettle] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<any>({
    empId: '', leave_type: 'إجازة سنوية', start_date: todayISO(), end_date: todayISO(),
    reason: '', attachment_key: '', attachment_name: '',
  });
  const [note, setNote] = useState('');

  const reload = async () => {
    setLoading(true);
    const [b, l] = await Promise.all([fetchBalances(), fetchLeaves()]);
    setBalances(b);
    setLeaves(l);
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  // بذور أرصدة لكل موظف عند أول زيارة
  useEffect(() => {
    (async () => {
      for (const e of employees.slice(0, 12)) {
        await ensureBalance({ no: e.no, name: e.name, kind: empKindOf(e.job), joined: e.joined });
      }
      await reload();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const empById = (id: any) => employees.find((e: any) => String(e.id) === String(id));
  const balFor = (code: string) => balances.find((b: any) => b.employee_code === code);

  const filtered = useMemo(() => {
    const s = q.trim();
    return leaves.filter((l: any) => {
      if (kindFilter !== 'الكل' && l.employee_kind !== kindFilter) return false;
      if (s && !(`${l.employee_name} ${l.employee_code} ${l.leave_type}`.includes(s))) return false;
      return true;
    });
  }, [leaves, q, kindFilter]);

  const pending = leaves.filter((l: any) => leaveOverall(l) === 'معلق').length;
  const approved = leaves.filter((l: any) => leaveOverall(l) === 'معتمد').length;

  const needAttach = form.leave_type === 'إجازة مرضية';
  const days = daysBetween(form.start_date, form.end_date);
  const selEmp = empById(form.empId);
  const selKind = selEmp ? empKindOf(selEmp.job) : 'تشغيلي';

  const submitReq = async () => {
    if (!selEmp) { toast.show('اختر الموظف أولاً'); return; }
    if (days <= 0) { toast.show('تاريخ النهاية يجب أن يكون بعد البداية'); return; }
    const rem = balanceRemaining(balFor(selEmp.no));
    if (form.leave_type === 'إجازة سنوية' && days > rem.annual) { toast.show(`الرصيد السنوي المتبقي ${rem.annual} يوم فقط`); return; }
    if (needAttach && !form.attachment_key) { toast.show('المرفق (تقرير طبي) إلزامي للإجازة المرضية'); return; }
    setBusy(true);
    await createLeave({
      employee_code: selEmp.no, employee_name: selEmp.name, employee_kind: selKind,
      leave_type: form.leave_type, start_date: form.start_date, end_date: form.end_date,
      reason: form.reason, attachment_key: form.attachment_key, attachment_name: form.attachment_name,
    });
    setBusy(false); setReqOpen(false); setNote('');
    toast.show('تم تقديم الطلب — دور المشرف المباشر الآن');
    reload();
  };

  const onAttach = async (f: File | null) => {
    if (!f) return;
    const up = await uploadDoc(f, 'hr-leaves');
    setForm((p: any) => ({ ...p, attachment_key: up.object_key, attachment_name: up.file_name }));
    toast.show('تم رفع المرفق');
  };

  const act = async (decision: 'approved' | 'rejected') => {
    const row = decide;
    const stage = leaveStage(row);
    if (stage === 'done') { toast.show('اكتملت دورة الاعتماد'); return; }
    setBusy(true);
    await decideLeave(row, stage, decision, note || (decision === 'approved' ? 'موافق' : 'غير موافق'), 'مدير النظام');
    setBusy(false); setDecide(null); setNote('');
    toast.show(decision === 'approved' ? 'تم الاعتماد في هذه المرحلة' : 'تم الرفض');
    reload();
  };

  // التصفية — مستحقات نهاية الخدمة
  const [settleEmp, setSettleEmp] = useState<any>(null);
  const [workedDays, setWorkedDays] = useState(15);
  const settleCalc = useMemo(() => {
    if (!settleEmp) return null;
    const b = balFor(settleEmp.no) || {};
    const rem = balanceRemaining({ annual_balance: b.annual_balance, annual_used: b.annual_used });
    const deducted = violations.filter((v: any) => v.employeeName === settleEmp.name && v.status === 'deducted')
      .reduce((s: number, v: any) => s + (v.amount || 0), 0);
    return computeSettlement({
      baseSalary: salaryOf(settleEmp.job), annualRemaining: rem.annual,
      unpaidDays: b.unpaid_days || 0, workedDaysLastMonth: workedDays, violationsDeduct: deducted,
    });
  }, [settleEmp, workedDays, balances, violations]);

  return (
    <div>
      {toast.node}
      <PageToolbar
        title="الإجازات والأرصدة والتصفية"
        subtitle="دورة اعتماد ثلاثية مع ترحيل تلقائي للأرصدة وفق اللائحة المعتمدة"
        actions={
          <>
            <Btn variant="outline" size="sm" onClick={() => setSettle({})}><Scale className="h-4 w-4" /> حاسبة التصفية</Btn>
            <Btn size="sm" onClick={() => setReqOpen(true)}><Plus className="h-4 w-4" /> طلب إجازة</Btn>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="طلبات معلقة" value={pending} icon={<CalendarDays className="h-5 w-5" />} tone="warning" />
        <StatCard title="طلبات معتمدة" value={approved} icon={<Check className="h-5 w-5" />} tone="success" />
        <StatCard title="أرصدة مرصودة" value={balances.length} icon={<Wallet className="h-5 w-5" />} tone="navy" />
        <StatCard title="إجمالي الطلبات" value={leaves.length} icon={<CalendarDays className="h-5 w-5" />} tone="info" />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TextInput placeholder="بحث بالاسم أو الرقم الوظيفي..." value={q} onChange={(e: any) => setQ(e.target.value)} className="w-64" />
        <Select value={kindFilter} onChange={(e: any) => setKindFilter(e.target.value)} options={[
          { value: 'الكل', label: 'كل الأنواع (إداري/تشغيلي)' },
          { value: 'إداري', label: 'إداري' },
          { value: 'تشغيلي', label: 'تشغيلي' },
        ]} />
      </div>

      <Table head={['الموظف', 'النوع', 'الإجازة', 'من - إلى', 'الأيام', 'المشرف', 'العمليات', 'الموارد البشرية', 'الحالة', 'مرفق', 'إجراء']}>
        {loading ? (
          <EmptyRow colSpan={11} text="جارٍ التحميل من الباك-إند..." />
        ) : filtered.length === 0 ? (
          <EmptyRow colSpan={11} />
        ) : filtered.map((l: any) => {
          const stage = leaveStage(l);
          const overall = leaveOverall(l);
          return (
            <tr key={l.id}>
              <td className="px-4 py-2.5 font-bold text-navy-900">{l.employee_name}<div className="text-[10px] font-normal text-muted-foreground">{l.employee_code}</div></td>
              <td className="px-4 py-2.5"><span className={'rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ' + (l.employee_kind === 'إداري' ? 'bg-sky-50 text-sky-700 ring-sky-200' : 'bg-amber-50 text-amber-700 ring-amber-200')}>{l.employee_kind}</span></td>
              <td className="px-4 py-2.5">{l.leave_type}</td>
              <td className="px-4 py-2.5 text-xs">{l.start_date} → {l.end_date}</td>
              <td className="px-4 py-2.5 num font-bold">{l.days_count}</td>
              <td className="px-4 py-2.5"><StatusBadge value={l.supervisor_status === 'approved' ? 'معتمد' : l.supervisor_status === 'rejected' ? 'مرفوض' : 'معلق'} /></td>
              <td className="px-4 py-2.5"><StatusBadge value={l.manager_status === 'approved' ? 'معتمد' : l.manager_status === 'rejected' ? 'مرفوض' : 'معلق'} /></td>
              <td className="px-4 py-2.5"><StatusBadge value={l.hr_status === 'approved' ? 'معتمد' : l.hr_status === 'rejected' ? 'مرفوض' : 'معلق'} /></td>
              <td className="px-4 py-2.5"><StatusBadge value={overall === 'معتمدة' ? 'معتمد' : overall === 'مرفوضة' ? 'مرفوض' : 'معلق'} /></td>
              <td className="px-4 py-2.5">
                {l.attachment_key ? (
                  <div className="flex gap-1">
                    <button title="معاينة" onClick={async () => { const u = await getFileUrl(l.attachment_key); if (u) window.open(u, '_blank'); }} className="rounded p-1 hover:bg-muted"><Eye className="h-3.5 w-3.5" /></button>
                    <button title="تنزيل" onClick={() => downloadDoc(l.attachment_key)} className="rounded p-1 hover:bg-muted"><Download className="h-3.5 w-3.5" /></button>
                  </div>
                ) : <span className="text-xs text-muted-foreground">—</span>}
              </td>
              <td className="px-4 py-2.5">
                {stage !== 'done' ? (
                  <Btn size="sm" variant="outline" onClick={() => { setDecide(l); setNote(''); }}>
                    اعتماد ({APPROVAL_STAGES.find((s) => s.code === stage)?.label})
                  </Btn>
                ) : <span className="text-xs text-muted-foreground">مكتملة</span>}
              </td>
            </tr>
          );
        })}
      </Table>

      {/* أرصدة الموظفين */}
      <h3 className="mb-2 mt-6 font-cairo text-lg font-bold">أرصدة الإجازات حسب الموظف</h3>
      <Table head={['الموظف', 'الرقم الوظيفي', 'النوع', 'سنوي (متبقي/مستحق)', 'مستخدم', 'مرضي (متبقي)', 'بدون راتب']}>
        {balances.length === 0 ? <EmptyRow colSpan={7} text="لا توجد أرصدة بعد" /> : balances.map((b: any) => {
          const rem = balanceRemaining(b);
          return (
            <tr key={b.id}>
              <td className="px-4 py-2.5 font-bold text-navy-900">{b.employee_name}</td>
              <td className="px-4 py-2.5">{b.employee_code}</td>
              <td className="px-4 py-2.5">{b.employee_kind}</td>
              <td className="px-4 py-2.5 num font-bold text-emerald-700">{rem.annual} / {b.annual_balance || 0}</td>
              <td className="px-4 py-2.5 num">{b.annual_used || 0}</td>
              <td className="px-4 py-2.5 num">{rem.sick}</td>
              <td className="px-4 py-2.5 num">{b.unpaid_days || 0}</td>
            </tr>
          );
        })}
      </Table>

      {/* نافذة طلب إجازة */}
      <Modal open={reqOpen} onClose={() => setReqOpen(false)} title="طلب إجازة جديد" wide>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="الموظف">
            <Select value={form.empId} onChange={(e: any) => setForm({ ...form, empId: e.target.value })} options={[
              { value: '', label: '— اختر —' },
              ...employees.map((e: any) => ({ value: String(e.id), label: `${e.name} (${e.no})` })),
            ]} />
          </Field>
          <Field label="فئة الموظف (يحدد نموذج الطلب تلقائياً)">
            <TextInput readOnly value={selEmp ? `${selKind} — ${selEmp.job}` : '—'} />
          </Field>
          <Field label="نوع الإجازة">
            <Select value={form.leave_type} onChange={(e: any) => setForm({ ...form, leave_type: e.target.value })}
              options={LEAVE_TYPES.map((t) => ({ value: t, label: t }))} />
          </Field>
          <Field label="الأيام المحتسبة">
            <TextInput readOnly value={String(days)} />
          </Field>
          <Field label="من تاريخ">
            <TextInput type="date" value={form.start_date} onChange={(e: any) => setForm({ ...form, start_date: e.target.value })} />
          </Field>
          <Field label="إلى تاريخ">
            <TextInput type="date" value={form.end_date} onChange={(e: any) => setForm({ ...form, end_date: e.target.value })} />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="السبب"><TextArea value={form.reason} onChange={(e: any) => setForm({ ...form, reason: e.target.value })} /></Field>
        </div>
        <div className="mt-3">
          <Field label={`المرفق ${needAttach ? '(إلزامي — تقرير طبي)' : '(اختياري)'}`}>
            <div className="flex items-center gap-2">
              <input type="file" onChange={(e: any) => onAttach(e.target.files?.[0] || null)} className="text-sm" />
              {form.attachment_name && <span className="flex items-center gap-1 text-xs text-emerald-700"><Paperclip className="h-3 w-3" />{form.attachment_name}</span>}
            </div>
          </Field>
        </div>
        {selEmp && form.leave_type === 'إجازة سنوية' && (
          <p className="mt-2 text-xs text-muted-foreground">
            المتبقي من رصيدك السنوي: <b className="text-navy-900">{balanceRemaining(balFor(selEmp.no)).annual}</b> يوم —
            سيُخصم عند اعتماد الموارد البشرية.
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setReqOpen(false)}>إلغاء</Btn>
          <Btn disabled={busy} onClick={submitReq}>{busy ? 'جارٍ الحفظ...' : 'إرسال الطلب'}</Btn>
        </div>
      </Modal>

      {/* نافذة القرار */}
      <Modal open={!!decide} onClose={() => setDecide(null)} title="قرار الاعتماد" wide>
        {decide && (() => {
          const stage = leaveStage(decide);
          const st = APPROVAL_STAGES.find((s) => s.code === stage);
          return (
            <div>
              <div className="rounded-lg bg-slate-50 p-3 text-sm ring-1 ring-slate-200">
                <div><b>{decide.employee_name}</b> ({decide.employee_code}) — {decide.employee_kind}</div>
                <div>{decide.leave_type}: {decide.start_date} → {decide.end_date} ({decide.days_count} يوم)</div>
                <div className="mt-1 text-xs text-muted-foreground">السبب: {decide.reason || '—'}</div>
                <div className="mt-2 text-xs font-bold text-navy-900">المرحلة الحالية: {st?.label}</div>
              </div>
              <div className="mt-3"><Field label="ملاحظة القرار"><TextArea value={note} onChange={(e: any) => setNote(e.target.value)} /></Field></div>
              <div className="mt-4 flex justify-end gap-2">
                <Btn variant="danger" disabled={busy} onClick={() => act('rejected')}><X className="h-4 w-4" /> رفض</Btn>
                <Btn variant="success" disabled={busy} onClick={() => act('approved')}><Check className="h-4 w-4" /> اعتماد</Btn>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* حاسبة التصفية */}
      <Modal open={!!settle} onClose={() => setSettle(null)} title="حاسبة التصفية — مستحقات نهاية الخدمة" wide>
        <Field label="الموظف">
          <Select value={settleEmp?.id || ''} onChange={(e: any) => setSettleEmp(employees.find((x: any) => String(x.id) === e.target.value) || null)} options={[
            { value: '', label: '— اختر —' },
            ...employees.map((e: any) => ({ value: String(e.id), label: `${e.name} (${e.no})` })),
          ]} />
        </Field>
        <div className="mt-3"><Field label="أيام العمل في آخر شهر"><TextInput type="number" value={workedDays} onChange={(e: any) => setWorkedDays(Number(e.target.value) || 0)} /></Field></div>
        {settleCalc && (
          <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm ring-1 ring-slate-200">
            <div className="flex justify-between border-b py-1"><span>يومي الراتب</span><b className="num">{settleCalc.daily} SAR</b></div>
            <div className="flex justify-between border-b py-1"><span>بدل إجازات متبقية</span><b className="num text-emerald-700">{settleCalc.leaveValue} SAR</b></div>
            <div className="flex justify-between border-b py-1"><span>أجر آخر شهر</span><b className="num text-emerald-700">{settleCalc.lastMonth} SAR</b></div>
            <div className="flex justify-between border-b py-1"><span>خصم أيام بدون راتب</span><b className="num text-rose-600">-{settleCalc.unpaid} SAR</b></div>
            <div className="flex justify-between py-2 text-base"><span className="font-bold">صافي المستحق</span><b className="num text-navy-900">{settleCalc.total} SAR</b></div>
            <p className="mt-1 text-[11px] text-muted-foreground">يُطبع الصافي ضمن نموذج «مخالصة نهائية» من صفحة ملف الموظف.</p>
          </div>
        )}
        <div className="mt-4 flex justify-end"><Btn variant="ghost" onClick={() => setSettle(null)}>إغلاق</Btn></div>
      </Modal>
    </div>
  );
}