import { useEffect, useState } from 'react';
import { Users, UserCheck, UserX, AlarmClock, LogIn, LogOut, Plane, Stethoscope, CalendarDays, Printer, Download, RefreshCw, ClipboardList, ShieldCheck, AlertTriangle } from 'lucide-react';
import { PageToolbar, StatCard, Modal, Btn, Field } from '@/components/ui-kit';
import { fetchSummary, fetchAttendanceDetails, fetchLeaveDetails, fetchBalances, fetchEmployeeReport, fetchDashboardOptions, exportRowsExcel, printDashboardArea, ATT_STATUS_LABEL } from '@/lib/hrDashboard';

const PERIODS = [{ key: 'today', label: 'اليوم' }, { key: 'week', label: 'الأسبوع' }, { key: 'month', label: 'الشهر' }, { key: 'custom', label: 'فترة مخصصة' }];
const inputCls = 'h-9 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring';

function fmt(n) { return Number(n || 0).toLocaleString('ar-EG'); }
function statusColor(s) {
  if (s === 'معتمدة') return 'bg-emerald-100 text-emerald-700';
  if (s === 'معلقة') return 'bg-amber-100 text-amber-700';
  if (s === 'مرفوضة') return 'bg-rose-100 text-rose-700';
  return 'bg-slate-100 text-slate-600';
}

export default function HrDashboard() {
  const [filters, setFilters] = useState({ period: 'month', date_from: '', date_to: '', department: '', project_name: '', site_name: '', employee_code: '' });
  const [opts, setOpts] = useState({ departments: [], projects: [], sites: [], employees: [], years: [] });
  const [summary, setSummary] = useState(null);
  const [balances, setBalances] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attModal, setAttModal] = useState({ open: false, label: '', rows: [], loading: false });
  const [leaveModal, setLeaveModal] = useState({ open: false, title: '', rows: [], loading: false });
  const [empModal, setEmpModal] = useState({ open: false, data: null, loading: false, code: '' });

  function setF(k, v) { setFilters((f) => ({ ...f, [k]: v })); }

  async function loadAll() {
    setLoading(true); setError('');
    try {
      setSummary(await fetchSummary(filters));
      const b = await fetchBalances({ ...filters, year });
      setBalances((b && b.rows) || []);
    } catch (e) { setError(String((e && e.message) || e || 'تعذر تحميل بيانات اللوحة')); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    fetchDashboardOptions().then((o) => { if (o) { setOpts(o); if (o.years && o.years.length) setYear(o.years[0]); } }).catch(() => {});
  }, []);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.period, filters.date_from, filters.date_to, filters.department, filters.project_name, filters.site_name, filters.employee_code, year]);

  async function openAtt(cat) {
    setAttModal({ open: true, label: '', rows: [], loading: true });
    try { const d = await fetchAttendanceDetails(cat, filters); setAttModal({ open: true, label: (d && d.label) || cat, rows: (d && d.rows) || [], loading: false }); }
    catch (e) { setAttModal({ open: true, label: cat, rows: [], loading: false }); setError(String((e && e.message) || e)); }
  }
  async function openLeave(type, status, title) {
    setLeaveModal({ open: true, title, rows: [], loading: true });
    try { const d = await fetchLeaveDetails(type, status, filters); setLeaveModal({ open: true, title, rows: (d && d.rows) || [], loading: false }); }
    catch (e) { setLeaveModal({ open: true, title, rows: [], loading: false }); setError(String((e && e.message) || e)); }
  }
  async function openEmp(code) {
    setEmpModal({ open: true, data: null, loading: true, code });
    try { const d = await fetchEmployeeReport(code, year); setEmpModal({ open: true, data: d, loading: false, code }); }
    catch (e) { setEmpModal({ open: true, data: null, loading: false, code }); setError(String((e && e.message) || e)); }
  }

  function exportExcel() {
    const at = (summary && summary.attendance) || {}; const lv = (summary && summary.leaves) || {};
    const balCols = [{ key: 'name', label: 'الموظف' }, { key: 'department', label: 'القسم' }, { key: 'annual_balance', label: 'رصيد سنوي' }, { key: 'annual_used', label: 'مستخدم' }, { key: 'annual_remaining', label: 'متبقي' }, { key: 'sick_used', label: 'مرضي مستخدم' }, { key: 'sick_times_period', label: 'مرات مرضية' }, { key: 'unpaid_days', label: 'بدون راتب' }];
    const summaryRows = [
      { k: 'إجمالي الموظفين', v: (summary && summary.headcount) || 0 }, { k: 'حاضرون', v: at.present || 0 }, { k: 'غائبون', v: at.absent || 0 },
      { k: 'متأخرون', v: at.late || 0 }, { k: 'غياب بعذر', v: at.excused || 0 }, { k: 'غياب بدون عذر', v: at.unexcused || 0 },
      { k: 'أذونات', v: at.permission || 0 }, { k: 'أيام سنوية', v: (lv.annual && lv.annual.days) || 0 }, { k: 'أيام مرضية', v: (lv.sick && lv.sick.days) || 0 }];
    exportRowsExcel('hr-dashboard', [
      { name: 'ملخص', cols: [{ key: 'k', label: 'البند' }, { key: 'v', label: 'القيمة' }], rows: summaryRows },
      { name: 'الأرصدة', cols: balCols, rows: balances }]);
  }

  const a = (summary && summary.attendance) || { present: 0, late: 0, absent: 0, excused: 0, unexcused: 0, checkin: 0, checkout: 0, permission: 0, onleave: 0 };
  const l = (summary && summary.leaves) || { annual: { total: 0, pending: 0, approved: 0, rejected: 0, days: 0 }, sick: { total: 0, pending: 0, approved: 0, rejected: 0, days: 0 }, permission: { total: 0, pending: 0, approved: 0, rejected: 0, days: 0 }, other: { total: 0, pending: 0, approved: 0, rejected: 0, days: 0 }, all: { total: 0, pending: 0, approved: 0, rejected: 0, days: 0 } };
  const pendingTotal = ((l.all && l.all.pending) || 0) + ((l.sick && l.sick.pending) || 0) + ((l.permission && l.permission.pending) || 0);
  const attCards = [
    { t: 'الحاضرون', v: a.present, i: <UserCheck className="h-5 w-5" />, tone: 'success', cat: 'present' },
    { t: 'الغائبون', v: a.absent, i: <UserX className="h-5 w-5" />, tone: 'danger', cat: 'absent' },
    { t: 'المتأخرون', v: a.late, i: <AlarmClock className="h-5 w-5" />, tone: 'warning', cat: 'late' },
    { t: 'تسجيلات الحضور', v: a.checkin, i: <LogIn className="h-5 w-5" />, tone: 'info', cat: 'checkin' },
    { t: 'تسجيلات الانصراف', v: a.checkout, i: <LogOut className="h-5 w-5" />, tone: 'navy', cat: 'checkout' },
    { t: 'غياب بعذر', v: a.excused, i: <ShieldCheck className="h-5 w-5" />, tone: 'info', cat: 'excused' },
    { t: 'غياب بدون عذر', v: a.unexcused, i: <AlertTriangle className="h-5 w-5" />, tone: 'danger', cat: 'unexcused' },
    { t: 'الأذونات', v: a.permission, i: <CalendarDays className="h-5 w-5" />, tone: 'gold', cat: 'permission' }];
  const leaveCards = [
    { t: 'الإجازات السنوية', d: l.annual, i: <Plane className="h-5 w-5" />, cls: 'from-navy-900 to-navy-700 text-gold-400', type: 'annual' },
    { t: 'الإجازات المرضية', d: l.sick, i: <Stethoscope className="h-5 w-5" />, cls: 'from-sky-600 to-sky-500 text-white', type: 'sick' },
    { t: 'الأذونات', d: l.permission, i: <CalendarDays className="h-5 w-5" />, cls: 'from-gold-500 to-gold-600 text-navy-950', type: 'permission' },
    { t: 'بقية الإجازات', d: l.other, i: <ClipboardList className="h-5 w-5" />, cls: 'from-amber-500 to-amber-600 text-white', type: 'other' }];
  const attBars = [
    { t: 'حاضر', v: a.present, c: 'bg-emerald-500' }, { t: 'متأخر', v: a.late, c: 'bg-amber-500' },
    { t: 'غائب', v: a.absent, c: 'bg-rose-500' }, { t: 'بعذر', v: a.excused, c: 'bg-sky-500' },
    { t: 'بدون عذر', v: a.unexcused, c: 'bg-indigo-600' }, { t: 'إذن', v: a.permission, c: 'bg-navy-900' }];
  const maxAtt = Math.max(1, a.present, a.late, a.absent, a.excused, a.unexcused, a.permission);
  const leaveBars = [
    { t: 'سنوية', v: (l.annual && l.annual.days) || 0, c: 'bg-navy-900' }, { t: 'مرضية', v: (l.sick && l.sick.days) || 0, c: 'bg-sky-500' },
    { t: 'أذونات', v: (l.permission && l.permission.days) || 0, c: 'bg-amber-500' }, { t: 'أخرى', v: (l.other && l.other.days) || 0, c: 'bg-indigo-600' }];
  const maxLeave = Math.max(1, (l.annual && l.annual.days) || 0, (l.sick && l.sick.days) || 0, (l.permission && l.permission.days) || 0, (l.other && l.other.days) || 0);

  return (
    <div dir="rtl" className="space-y-5">
      <PageToolbar title="لوحة الموارد البشرية" subtitle="متابعة الحضور والإجازات والأذونات والأرصدة من البيانات الفعلية" actions={
        <div className="flex flex-wrap items-center gap-2">
          <Btn variant="outline" size="sm" onClick={loadAll}><RefreshCw className="ml-1 h-4 w-4" />تحديث</Btn>
          <Btn variant="outline" size="sm" onClick={exportExcel}><Download className="ml-1 h-4 w-4" />Excel</Btn>
          <Btn variant="primary" size="sm" onClick={() => printDashboardArea()}><Printer className="ml-1 h-4 w-4" />طباعة / PDF</Btn>
        </div>} />
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div> : null}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="الفترة"><select className={inputCls} value={filters.period} onChange={(e) => setF('period', e.target.value)}>{PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select></Field>
          {filters.period === 'custom' ? <Field label="من"><input type="date" className={inputCls} value={filters.date_from} onChange={(e) => setF('date_from', e.target.value)} /></Field> : null}
          {filters.period === 'custom' ? <Field label="إلى"><input type="date" className={inputCls} value={filters.date_to} onChange={(e) => setF('date_to', e.target.value)} /></Field> : null}
          <Field label="القسم"><select className={inputCls} value={filters.department} onChange={(e) => setF('department', e.target.value)}><option value="">الكل</option>{(opts.departments || []).map((x) => <option key={x} value={x}>{x}</option>)}</select></Field>
          <Field label="المشروع"><select className={inputCls} value={filters.project_name} onChange={(e) => setF('project_name', e.target.value)}><option value="">الكل</option>{(opts.projects || []).map((x) => <option key={x} value={x}>{x}</option>)}</select></Field>
          <Field label="الموقع"><select className={inputCls} value={filters.site_name} onChange={(e) => setF('site_name', e.target.value)}><option value="">الكل</option>{(opts.sites || []).map((x) => <option key={x} value={x}>{x}</option>)}</select></Field>
          <Field label="الموظف"><select className={inputCls} value={filters.employee_code} onChange={(e) => setF('employee_code', e.target.value)}><option value="">الكل</option>{(opts.employees || []).map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></Field>
          <Field label="السنة"><select className={inputCls} value={String(year)} onChange={(e) => setYear(Number(e.target.value))}>{(opts.years && opts.years.length ? opts.years : [year]).map((y) => <option key={y} value={y}>{y}</option>)}</select></Field>
        </div>
        {summary ? <div className="mt-2 text-xs text-muted-foreground">النطاق: {(summary.range && summary.range.from) || ''} — {(summary.range && summary.range.to) || ''} • إجمالي الموظفين: {fmt(summary.headcount)}</div> : null}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard title="إجمالي الموظفين" value={fmt((summary && summary.headcount) || 0)} icon={<Users className="h-5 w-5" />} tone="navy" />
        <StatCard title="أيام سنوية معتمدة" value={fmt((l.annual && l.annual.days) || 0)} hint={'طلبات: ' + fmt((l.annual && l.annual.total) || 0)} icon={<Plane className="h-5 w-5" />} tone="info" />
        <StatCard title="أيام مرضية معتمدة" value={fmt((l.sick && l.sick.days) || 0)} hint={'طلبات: ' + fmt((l.sick && l.sick.total) || 0)} icon={<Stethoscope className="h-5 w-5" />} tone="warning" />
        <StatCard title="طلبات معلّقة" value={fmt(pendingTotal)} icon={<ClipboardList className="h-5 w-5" />} tone="danger" />
      </div>
      <div>
        <h3 className="mb-2 font-cairo text-sm font-bold">الحضور والغياب — انقر أي بطاقة لعرض التفاصيل</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {attCards.map((c) => (
            <button key={c.t} type="button" onClick={() => openAtt(c.cat)} className="text-right transition hover:shadow-md">
              <StatCard title={c.t} value={fmt(c.v)} icon={c.i} tone={c.tone} />
            </button>))}
        </div>
      </div>
      <div>
        <h3 className="mb-2 font-cairo text-sm font-bold">الإجازات والأذونات — انقر لعرض الطلبات</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {leaveCards.map((c) => (
            <div key={c.t} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-muted-foreground">{c.t}</div>
                <div className={'flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ' + c.cls}>{c.i}</div>
              </div>
              <div className="mt-1 font-cairo text-2xl font-extrabold num">{fmt((c.d && c.d.days) || 0)}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{fmt((c.d && c.d.total) || 0)} طلب</div>
              <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
                <button type="button" onClick={() => openLeave(c.type, '', c.t + ' — الكل')} className="rounded bg-slate-100 px-1.5 py-0.5 hover:bg-slate-200">الكل {fmt((c.d && c.d.total) || 0)}</button>
                <button type="button" onClick={() => openLeave(c.type, 'معلقة', c.t + ' — معلقة')} className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700 hover:bg-amber-200">معلقة {fmt((c.d && c.d.pending) || 0)}</button>
                <button type="button" onClick={() => openLeave(c.type, 'معتمدة', c.t + ' — معتمدة')} className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700 hover:bg-emerald-200">معتمدة {fmt((c.d && c.d.approved) || 0)}</button>
                <button type="button" onClick={() => openLeave(c.type, 'مرفوضة', c.t + ' — مرفوضة')} className="rounded bg-rose-100 px-1.5 py-0.5 text-rose-700 hover:bg-rose-200">مرفوضة {fmt((c.d && c.d.rejected) || 0)}</button>
              </div>
            </div>))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="mb-3 font-cairo text-sm font-bold">توزيع حالات الحضور</h3>
          <div className="space-y-2">
            {attBars.map((b) => (
              <div key={b.t} className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-xs text-muted-foreground">{b.t}</span>
                <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
                  <div className={'h-full ' + b.c} style={{ width: (b.v / maxAtt * 100) + '%' }} />
                </div>
                <span className="num w-10 shrink-0 text-left text-xs font-bold">{fmt(b.v)}</span>
              </div>))}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="mb-3 font-cairo text-sm font-bold">أيام الإجازات حسب النوع</h3>
          <div className="space-y-2">
            {leaveBars.map((b) => (
              <div key={b.t} className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-xs text-muted-foreground">{b.t}</span>
                <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
                  <div className={'h-full ' + b.c} style={{ width: (b.v / maxLeave * 100) + '%' }} />
                </div>
                <span className="num w-10 shrink-0 text-left text-xs font-bold">{fmt(b.v)}</span>
              </div>))}
          </div>
        </div>
      </div>
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-cairo text-sm font-bold">أرصدة الإجازات ({year})</h3>
          <span className="text-xs text-muted-foreground">{fmt(balances.length)} سجل</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead><tr className="bg-navy-900 text-gold-400">{['الموظف', 'القسم', 'الموقع', 'رصيد سنوي', 'مستخدم', 'متبقي', 'مرضي مستخدم', 'مرات مرضية', 'بدون راتب', 'تقرير'].map((h, i) => <th key={i} className="whitespace-nowrap px-3 py-2 text-right font-semibold">{h}</th>)}</tr></thead>
            <tbody>
              {balances.length ? balances.map((r) => (
                <tr key={r.employee_code} className="border-b hover:bg-muted/40">
                  <td className="px-3 py-2 font-semibold">{r.name || r.employee_code}</td>
                  <td className="px-3 py-2">{r.department || '—'}</td>
                  <td className="px-3 py-2">{r.site_name || '—'}</td>
                  <td className="num px-3 py-2">{fmt(r.annual_balance)}</td>
                  <td className="num px-3 py-2">{fmt(r.annual_used)}</td>
                  <td className="num px-3 py-2 font-bold text-emerald-700">{fmt(r.annual_remaining)}</td>
                  <td className="num px-3 py-2">{fmt(r.sick_used)}</td>
                  <td className="num px-3 py-2">{fmt(r.sick_times_period)}</td>
                  <td className="num px-3 py-2">{fmt(r.unpaid_days)}</td>
                  <td className="px-3 py-2"><Btn size="sm" variant="ghost" onClick={() => openEmp(r.employee_code)}>عرض</Btn></td>
                </tr>)) : <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">لا توجد أرصدة مطابقة للفلاتر</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div id="hr-dashboard-print" className="hidden print:block" dir="rtl">
        <h2 className="font-cairo text-lg font-extrabold">لوحة الموارد البشرية — من {(summary && summary.range && summary.range.from) || ''} إلى {(summary && summary.range && summary.range.to) || ''}</h2>
        <table className="w-full border-collapse text-xs">
          <thead><tr className="bg-navy-900 text-gold-400"><th className="px-2 py-1">البند</th><th className="px-2 py-1">القيمة</th></tr></thead>
          <tbody>{[['إجمالي الموظفين', (summary && summary.headcount) || 0], ['حاضرون', a.present], ['غائبون', a.absent], ['متأخرون', a.late], ['غياب بعذر', a.excused], ['غياب بدون عذر', a.unexcused], ['أذونات', a.permission], ['أيام سنوية', (l.annual && l.annual.days) || 0], ['أيام مرضية', (l.sick && l.sick.days) || 0]].map((row, i) => <tr key={i} className="border"><td className="px-2 py-1">{row[0]}</td><td className="num px-2 py-1">{row[1]}</td></tr>)}</tbody>
        </table>
      </div>
      <Modal open={attModal.open} onClose={() => setAttModal((m) => ({ ...m, open: false }))} title={'تفاصيل: ' + attModal.label} wide={true}>
        {attModal.loading ? <div className="py-8 text-center text-muted-foreground">جارٍ التحميل…</div> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead><tr className="border-b bg-muted/50">{['الموظف', 'التاريخ', 'القسم', 'الموقع', 'الحالة', 'حضور', 'انصراف', 'ملاحظة'].map((h, i) => <th key={i} className="px-2 py-2 text-right font-semibold">{h}</th>)}</tr></thead>
              <tbody>{attModal.rows.length ? attModal.rows.map((r, i) => (
                <tr key={i} className="border-b">
                  <td className="px-2 py-1.5 font-semibold">{r.name || r.employee_code}</td>
                  <td className="px-2 py-1.5">{r.date}</td>
                  <td className="px-2 py-1.5">{r.department || '—'}</td>
                  <td className="px-2 py-1.5">{r.site_name || '—'}</td>
                  <td className="px-2 py-1.5"><span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{ATT_STATUS_LABEL[r.status] || r.status}</span></td>
                  <td className="num px-2 py-1.5">{r.check_in_time || '—'}</td>
                  <td className="num px-2 py-1.5">{r.check_out_time || '—'}</td>
                  <td className="px-2 py-1.5 text-xs text-muted-foreground">{r.note || '—'}</td>
                </tr>)) : <tr><td colSpan={8} className="px-2 py-8 text-center text-muted-foreground">لا توجد سجلات</td></tr>}</tbody>
            </table>
          </div>)}
      </Modal>
      <Modal open={leaveModal.open} onClose={() => setLeaveModal((m) => ({ ...m, open: false }))} title={leaveModal.title} wide={true}>
        {leaveModal.loading ? <div className="py-8 text-center text-muted-foreground">جارٍ التحميل…</div> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead><tr className="border-b bg-muted/50">{['الموظف', 'النوع', 'من', 'إلى', 'الأيام', 'الحالة', 'السبب'].map((h, i) => <th key={i} className="px-2 py-2 text-right font-semibold">{h}</th>)}</tr></thead>
              <tbody>{leaveModal.rows.length ? leaveModal.rows.map((r, i) => (
                <tr key={i} className="border-b">
                  <td className="px-2 py-1.5 font-semibold">{r.name || r.employee_code}</td>
                  <td className="px-2 py-1.5">{r.leave_type}</td>
                  <td className="px-2 py-1.5">{r.start_date}</td>
                  <td className="px-2 py-1.5">{r.end_date}</td>
                  <td className="num px-2 py-1.5">{fmt(r.days_count)}</td>
                  <td className="px-2 py-1.5"><span className={'rounded px-1.5 py-0.5 text-xs ' + statusColor(r.overall_status)}>{r.overall_status}</span></td>
                  <td className="px-2 py-1.5 text-xs text-muted-foreground">{r.reason || '—'}</td>
                </tr>)) : <tr><td colSpan={7} className="px-2 py-8 text-center text-muted-foreground">لا توجد طلبات</td></tr>}</tbody>
            </table>
          </div>)}
      </Modal>
      <Modal open={empModal.open} onClose={() => setEmpModal((m) => ({ ...m, open: false }))} title={'تقرير الموظف — ' + empModal.code} wide={true}>
        {empModal.loading ? <div className="py-8 text-center text-muted-foreground">جارٍ التحميل…</div> : empModal.data ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">{[['حاضر', empModal.data.totals.present], ['متأخر', empModal.data.totals.late], ['غائب', empModal.data.totals.absent], ['أذونات', empModal.data.totals.permissions], ['أيام سنوية', empModal.data.totals.annual_days], ['أيام مرضية', empModal.data.totals.sick_days], ['مرات مرضية', empModal.data.totals.sick_times], ['متبقي سنوي', empModal.data.balance.annual_remaining]].map((row, i) => (
              <div key={i} className="rounded-lg border bg-muted/30 p-2 text-center"><div className="text-[11px] text-muted-foreground">{row[0]}</div><div className="num font-bold">{fmt(row[1])}</div></div>))}</div>
            <div><h4 className="mb-2 font-cairo text-sm font-bold">السجل الزمني</h4>
              <div className="max-h-72 overflow-y-auto rounded-lg border">{empModal.data.timeline && empModal.data.timeline.length ? empModal.data.timeline.map((t, i) => (
                <div key={i} className="flex items-center justify-between border-b px-3 py-2 text-sm last:border-0">
                  <div><span className="font-semibold">{t.date}</span><span className="mx-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs">{t.label}</span><span className="text-xs text-muted-foreground">{t.kind}</span></div>
                  <span className={'rounded px-1.5 py-0.5 text-xs ' + statusColor(t.status)}>{t.status}</span>
                </div>)) : <div className="px-3 py-6 text-center text-muted-foreground">لا توجد أحداث</div>}</div>
            </div>
          </div>
        ) : <div className="py-8 text-center text-muted-foreground">لا توجد بيانات</div>}
      </Modal>
      {loading ? <div className="fixed bottom-4 left-4 z-50 rounded-full bg-navy-900 px-4 py-2 text-xs text-gold-400 shadow-lg">جارٍ التحديث…</div> : null}
    </div>);
}