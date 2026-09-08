// صفحة الإدارة المالية «سياج» — مرتبطة مباشرة بالحضور والموارد البشرية
// تبويبات: لوحة المؤشرات | القيود | دورات الدفع لكل موقع/عقد |
// الإسنادات المتعددة (ورديات/مواقع برواتب مختلفة) | الزكاة والضريبة (ZATCA)
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import {
  PageToolbar, StatCard, Table, Modal, Field, TextInput, Select, Btn,
  EmptyRow, StatusBadge, useToast, TextArea,
} from '@/components/ui-kit';
import {
  Wallet, TrendingUp, TrendingDown, Scale, CalendarRange, Users2, Plus,
  Download, Landmark, Building2, ReceiptText, Check, X, Trash2, Printer,
} from 'lucide-react';
import {
  fetchFinanceEntries, createFinanceEntry, deleteFinanceEntry, ENTRY_TYPES,
  REVENUE_CATEGORIES, EXPENSE_CATEGORIES,
  fetchPayCycles, savePayCycle, CYCLE_TYPES, cycleTypeLabel, cycleRange,
  fetchAssignments, saveAssignment, deactivateAssignment, PAY_BASES,
  fetchVatSettings, saveVatSettings, buildVatReport, vatReportCsv, buildEInvoice,
  attendanceDaysFor, computeAssignmentPay, fetchTrafficViolations, trafficDeductionOf,
  type VatSettings,
} from '@/lib/finance';
import { fetchAllAttendance } from '@/lib/backend';
import { fmt, arDate } from '@/lib/seyaj';
import { fetchPayrollRuns } from '@/lib/hr';

const TABS = [
  { code: 'dash', label: 'لوحة المؤشرات' },
  { code: 'entries', label: 'القيود المالية' },
  { code: 'cycles', label: 'دورات الدفع' },
  { code: 'assign', label: 'الإسنادات والورديات' },
  { code: 'vat', label: 'الزكاة والضريبة' },
];

export default function Finance() {
  const { sites, projects, employees } = useStore();
  const toast = useToast();
  const [tab, setTab] = useState('dash');
  const [entries, setEntries] = useState<any[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [assigns, setAssigns] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [traffic, setTraffic] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [vat, setVat] = useState<VatSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [entryOpen, setEntryOpen] = useState(false);
  const [cycleOpen, setCycleOpen] = useState<any>(null);
  const [assignOpen, setAssignOpen] = useState<any>(null);
  const [einv, setEinv] = useState<any>(null);
  const [entryForm, setEntryForm] = useState<any>({});
  const [cycleForm, setCycleForm] = useState<any>({});
  const [assignForm, setAssignForm] = useState<any>({});
  const [vatForm, setVatForm] = useState<VatSettings | null>(null);

  const reload = async () => {
    setLoading(true);
    const [e, c, a, l, t, r, v] = await Promise.all([
      fetchFinanceEntries(), fetchPayCycles(), fetchAssignments(),
      fetchAllAttendance().catch(() => []), fetchTrafficViolations(),
      fetchPayrollRuns(), fetchVatSettings(),
    ]);
    setEntries(e); setCycles(c); setAssigns(a); setLogs(l); setTraffic(t); setRuns(r); setVat(v);
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  // ---------- مؤشرات ----------
  const revenue = entries.filter((e) => e.entry_type === 'revenue').reduce((s, e) => s + (e.amount || 0), 0);
  const expenses = entries.filter((e) => e.entry_type === 'expense').reduce((s, e) => s + (e.amount || 0), 0);
  const payrollDue = runs.filter((r: any) => r.status === 'approved' || r.status === 'draft').reduce((s: number, r: any) => s + (r.total_amount || 0), 0);
  const net = revenue - expenses;

  // دورة موقع: اسم الموقع → كائن الدورة (تقويمية افتراضياً)
  const cycleOf = (siteName: string) =>
    cycles.find((c: any) => c.site_name === siteName && c.active !== false) ||
    { cycle_type: 'calendar', start_day: 1, end_day: 31 };

  // ---------- الاستحقاق المباشر من الحضور ----------
  const accrualRows = useMemo(() => {
    const act = assigns.filter((a: any) => a.active !== false);
    return act.map((a: any) => {
      const cyc = cycleOf(a.site_name);
      const range = cycleRange(cyc);
      const days = attendanceDaysFor(logs, a.employee_code, a.site_name, range);
      const pay = computeAssignmentPay(a, days);
      const tded = trafficDeductionOf(a.employee_code, traffic);
      return { ...a, range: range.label, days, ...pay, tded, net: Math.max(0, Math.round((pay.total - tded) * 100) / 100) };
    });
  }, [assigns, logs, cycles, traffic]);

  const accrualTotal = accrualRows.reduce((s, r) => s + r.net, 0);

  // ---------- إجراءات ----------
  const saveEntry = async () => {
    const f = entryForm;
    if (!f.entry_type || !f.amount || f.amount <= 0) { toast.show('النوع والمبلغ إلزاميان'); return; }
    setBusy(true);
    await createFinanceEntry({
      entry_type: f.entry_type, category: f.category || (f.entry_type === 'revenue' ? REVENUE_CATEGORIES[0] : EXPENSE_CATEGORIES[0]),
      project_name: f.project_name || 'عام', site_name: f.site_name || 'عام',
      amount: Number(f.amount), vat_rate: f.entry_type === 'revenue' ? Number(f.vat_rate ?? 15) : 0,
      invoice_no: f.invoice_no || '', recorded_date: f.recorded_date || new Date().toISOString().slice(0, 10),
      description: f.description || '', created_by: 'مدير النظام',
    }, 'مدير النظام');
    setBusy(false); setEntryOpen(false); setEntryForm({});
    toast.show('سُجّل القيد المالي'); reload();
  };

  const saveCycle = async () => {
    const f = cycleForm;
    if (!f.site_name) { toast.show('اختر الموقع'); return; }
    setBusy(true);
    await savePayCycle({
      id: f.id, site_name: f.site_name, project_name: f.project_name || '',
      cycle_type: f.cycle_type || 'calendar',
      start_day: f.cycle_type === 'custom' ? Number(f.start_day) || 26 : 1,
      end_day: f.cycle_type === 'custom' ? Number(f.end_day) || 25 : 31,
      active: true, notes: f.notes || '', created_by: 'مدير النظام',
    }, 'مدير النظام');
    setBusy(false); setCycleOpen(null);
    toast.show('حُفظت دورة الدفع للموقع'); reload();
  };

  const saveAssign = async () => {
    const f = assignForm;
    const emp = employees.find((e: any) => String(e.id) === String(f.empId));
    if (!emp) { toast.show('اختر الموظف'); return; }
    if (!f.site_name || !f.salary || f.salary <= 0) { toast.show('الموقع والراتب إلزاميان'); return; }
    setBusy(true);
    await saveAssignment({
      id: f.id, employee_code: emp.no, employee_name: emp.name,
      project_name: f.project_name || '', site_name: f.site_name,
      role: f.role || emp.job, shift_period: f.shift_period || 'صباحية',
      pay_basis: f.pay_basis || 'monthly', salary: Number(f.salary),
      overtime_rate: Number(f.overtime_rate) || 0,
      start_date: f.start_date || new Date().toISOString().slice(0, 10),
      end_date: '', active: true, created_by: 'مدير النظام',
    }, 'مدير النظام');
    setBusy(false); setAssignOpen(null);
    toast.show('أُضيف الإسناد — الموظف يعمل الآن على أكثر من موقع/وردية'); reload();
  };

  const saveVat = async () => {
    if (!vatForm) return;
    setBusy(true);
    await saveVatSettings(vatForm, 'مدير النظام');
    setBusy(false); setVat(vatForm);
    toast.show('حُفظت إعدادات الزكاة والضريبة');
  };

  const vatRep = useMemo(() => (vat ? buildVatReport(entries, cycleRange({ cycle_type: 'calendar', start_day: 1, end_day: 31 })) : null), [entries, vat]);

  const siteOptions = sites.map((s: any) => ({ value: s.name, label: s.name }));
  const projOptions = projects.map((p: any) => ({ value: p.name, label: p.name }));

  return (
    <div>
      {toast.node}
      <PageToolbar
        title="الإدارة المالية"
        subtitle="إيرادات العقود والمصروفات مرتبطة مباشرة بالحضور — دورة دفع لكل موقع/عقد، وتعدد الورديات والمواقع برواتب مختلفة، وربط الزكاة والضريبة"
        actions={<Btn size="sm" onClick={() => { setEntryForm({ entry_type: 'revenue', vat_rate: 15, recorded_date: new Date().toISOString().slice(0, 10) }); setEntryOpen(true); }}><Plus className="h-4 w-4" /> قيد جديد</Btn>}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Btn key={t.code} size="sm" variant={tab === t.code ? 'primary' : 'outline'} onClick={() => setTab(t.code)}>{t.label}</Btn>
        ))}
      </div>

      {/* ---------- لوحة المؤشرات ---------- */}
      {tab === 'dash' && (
        <div>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard title="إيرادات العقود" value={fmt(revenue)} hint="SAR" icon={<TrendingUp className="h-5 w-5" />} tone="success" />
            <StatCard title="المصروفات" value={fmt(expenses)} hint="SAR" icon={<TrendingDown className="h-5 w-5" />} tone="danger" />
            <StatCard title="صافي الربح" value={fmt(net)} hint="SAR" icon={<Wallet className="h-5 w-5" />} tone="navy" />
            <StatCard title="التزامات الرواتب" value={fmt(payrollDue)} hint="SAR" icon={<Landmark className="h-5 w-5" />} tone="gold" />
          </div>

          <div className="mb-4 rounded-xl border bg-card p-4">
            <h3 className="mb-1 flex items-center gap-2 font-cairo text-base font-bold"><CalendarRange className="h-4 w-4 text-navy-700" /> نطاق الفترة لكل موقع وفق دورته المعتمدة</h3>
            <p className="mb-3 text-xs text-muted-foreground">بعض العقود تُحسب من 1 إلى 30/31، وبعضها من 26 الشهر الماضي إلى 25 الحالي، والمالية والتقارير العامة من 1 إلى 30.</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {sites.map((s: any) => {
                const cyc = cycleOf(s.name);
                const range = cycleRange(cyc);
                return (
                  <div key={s.id} className="rounded-lg bg-slate-50 p-3 text-xs ring-1 ring-slate-200">
                    <div className="font-bold text-navy-900">{s.name}</div>
                    <div className="mt-0.5 text-muted-foreground">{cycleTypeLabel(cyc.cycle_type)}</div>
                    <div className="mt-1 font-mono font-bold text-navy-700">{range.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-1 flex items-center gap-2 font-cairo text-base font-bold"><Users2 className="h-4 w-4 text-navy-700" /> الاستحقاق المباشر من الحضور (بدون إدخال يدوي)</h3>
            <p className="mb-3 text-xs text-muted-foreground">كل يوم حضور/تغطية/إضافي ضمن دورة موقع الإسناد ينعكس فوراً على الاستحقاق. الموظفون متعددو الورديات والمواقع يظهر لكل إسناد سطر مستقل براتبه المختلف.</p>
            <Table head={['الموظف', 'الموقع', 'الوردية', 'الأساس', 'الراتب', 'أيام حضور', 'الاستحقاق', 'حسم مروري', 'الصافي']}>
              {loading ? <EmptyRow colSpan={9} text="جارٍ التحميل..." /> : accrualRows.length === 0 ? <EmptyRow colSpan={9} text="لا توجد إسنادات نشطة — أضف إسناداً من تبويب الإسنادات" /> :
                accrualRows.map((r: any, i: number) => (
                  <tr key={r.id ?? i} className="hover:bg-muted/40">
                    <td className="px-4 py-2.5 font-bold">{r.employee_name}<div className="text-[10px] font-normal text-muted-foreground">{r.employee_code}</div></td>
                    <td className="px-4 py-2.5 text-xs">{r.site_name}<div className="text-[10px] text-muted-foreground">{r.range}</div></td>
                    <td className="px-4 py-2.5">{r.shift_period}</td>
                    <td className="px-4 py-2.5">{PAY_BASES.find((b) => b.code === r.pay_basis)?.label || r.pay_basis}</td>
                    <td className="px-4 py-2.5 num">{fmt(r.salary)}</td>
                    <td className="px-4 py-2.5 num font-bold text-navy-700">{r.days}</td>
                    <td className="px-4 py-2.5 num">{fmt(r.total)}</td>
                    <td className="px-4 py-2.5 num text-rose-600">{r.tded ? `-${fmt(r.tded)}` : '—'}</td>
                    <td className="px-4 py-2.5 num font-bold">{fmt(r.net)}</td>
                  </tr>
                ))}
            </Table>
            <div className="mt-2 text-left text-sm">
              إجمالي الاستحقاق المحتسب من الحضور: <b className="num text-navy-900">{fmt(accrualTotal)} SAR</b>
            </div>
          </div>
        </div>
      )}

      {/* ---------- القيود ---------- */}
      {tab === 'entries' && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-cairo text-lg font-bold">قيود الإيرادات والمصروفات</h3>
            <Btn size="sm" onClick={() => { setEntryForm({ entry_type: 'revenue', vat_rate: 15, recorded_date: new Date().toISOString().slice(0, 10) }); setEntryOpen(true); }}><Plus className="h-4 w-4" /> قيد</Btn>
          </div>
          <Table head={['النوع', 'التصنيف', 'المشروع', 'الموقع', 'المبلغ', 'ضريبة', 'الصافي', 'الفاتورة', 'التاريخ', 'البيان', 'إجراء']}>
            {loading ? <EmptyRow colSpan={11} text="جارٍ التحميل..." /> : entries.length === 0 ? <EmptyRow colSpan={11} text="لا توجد قيود" /> :
              entries.map((e: any) => (
                <tr key={e.id} className="hover:bg-muted/40">
                  <td className="px-4 py-2.5"><StatusBadge value={e.entry_type === 'revenue' ? 'إيراد' : 'مصروف'} /></td>
                  <td className="px-4 py-2.5 text-xs">{e.category}</td>
                  <td className="px-4 py-2.5 text-xs">{e.project_name || '—'}</td>
                  <td className="px-4 py-2.5 text-xs">{e.site_name || '—'}</td>
                  <td className={`px-4 py-2.5 num font-bold ${e.entry_type === 'revenue' ? 'text-emerald-600' : 'text-rose-600'}`}>{fmt(e.amount)}</td>
                  <td className="px-4 py-2.5 num text-xs">{e.vat_amount ? fmt(e.vat_amount) : '—'}</td>
                  <td className="px-4 py-2.5 num">{fmt(e.net_amount)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{e.invoice_no || '—'}</td>
                  <td className="px-4 py-2.5 text-xs">{e.recorded_date ? arDate(e.recorded_date) : '—'}</td>
                  <td className="max-w-40 truncate px-4 py-2.5 text-xs" title={e.description}>{e.description || '—'}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      {e.entry_type === 'revenue' && <Btn size="sm" variant="ghost" onClick={() => setEinv(buildEInvoice(e, vat!))}><ReceiptText className="h-3.5 w-3.5" /></Btn>}
                      <Btn size="sm" variant="ghost" onClick={async () => { await deleteFinanceEntry(e.id, 'مدير النظام'); toast.show('حُذف القيد'); reload(); }}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Btn>
                    </div>
                  </td>
                </tr>
              ))}
          </Table>
        </div>
      )}

      {/* ---------- دورات الدفع ---------- */}
      {tab === 'cycles' && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-cairo text-lg font-bold">دورة الشهر لكل موقع/عقد</h3>
            <Btn size="sm" onClick={() => { setCycleForm({ cycle_type: 'calendar', start_day: 1, end_day: 31 }); setCycleOpen({}); }}><Plus className="h-4 w-4" /> دورة</Btn>
          </div>
          <Table head={['الموقع', 'المشروع', 'نوع الدورة', 'من', 'إلى', 'الفترة الحالية', 'الحالة', 'إجراء']}>
            {loading ? <EmptyRow colSpan={8} text="جارٍ التحميل..." /> : cycles.length === 0 ? <EmptyRow colSpan={8} text="لم تُحدَّد دورات — المواقع الافتراضية تقويمية (1→30/31)" /> :
              cycles.map((c: any) => {
                const range = cycleRange(c);
                return (
                  <tr key={c.id} className="hover:bg-muted/40">
                    <td className="px-4 py-2.5 font-bold">{c.site_name}</td>
                    <td className="px-4 py-2.5 text-xs">{c.project_name || '—'}</td>
                    <td className="px-4 py-2.5">{cycleTypeLabel(c.cycle_type)}</td>
                    <td className="px-4 py-2.5 num">{c.start_day}</td>
                    <td className="px-4 py-2.5 num">{c.end_day}</td>
                    <td className="px-4 py-2.5 font-mono text-xs font-bold text-navy-700">{range.label}</td>
                    <td className="px-4 py-2.5"><StatusBadge value={c.active !== false ? 'مفعّلة' : 'متوقفة'} /></td>
                    <td className="px-4 py-2.5"><Btn size="sm" variant="outline" onClick={() => { setCycleForm({ ...c }); setCycleOpen(c); }}>تعديل</Btn></td>
                  </tr>
                );
              })}
          </Table>
          <p className="mt-2 text-[11px] text-muted-foreground">المالية والتقارير العامة تُحسب دائماً على دورة 1→30/31، بينما تُطبق دورة كل موقع على الحضور والاستحقاق في المسيرة.</p>
        </div>
      )}

      {/* ---------- الإسنادات ---------- */}
      {tab === 'assign' && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-cairo text-lg font-bold">إسنادات الموظفين — أكثر من وردية وأكثر من موقع براتب مختلف</h3>
            <Btn size="sm" onClick={() => { setAssignForm({ pay_basis: 'monthly', shift_period: 'صباحية' }); setAssignOpen({}); }}><Plus className="h-4 w-4" /> إسناد</Btn>
          </div>
          <Table head={['الموظف', 'الرقم', 'المشروع', 'الموقع', 'الوظيفة', 'الوردية', 'الأساس', 'الراتب', 'إضافي/ساعة', 'من', 'الحالة', 'إجراء']}>
            {loading ? <EmptyRow colSpan={12} text="جارٍ التحميل..." /> : assigns.length === 0 ? <EmptyRow colSpan={12} text="لا توجد إسنادات" /> :
              assigns.map((a: any) => (
                <tr key={a.id} className="hover:bg-muted/40">
                  <td className="px-4 py-2.5 font-bold">{a.employee_name}</td>
                  <td className="px-4 py-2.5">{a.employee_code}</td>
                  <td className="px-4 py-2.5 text-xs">{a.project_name || '—'}</td>
                  <td className="px-4 py-2.5 text-xs">{a.site_name}</td>
                  <td className="px-4 py-2.5 text-xs">{a.role}</td>
                  <td className="px-4 py-2.5">{a.shift_period}</td>
                  <td className="px-4 py-2.5">{PAY_BASES.find((b) => b.code === a.pay_basis)?.label || a.pay_basis}</td>
                  <td className="px-4 py-2.5 num font-bold">{fmt(a.salary)}</td>
                  <td className="px-4 py-2.5 num">{fmt(a.overtime_rate || 0)}</td>
                  <td className="px-4 py-2.5 text-xs">{a.start_date || '—'}</td>
                  <td className="px-4 py-2.5"><StatusBadge value={a.active !== false ? 'نشط' : 'منتهي'} /></td>
                  <td className="px-4 py-2.5">
                    {a.active !== false ? (
                      <Btn size="sm" variant="ghost" onClick={async () => { await deactivateAssignment(a.id, 'مدير النظام'); toast.show('أُنهي الإسناد'); reload(); }}><X className="h-3.5 w-3.5 text-rose-500" /></Btn>
                    ) : <span className="text-[10px] text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
          </Table>
        </div>
      )}

      {/* ---------- الزكاة والضريبة ---------- */}
      {tab === 'vat' && vat && (
        <div>
          <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border bg-card p-4">
              <h3 className="mb-3 flex items-center gap-2 font-cairo text-base font-bold"><Scale className="h-4 w-4 text-navy-700" /> إعدادات الزكاة والضريبة</h3>
              {vatForm ? (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="نسبة ضريبة القيمة المضافة %"><TextInput type="number" value={vatForm.vat_rate} onChange={(e: any) => setVatForm({ ...vatForm, vat_rate: Number(e.target.value) })} /></Field>
                  <Field label="الحالة"><Select value={vatForm.vat_registered ? 'yes' : 'no'} onChange={(e: any) => setVatForm({ ...vatForm, vat_registered: e.target.value === 'yes' })} options={[{ value: 'yes', label: 'واعٍ (مسجل)' }, { value: 'no', label: 'غير واعٍ' }]} /></Field>
                  <Field label="الرقم الضريبي ZATCA"><TextInput value={vatForm.company_tax_id} onChange={(e: any) => setVatForm({ ...vatForm, company_tax_id: e.target.value })} /></Field>
                  <Field label="رقم شهادة الزكاة"><TextInput value={vatForm.company_zakat_cert_no} onChange={(e: any) => setVatForm({ ...vatForm, company_zakat_cert_no: e.target.value })} /></Field>
                  <Field label="نسبة الزكاة %"><TextInput type="number" value={vatForm.zakat_rate} onChange={(e: any) => setVatForm({ ...vatForm, zakat_rate: Number(e.target.value) })} /></Field>
                  <Field label="وضع الفوترة"><Select value={vatForm.einvoice_mode} onChange={(e: any) => setVatForm({ ...vatForm, einvoice_mode: e.target.value })} options={[{ value: 'simulation', label: 'محاكاة (حالياً)' }, { value: 'live', label: 'ربط فعلي (يحتاج مفاتيح)' }]} /></Field>
                  <div className="col-span-2 flex justify-end gap-2">
                    <Btn variant="ghost" onClick={() => setVatForm(null)}>إلغاء</Btn>
                    <Btn disabled={busy} onClick={saveVat}>{busy ? 'حفظ...' : 'حفظ الإعدادات'}</Btn>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">نسبة الضريبة</span><b className="num">{vat.vat_rate}%</b></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">الحالة الضريبية</span><b>{vat.vat_registered ? 'واعٍ — مسجل' : 'غير واعٍ'}</b></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">الرقم الضريبي</span><b className="font-mono">{vat.company_tax_id}</b></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">شهادة الزكاة</span><b className="font-mono">{vat.company_zakat_cert_no}</b></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">نسبة الزكاة</span><b className="num">{vat.zakat_rate}%</b></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">الفوترة الإلكترونية</span><b>{vat.einvoice_mode === 'simulation' ? 'محاكاة' : 'ربط فعلي'}</b></div>
                  <Btn size="sm" variant="outline" className="mt-2" onClick={() => setVatForm({ ...vat })}>تعديل الإعدادات</Btn>
                </div>
              )}
            </div>

            <div className="rounded-xl border bg-card p-4">
              <h3 className="mb-3 flex items-center gap-2 font-cairo text-base font-bold"><ReceiptText className="h-4 w-4 text-navy-700" /> التقرير الضريبي/الزكاتي — الشهر الحالي</h3>
              {vatRep && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">الفترة</span><b className="font-mono text-xs">{vatRep.range.start} ← {vatRep.range.end}</b></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">عدد الفواتير</span><b className="num">{vatRep.count}</b></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">إجمالي الفواتير (شامل)</span><b className="num">{fmt(vatRep.total)} SAR</b></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">ضريبة المخرجات</span><b className="num text-rose-600">{fmt(vatRep.vat)} SAR</b></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">صافي المبيعات</span><b className="num text-emerald-600">{fmt(vatRep.net)} SAR</b></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">مبيعات خاضعة 15%</span><b className="num">{fmt(vatRep.standard)} SAR</b></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">مبيعات صفرية/معفاة</span><b className="num">{fmt(vatRep.zeroRated)} SAR</b></div>
                  <div className="mt-3 flex gap-2">
                    <Btn size="sm" onClick={() => { const blob = vatReportCsv(vatRep, vat); const url = URL.createObjectURL(new Blob(['\ufeff' + blob], { type: 'text/csv' })); const a = document.createElement('a'); a.href = url; a.download = `vat-report-${vatRep.range.start}.csv`; a.click(); URL.revokeObjectURL(url); toast.show('صُدِّر التقرير الضريبي'); }}><Download className="h-4 w-4" /> تصدير CSV</Btn>
                    <Btn size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> طباعة</Btn>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">التقرير بصيغة جاهزة للفوترة الإلكترونية (ZATCA) — محاكاة كاملة الآن، والبنية جاهزة للربط الفعلي عند تزويد مفاتيح هيئة الزكاة والدخل.</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-2 font-cairo text-base font-bold">الفواتير الإلكترونية الصادرة (ZATCA)</h3>
            <Table head={['رقم الفاتورة', 'المشروع', 'الموقع', 'التاريخ', 'الإجمالي', 'الضريبة', 'الصافي', 'QR', 'حالة']}>
              {vatRep && vatRep.invoices.length ? vatRep.invoices.map((e: any) => (
                <tr key={e.id} className="hover:bg-muted/40">
                  <td className="px-4 py-2.5 font-mono text-xs">{e.invoice_no || '—'}</td>
                  <td className="px-4 py-2.5 text-xs">{e.project_name}</td>
                  <td className="px-4 py-2.5 text-xs">{e.site_name}</td>
                  <td className="px-4 py-2.5 text-xs">{e.recorded_date}</td>
                  <td className="px-4 py-2.5 num">{fmt(e.amount)}</td>
                  <td className="px-4 py-2.5 num text-rose-600">{fmt(e.vat_amount)}</td>
                  <td className="px-4 py-2.5 num font-bold">{fmt(e.net_amount)}</td>
                  <td className="px-4 py-2.5"><Btn size="sm" variant="ghost" onClick={() => setEinv(buildEInvoice(e, vat))}><ReceiptText className="h-4 w-4" /></Btn></td>
                  <td className="px-4 py-2.5"><StatusBadge value={vat.einvoice_mode === 'simulation' ? 'محاكاة' : 'مبلغة'} /></td>
                </tr>
              )) : <EmptyRow colSpan={9} text="لا توجد فواتير إيرادات في الفترة" />}
            </Table>
          </div>
        </div>
      )}

      {/* ---------- نوافذ ---------- */}
      <Modal open={entryOpen} onClose={() => setEntryOpen(false)} title="قيد مالي جديد" wide>
        <div className="grid grid-cols-2 gap-3">
          <Field label="النوع"><Select value={entryForm.entry_type || 'revenue'} onChange={(e: any) => setEntryForm({ ...entryForm, entry_type: e.target.value })} options={ENTRY_TYPES.map((t) => ({ value: t.code, label: t.label }))} /></Field>
          <Field label="التصنيف"><Select value={entryForm.category || ''} onChange={(e: any) => setEntryForm({ ...entryForm, category: e.target.value })} options={(entryForm.entry_type === 'expense' ? EXPENSE_CATEGORIES : REVENUE_CATEGORIES).map((c) => ({ value: c, label: c }))} /></Field>
          <Field label="المشروع"><Select value={entryForm.project_name || ''} onChange={(e: any) => setEntryForm({ ...entryForm, project_name: e.target.value })} options={[{ value: 'عام', label: 'عام' }, ...projOptions]} /></Field>
          <Field label="الموقع"><Select value={entryForm.site_name || ''} onChange={(e: any) => setEntryForm({ ...entryForm, site_name: e.target.value })} options={[{ value: 'عام', label: 'عام' }, ...siteOptions]} /></Field>
          <Field label="المبلغ ر.س"><TextInput type="number" value={entryForm.amount || ''} onChange={(e: any) => setEntryForm({ ...entryForm, amount: Number(e.target.value) })} /></Field>
          {entryForm.entry_type !== 'expense' && (
            <Field label="نسبة الضريبة %"><TextInput type="number" value={entryForm.vat_rate ?? 15} onChange={(e: any) => setEntryForm({ ...entryForm, vat_rate: Number(e.target.value) })} /></Field>
          )}
          <Field label="رقم الفاتورة"><TextInput value={entryForm.invoice_no || ''} onChange={(e: any) => setEntryForm({ ...entryForm, invoice_no: e.target.value })} placeholder="INV-2026-..." /></Field>
          <Field label="التاريخ"><TextInput type="date" value={entryForm.recorded_date || ''} onChange={(e: any) => setEntryForm({ ...entryForm, recorded_date: e.target.value })} /></Field>
          <div className="col-span-2"><Field label="البيان"><TextArea value={entryForm.description || ''} onChange={(e: any) => setEntryForm({ ...entryForm, description: e.target.value })} /></Field></div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setEntryOpen(false)}>إلغاء</Btn>
          <Btn disabled={busy} onClick={saveEntry}>{busy ? 'حفظ...' : 'حفظ القيد'}</Btn>
        </div>
      </Modal>

      <Modal open={!!cycleOpen} onClose={() => setCycleOpen(null)} title="دورة دفع الموقع">
        <div className="grid grid-cols-2 gap-3">
          <Field label="الموقع"><Select value={cycleForm.site_name || ''} onChange={(e: any) => { const s = sites.find((x: any) => x.name === e.target.value); setCycleForm({ ...cycleForm, site_name: e.target.value, project_name: s ? (projects.find((p: any) => p.siteId === s.id)?.name || '') : '' }); }} options={[{ value: '', label: '— اختر —' }, ...siteOptions]} /></Field>
          <Field label="نوع الدورة"><Select value={cycleForm.cycle_type || 'calendar'} onChange={(e: any) => setCycleForm({ ...cycleForm, cycle_type: e.target.value })} options={CYCLE_TYPES.map((t) => ({ value: t.code, label: t.label }))} /></Field>
          {cycleForm.cycle_type === 'custom' && (
            <>
              <Field label="من يوم (مثال 26)"><TextInput type="number" value={cycleForm.start_day ?? 26} onChange={(e: any) => setCycleForm({ ...cycleForm, start_day: Number(e.target.value) })} /></Field>
              <Field label="إلى يوم (مثال 25)"><TextInput type="number" value={cycleForm.end_day ?? 25} onChange={(e: any) => setCycleForm({ ...cycleForm, end_day: Number(e.target.value) })} /></Field>
            </>
          )}
          <div className="col-span-2"><Field label="ملاحظة العقد"><TextInput value={cycleForm.notes || ''} onChange={(e: any) => setCycleForm({ ...cycleForm, notes: e.target.value })} /></Field></div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setCycleOpen(null)}>إلغاء</Btn>
          <Btn disabled={busy} onClick={saveCycle}>{busy ? 'حفظ...' : 'حفظ الدورة'}</Btn>
        </div>
      </Modal>

      <Modal open={!!assignOpen} onClose={() => setAssignOpen(null)} title="إسناد موظف — موقع/وردية/راتب" wide>
        <div className="grid grid-cols-2 gap-3">
          <Field label="الموظف"><Select value={assignForm.empId || ''} onChange={(e: any) => { const emp = employees.find((x: any) => String(x.id) === e.target.value); setAssignForm({ ...assignForm, empId: e.target.value, role: emp?.job || '', project_name: emp ? (projects.find((p: any) => p.id === emp.projectId)?.name || '') : '' }); }} options={[{ value: '', label: '— اختر —' }, ...employees.map((e: any) => ({ value: String(e.id), label: `${e.name} (${e.no})` }))]} /></Field>
          <Field label="الموقع"><Select value={assignForm.site_name || ''} onChange={(e: any) => setAssignForm({ ...assignForm, site_name: e.target.value })} options={[{ value: '', label: '— اختر —' }, ...siteOptions]} /></Field>
          <Field label="المشروع"><Select value={assignForm.project_name || ''} onChange={(e: any) => setAssignForm({ ...assignForm, project_name: e.target.value })} options={[{ value: '', label: '— اختر —' }, ...projOptions]} /></Field>
          <Field label="الوظيفة"><TextInput value={assignForm.role || ''} onChange={(e: any) => setAssignForm({ ...assignForm, role: e.target.value })} /></Field>
          <Field label="الوردية"><Select value={assignForm.shift_period || 'صباحية'} onChange={(e: any) => setAssignForm({ ...assignForm, shift_period: e.target.value })} options={['صباحية', 'مسائية', 'ليلية'].map((s) => ({ value: s, label: s }))} /></Field>
          <Field label="أساس الراتب"><Select value={assignForm.pay_basis || 'monthly'} onChange={(e: any) => setAssignForm({ ...assignForm, pay_basis: e.target.value })} options={PAY_BASES.map((b) => ({ value: b.code, label: b.label }))} /></Field>
          <Field label="الراتب ر.س"><TextInput type="number" value={assignForm.salary || ''} onChange={(e: any) => setAssignForm({ ...assignForm, salary: Number(e.target.value) })} /></Field>
          <Field label="بدل إضافي/ساعة"><TextInput type="number" value={assignForm.overtime_rate || 0} onChange={(e: any) => setAssignForm({ ...assignForm, overtime_rate: Number(e.target.value) })} /></Field>
          <Field label="تاريخ البدء"><TextInput type="date" value={assignForm.start_date || ''} onChange={(e: any) => setAssignForm({ ...assignForm, start_date: e.target.value })} /></Field>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">يمكن للموظف الواحد امتلاك عدة إسنادات نشطة — كل إسناد براتبه المختلف حسب موقعه وورديته، ويظهر كل إسناد في كشف الراتب تفصيلياً.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setAssignOpen(null)}>إلغاء</Btn>
          <Btn disabled={busy} onClick={saveAssign}>{busy ? 'حفظ...' : 'حفظ الإسناد'}</Btn>
        </div>
      </Modal>

      <Modal open={!!einv} onClose={() => setEinv(null)} title="الفاتورة الإلكترونية — ZATCA (محاكاة)" wide>
        {einv && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-xs ring-1 ring-slate-200">
              <div><div className="text-slate-400">رقم الفاتورة</div><div className="font-mono font-bold">{einv.invoiceNo}</div></div>
              <div><div className="text-slate-400">التاريخ</div><div className="font-bold">{einv.date}</div></div>
              <div><div className="text-slate-400">البائع</div><div className="font-bold">{einv.seller}</div></div>
              <div><div className="text-slate-400">الرقم الضريبي</div><div className="font-mono font-bold">{einv.vatNo}</div></div>
              <div><div className="text-slate-400">شهادة الزكاة</div><div className="font-mono font-bold">{einv.certNo}</div></div>
              <div><div className="text-slate-400">الإصدار</div><div className="font-bold">{einv.version}</div></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded border border-slate-300 p-2 text-center"><div className="text-slate-400">الإجمالي</div><div className="font-bold num">{fmt(einv.total)}</div></div>
              <div className="rounded border border-slate-300 p-2 text-center"><div className="text-slate-400">الضريبة</div><div className="font-bold num text-rose-600">{fmt(einv.vat)}</div></div>
              <div className="rounded border border-slate-300 p-2 text-center"><div className="text-slate-400">الصافي</div><div className="font-bold num text-emerald-600">{fmt(einv.net)}</div></div>
            </div>
            <div className="rounded border border-slate-300 p-3">
              <div className="mb-1 text-xs text-slate-400">رمز QR (TLV) للفوترة الإلكترونية — وضع: {einv.mode === 'simulation' ? 'محاكاة' : 'فعلي'}</div>
              <div className="break-all font-mono text-[10px] leading-relaxed text-navy-900">{einv.qr}</div>
              <div className="mt-2 text-[10px] text-slate-400">Hash: {einv.hash}</div>
            </div>
            <p className="text-[11px] text-muted-foreground">البنية جاهزة للربط الفعلي مع منصة فاتورة عبر API هيئة الزكاة والدخل عند توفير المفاتيح — حالياً كل العمليات محاكاة كاملة داخل النظام.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
