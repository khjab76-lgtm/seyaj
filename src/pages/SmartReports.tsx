import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Clock3, Download, GitBranch, Plus, Trash2, CheckCircle2, FileBarChart2, CalendarRange } from 'lucide-react';
import { useStore } from '@/lib/store';
import { fetchSupportMovements, saveSupportMovementBackend, deleteSupportMovement } from '@/lib/hr';
import { PageToolbar, Select, TextInput, Btn, Table, EmptyRow, StatusBadge, Modal, Field, useToast } from '@/components/ui-kit';
import OfficialPaper from '@/components/OfficialPaper';
import ReportBuilder from '@/pages/ReportBuilder';
import MonthlyTimesheetTab from '@/pages/smart-reports/MonthlyTimesheetTab';
import ReportCenterTab from '@/pages/smart-reports/ReportCenterTab';
import { SUPPORT_TYPES, saIdOf, salaryOf, computeNet, fmt } from '@/lib/seyaj';
import { exportAoaXlsx, exportElementPdf } from '@/lib/reportBuilder';

const TABS = [
  { key: 'reports', label: 'باني التقارير', icon: BarChart3 },
  { key: 'monthly', label: 'التايم شيت الشهري', icon: CalendarRange },
  { key: 'center', label: 'مركز التقارير', icon: FileBarChart2 },
  { key: 'timesheet', label: 'التايم شيت التفصيلي', icon: Clock3 },
  { key: 'support', label: 'حركة المساندة', icon: GitBranch },
];

// ---------- رموز مصفوفة الحضور الميداني (مطابقة للنموذج المرجعي) ----------
const MATRIX_MARKS = ['1', 'ع', 'ح', 'استقالة'];
const markStyle = (m: string) =>
  m === 'ع' ? 'bg-orange-400 text-white'
    : m === 'ح' ? 'bg-amber-100 text-amber-800'
      : m === 'استقالة' ? 'bg-pink-100 text-rose-600 text-[8px]'
        : 'bg-white text-emerald-700';

// دورة الأيام من 26 حتى 25 (الشهر السابق + الحالي)
function cycleDays(month: string, year: number) {
  const m = Number(month);
  const prevM = m === 1 ? 12 : m - 1;
  const prevY = m === 1 ? year - 1 : year;
  const daysInPrev = new Date(prevY, prevM, 0).getDate();
  const days: { day: number; date: Date; endOfGreg: boolean }[] = [];
  for (let d = 26; d <= daysInPrev; d++) days.push({ day: d, date: new Date(prevY, prevM - 1, d), endOfGreg: d === daysInPrev });
  for (let d = 1; d <= 25; d++) days.push({ day: d, date: new Date(year, m - 1, d), endOfGreg: false });
  return days;
}

function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob(['\ufeff' + text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function TimesheetTab() {
  const { employees, sites, projects, attendance, insurance, violations, allowances } = useStore();
  const [projectId, setProjectId] = useState('all');
  const [month, setMonth] = useState('09');
  const year = 2026;
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const paperRef = useRef<HTMLDivElement>(null);

  const siteName = (id: number) => sites.find((s: any) => s.id === id)?.name ?? '—';
  const siteCode = (id: number) => sites.find((s: any) => s.id === id)?.code ?? '—';
  const projectName = (id: number) => projects.find((p: any) => p.id === id)?.name ?? '—';

  const cycle = useMemo(() => cycleDays(month, year), [month]);

  const empList = useMemo(() => employees.filter((e: any) => projectId === 'all' || String(e.projectId) === projectId), [employees, projectId]);

  // تبويبات المواقع (كما في النموذج المرجعي: موقع/مشروع لكل تبويب)
  const siteIds = useMemo(() => {
    const set = new Set<number>(empList.map((e: any) => e.siteId));
    return Array.from(set);
  }, [empList]);

  const activeSiteId = selectedSiteId && siteIds.includes(selectedSiteId) ? selectedSiteId : siteIds[0] ?? null;
  const siteEmps = useMemo(() => empList.filter((e: any) => e.siteId === activeSiteId), [empList, activeSiteId]);

  const key = (empId: number, idx: number) => empId + '-' + month + '-' + idx;

  const defaultMark = (e: any, d: { day: number; date: Date }) => {
    const dow = d.date.getDay();
    if (dow === 5 || dow === 6) return 'ع';
    const iso = d.date.getFullYear() + '-' + String(d.date.getMonth() + 1).padStart(2, '0') + '-' + String(d.date.getDate()).padStart(2, '0');
    const a = attendance.find((x: any) => x.employeeId === e.id && x.date === iso);
    if (a && a.status === 'غائب') return 'ح';
    return '1';
  };

  const markFor = (e: any, idx: number): string => {
    const k = key(e.id, idx);
    if (marks[k] !== undefined) return marks[k];
    return defaultMark(e, cycle[idx]);
  };

  const cycleMark = (empId: number, idx: number) => {
    const k = key(empId, idx);
    const cur = marks[k] ?? (() => { const e = siteEmps.find((x: any) => x.id === empId); return e ? defaultMark(e, cycle[idx]) : '1'; })();
    const ni = (MATRIX_MARKS.indexOf(cur) + 1) % MATRIX_MARKS.length;
    setMarks((p) => ({ ...p, [k]: MATRIX_MARKS[ni] }));
  };

  const countOf = (e: any, code: string) => cycle.filter((_, i) => markFor(e, i) === code).length;

  const dedTotal = allowances.filter((a: any) => a.kind === 'deduction' && a.amount > 0).reduce((s: number, a: any) => s + a.amount, 0);
  const rowNet = (e: any) => {
    const base = salaryOf(e.job);
    const overtime = countOf(e, 'ح') * 50;
    const ins = insurance.find((i: any) => i.employeeName === e.name)?.monthlyDeduction ?? 0;
    const vio = violations.filter((v: any) => v.employeeName === e.name && v.status === 'deducted').reduce((s: number, v: any) => s + v.amount, 0);
    return { base, overtime, ded: dedTotal, ins, vio, net: computeNet({ baseSalary: base, allowances: overtime, deductions: dedTotal, insurance: ins, violations: vio }) };
  };

  // الإجمالي اليومي (عدد الحاضرين "1" لكل يوم) — الصف الأصفر في النموذج
  const dailyTotals = cycle.map((_, i) => siteEmps.filter((e: any) => markFor(e, i) === '1').length);

  const buildAoa = () => {
    const head = ['الرقم', 'الاسم', 'الوردية', ...cycle.map((d) => String(d.day)), 'حضور', 'راحة', 'حسم', 'إجازة', 'صافي'];
    const rows = siteEmps.map((e: any) => {
      const n = rowNet(e);
      return [e.no, e.name, e.job, ...cycle.map((_, i) => markFor(e, i)), countOf(e, '1'), countOf(e, 'ع'), countOf(e, 'ح'), countOf(e, 'استقالة'), n.net];
    });
    rows.push(['', 'الإجمالي اليومي', '', ...dailyTotals.map(String), '', '', '', '', '']);
    return [head, ...rows];
  };

  const exportExcel = () => {
    const aoa = buildAoa();
    exportAoaXlsx(`تايم-شيت-${siteCode(activeSiteId ?? 0)}-${month}-${year}.xlsx`, aoa);
  };
  const exportCsv = () => {
    const aoa = buildAoa();
    const esc = (v: any) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    downloadText(`تايم-شيت-${siteCode(activeSiteId ?? 0)}-${month}-${year}.csv`, aoa.map((r) => r.map(esc).join(',')).join('\n'), 'text/csv;charset=utf-8;');
  };

  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      await exportElementPdf(paperRef.current, `تايم-شيت-${siteCode(activeSiteId ?? 0)}-${month}-${year}.pdf`);
    } catch (err: any) {
      alert('تعذّر توليد PDF: ' + (err?.message || 'خطأ غير معروف'));
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div>
      {/* الترويسة المطابقة للنموذج المرجعي */}
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-extrabold text-navy-900">سجل الحضور الميداني المقسم (Excel Matrix)</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> مطابق للنموذج المعتمد
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">يُصدر بحسب المشروع والموقع وتوزيع الأيام (من 26 إلى 25) — السجل مقسم تلقائياً إلى ملفات Excel مستقلة لكل موقع.</p>
        </div>
        <div className="flex items-end gap-2">
          <Field label="المشروع">
            <Select value={projectId} onChange={(e: any) => { setProjectId(e.target.value); setSelectedSiteId(null); }} options={[{ value: 'all', label: 'كل المشاريع' }, ...projects.map((p: any) => ({ value: String(p.id), label: p.name }))]} />
          </Field>
          <Field label="دورة الشهر">
            <Select value={month} onChange={(e: any) => setMonth(e.target.value)} options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1).padStart(2, '0'), label: 'شهر ' + (i + 1) + ' الحالي (26→25)' }))} />
          </Field>
        </div>
      </div>

      {/* تبويبات المواقع */}
      {siteIds.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1 rounded-xl border bg-navy-900 p-1.5 shadow-sm">
          {siteIds.map((sid) => (
            <button key={sid} onClick={() => setSelectedSiteId(sid)}
              className={'rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ' + (sid === activeSiteId ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-white/10')}>
              <span className="ml-1 rounded bg-white/15 px-1.5 py-0.5 font-mono text-[10px]">{siteCode(sid)}</span>
              {siteName(sid)}
              <span className="mr-1 text-[10px] opacity-80">({empList.filter((e: any) => e.siteId === sid).length} حارس)</span>
            </button>
          ))}
        </div>
      )}

      {/* شريط الأدوات */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Btn variant="outline" size="sm" onClick={exportExcel}>تصدير Excel (.xlsx)</Btn>
        <Btn variant="outline" size="sm" onClick={exportCsv}>تصدير CSV</Btn>
        <Btn variant="primary" size="sm" onClick={() => setPreview(true)}>طباعة / PDF رسمي</Btn>
        <span className="mr-auto text-[11px] text-muted-foreground">اضغط أي خلية لتبديل الرمز (1 ← ع ← ح ← استقالة)</span>
      </div>

      {siteEmps.length === 0 ? (
        <div className="rounded-xl border bg-card py-14 text-center text-sm text-muted-foreground shadow-sm">لا يوجد حراس في هذا الموقع</div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between bg-navy-900 px-4 py-2.5 text-white">
            <div className="flex items-center gap-2 text-sm font-extrabold">
              <span className="rounded-md bg-white/15 px-2 py-0.5 font-mono text-[11px]">{siteCode(activeSiteId ?? 0)}</span>
              {siteName(activeSiteId ?? 0)}
              <span className="text-[11px] font-normal text-blue-300">{projectName(siteEmps[0]?.projectId)}</span>
            </div>
            <span className="text-[11px] text-gold-400">{siteEmps.length} حارس — دورة 26 → 25</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr>
                  <th className="sticky right-0 z-10 whitespace-nowrap border border-slate-200 bg-slate-100 px-2 py-2 text-right font-extrabold">الرقم</th>
                  <th className="whitespace-nowrap border border-slate-200 bg-slate-100 px-2 py-2 text-right font-extrabold">الاسم</th>
                  <th className="whitespace-nowrap border border-slate-200 bg-slate-100 px-2 py-2 text-right font-extrabold">الوردية</th>
                  {cycle.map((d, i) => (
                    <th key={i} className={'min-w-[26px] border border-slate-200 px-0.5 py-2 text-center text-[10px] font-extrabold text-white ' + (d.endOfGreg ? 'bg-rose-600' : 'bg-emerald-600')}>{d.day}</th>
                  ))}
                  <th className="border border-slate-200 bg-slate-100 px-1.5 py-2 text-center font-extrabold">حضور</th>
                  <th className="border border-slate-200 bg-slate-100 px-1.5 py-2 text-center font-extrabold">راحة</th>
                  <th className="border border-slate-200 bg-slate-100 px-1.5 py-2 text-center font-extrabold">حسم</th>
                  <th className="border border-slate-200 bg-slate-100 px-1.5 py-2 text-center font-extrabold">إجازة</th>
                  <th className="border border-slate-200 bg-slate-100 px-1.5 py-2 text-center font-extrabold">صافي</th>
                </tr>
              </thead>
              <tbody>
                {siteEmps.map((e: any) => {
                  const n = rowNet(e);
                  return (
                    <tr key={e.id} className="hover:bg-muted/30">
                      <td className="sticky right-0 z-10 whitespace-nowrap border border-slate-200 bg-card px-2 py-1.5 font-mono text-[10px]">{e.no}</td>
                      <td className="whitespace-nowrap border border-slate-200 px-2 py-1.5 font-bold">{e.name}</td>
                      <td className="whitespace-nowrap border border-slate-200 px-2 py-1.5 text-muted-foreground">{e.job}</td>
                      {cycle.map((_, i) => {
                        const m = markFor(e, i);
                        return (
                          <td key={i} onClick={() => cycleMark(e.id, i)} className={'cursor-pointer border border-slate-200 px-0.5 py-1.5 text-center font-bold num ' + markStyle(m)}>{m}</td>
                        );
                      })}
                      <td className="border border-slate-200 px-1.5 py-1.5 text-center num text-emerald-700">{countOf(e, '1')}</td>
                      <td className="border border-slate-200 px-1.5 py-1.5 text-center num text-orange-600">{countOf(e, 'ع')}</td>
                      <td className="border border-slate-200 px-1.5 py-1.5 text-center num text-amber-700">{countOf(e, 'ح')}</td>
                      <td className="border border-slate-200 px-1.5 py-1.5 text-center num text-rose-600">{countOf(e, 'استقالة')}</td>
                      <td className="border border-slate-200 px-1.5 py-1.5 text-center font-extrabold num text-navy-900">{fmt(n.net)}</td>
                    </tr>
                  );
                })}
                {/* صف المجاميع اليومي — أصفر فاقع كما في النموذج */}
                <tr className="bg-yellow-300 font-extrabold">
                  <td colSpan={3} className="border border-slate-200 px-2 py-1.5 text-right">الإجمالي اليومي</td>
                  {dailyTotals.map((t, i) => (<td key={i} className="border border-slate-200 px-0.5 py-1.5 text-center num">{t}</td>))}
                  <td colSpan={5}></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* مفتاح الألوان كما في النموذج المرجعي */}
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 text-[11px] shadow-sm">
        <span className="font-extrabold text-navy-900">مفتاح الرموز:</span>
        <span className="flex items-center gap-1"><span className="inline-block h-4 w-4 rounded border border-slate-300 bg-white text-center text-[9px] font-bold leading-4 text-emerald-700">1</span> حضور فعلي</span>
        <span className="flex items-center gap-1"><span className="inline-block h-4 w-4 rounded bg-orange-400 text-center text-[9px] font-bold leading-4 text-white">ع</span> راحة / عطلة أسبوعية</span>
        <span className="flex items-center gap-1"><span className="inline-block h-4 w-4 rounded bg-amber-100 text-center text-[9px] font-bold leading-4 text-amber-800">ح</span> حسم / بديل</span>
        <span className="flex items-center gap-1"><span className="inline-block h-4 w-4 rounded bg-pink-100 text-center text-[7px] font-bold leading-4 text-rose-600">إجازة</span> إجازة رسمية / استقالة</span>
        <span className="flex items-center gap-1"><span className="inline-block h-4 w-4 rounded bg-rose-600 text-center text-[9px] font-bold leading-4 text-white">31</span> نهاية الشهر الميلادي</span>
        <span className="flex items-center gap-1"><span className="inline-block h-4 w-4 rounded bg-yellow-300"></span> صف المجاميع والإجمالي اليومي</span>
      </div>

      <Modal open={preview} onClose={() => setPreview(false)} title="تايم شيت رسمي — طباعة / PDF" wide>
        <div className="mb-3 flex justify-end gap-2">
          <Btn variant="outline" size="sm" disabled={pdfBusy} onClick={downloadPdf}><Download className="h-4 w-4" /> {pdfBusy ? 'جارٍ التوليد...' : 'تنزيل PDF'}</Btn>
        </div>
        <div ref={paperRef}>
        <OfficialPaper title={'سجل الحضور الميداني المقسم — شهر ' + month + '/' + year} subtitle="كشف حضور وانصراف مفصّل (دورة 26 → 25) مطابق للنموذج المعتمد" landscape
          meta={[{ k: 'المشروع', v: projectName(siteEmps[0]?.projectId ?? 0) }, { k: 'الموقع', v: siteName(activeSiteId ?? 0) + ' (' + siteCode(activeSiteId ?? 0) + ')' }, { k: 'عدد الحراس', v: String(siteEmps.length) }, { k: 'الدورة', v: '26/' + (Number(month) === 1 ? 12 : Number(month) - 1) + ' → 25/' + month }]}>
          <table className="w-full border-collapse text-[8px]">
            <thead>
              <tr>
                <th className="border border-slate-300 bg-slate-200 px-1 py-1 text-right">الرقم</th>
                <th className="border border-slate-300 bg-slate-200 px-1 py-1 text-right">الاسم</th>
                <th className="border border-slate-300 bg-slate-200 px-1 py-1 text-right">الوردية</th>
                {cycle.map((d, i) => (<th key={i} className={'border border-slate-300 px-0.5 py-1 text-center text-white ' + (d.endOfGreg ? 'bg-rose-600' : 'bg-emerald-600')}>{d.day}</th>))}
                <th className="border border-slate-300 bg-slate-200 px-1 py-1">حضور</th>
                <th className="border border-slate-300 bg-slate-200 px-1 py-1">صافي</th>
              </tr>
            </thead>
            <tbody>
              {siteEmps.map((e: any, ri: number) => (
                <tr key={e.id} className={ri % 2 ? 'bg-slate-50' : ''}>
                  <td className="border border-slate-300 px-1 py-1 font-mono">{e.no}</td>
                  <td className="border border-slate-300 px-1 py-1">{e.name}</td>
                  <td className="border border-slate-300 px-1 py-1">{e.job}</td>
                  {cycle.map((_, i) => {
                    const m = markFor(e, i);
                    return (<td key={i} className={'border border-slate-300 px-0.5 py-1 text-center font-bold ' + markStyle(m)}>{m}</td>);
                  })}
                  <td className="border border-slate-300 px-1 py-1 text-center num">{countOf(e, '1')}</td>
                  <td className="border border-slate-300 px-1 py-1 text-center font-bold num">{fmt(rowNet(e).net)}</td>
                </tr>
              ))}
              <tr className="bg-yellow-300 font-extrabold">
                <td colSpan={3} className="border border-slate-300 px-1 py-1 text-right">الإجمالي اليومي</td>
                {dailyTotals.map((t, i) => (<td key={i} className="border border-slate-300 px-0.5 py-1 text-center num">{t}</td>))}
                <td colSpan={2}></td>
              </tr>
            </tbody>
          </table>
          <div className="mt-2 flex flex-wrap gap-3 text-[8px]">
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 bg-orange-400" /> ع راحة / عطلة أسبوعية</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 bg-amber-100" /> ح حسم / بديل</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 bg-pink-100" /> إجازة / استقالة</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 bg-rose-600" /> نهاية الشهر الميلادي</span>
          </div>
        </OfficialPaper>
        </div>
      </Modal>
    </div>
  );
}

function SupportTab() {
  const { sites, employees } = useStore();
  const [period, setPeriod] = useState('daily');
  const [open, setOpen] = useState(false);
  const [movements, setMovements] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ employeeName: '', employeeCode: '', employeeId: '', homeSite: '', coveredSite: '', date: '2026-09-01', type: 'coverage', checkIn: '07:00', checkOut: '15:00', note: '' });
  const toast = useToast();

  const reload = () => fetchSupportMovements().then(setMovements);
  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    if (period === 'daily') return movements;
    if (period === 'weekly') return movements.filter((m: any) => (m.movement_date || '') >= '2026-08-25');
    return movements.filter((m: any) => (m.movement_date || '') >= '2026-09-01');
  }, [movements, period]);

  const save = async () => {
    if (!form.employeeName || !form.coveredSite) { toast.show('أكمل اسم الموظف والموقع المغطى'); return; }
    await saveSupportMovementBackend({
      employee_code: form.employeeCode || '', employee_name: form.employeeName,
      employee_id_number: form.employeeId || '', home_site: form.homeSite || '',
      covered_site: form.coveredSite, movement_date: form.date || '', movement_type: form.type,
      checkin_time: form.checkIn || '', checkout_time: form.checkOut || '', note: form.note || '',
    }, 'مدير النظام');
    setOpen(false);
    toast.show('سُجّلت حركة المساندة في الخادم');
    reload();
  };

  const remove = async (id: number) => { await deleteSupportMovement(id); toast.show('حُذفت الحركة'); reload(); };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <div className="text-xs text-muted-foreground">تسجيل التغطية في الموقع المغطى ومنع التلاعب بالاعتماد على البصمة والموقع المحدد — مساندة يومية/أسبوعية/شهرية.</div>
        <div className="flex items-center gap-2">
          <Select value={period} onChange={(e: any) => setPeriod(e.target.value)} options={[{ value: 'daily', label: 'يومي' }, { value: 'weekly', label: 'أسبوعي' }, { value: 'monthly', label: 'شهري' }]} />
          <Btn size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> حركة مساندة</Btn>
        </div>
      </div>

      <Table head={['#', 'الموظف', 'الرقم الوظيفي', 'موقعه الأساسي', 'الموقع المغطى', 'التاريخ', 'النوع', 'دخول', 'خروج', '']}>
        {filtered.length ? filtered.map((m: any, i: number) => (
          <tr key={m.id} className="hover:bg-muted/40">
            <td className="px-4 py-2.5 num">{i + 1}</td>
            <td className="px-4 py-2.5 font-bold">{m.employee_name}</td>
            <td className="px-4 py-2.5">{m.employee_code}</td>
            <td className="px-4 py-2.5">{m.home_site}</td>
            <td className="px-4 py-2.5"><StatusBadge value={m.covered_site} /></td>
            <td className="px-4 py-2.5 num">{m.movement_date}</td>
            <td className="px-4 py-2.5">{SUPPORT_TYPES.find((t) => t.code === m.movement_type)?.label || m.movement_type}</td>
            <td className="px-4 py-2.5 num">{m.checkin_time}</td>
            <td className="px-4 py-2.5 num">{m.checkout_time}</td>
            <td className="px-4 py-2.5">
              <button onClick={() => remove(m.id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
            </td>
          </tr>
        )) : <EmptyRow colSpan={10} />}
      </Table>
      {toast.node}

      <Modal open={open} onClose={() => setOpen(false)} title="حركة مساندة جديدة" wide>
        <div className="grid grid-cols-2 gap-3">
          <Field label="الموظف">
            <Select value={form.employeeName} onChange={(e: any) => {
              const emp = employees.find((x: any) => x.name === e.target.value);
              setForm({ ...form, employeeName: e.target.value, employeeCode: emp?.no || '', employeeId: emp ? saIdOf(emp.phone || '') : '' });
            }} options={[{ value: '', label: 'اختر...' }, ...employees.map((x: any) => ({ value: x.name, label: `${x.name} (${x.no})` }))]} />
          </Field>
          <Field label="الرقم الوظيفي"><TextInput value={form.employeeCode} onChange={(e: any) => setForm({ ...form, employeeCode: e.target.value })} placeholder="EMP-1001" /></Field>
          <Field label="موقعه الأساسي">
            <Select value={form.homeSite} onChange={(e: any) => setForm({ ...form, homeSite: e.target.value })} options={[{ value: '', label: 'اختر...' }, ...sites.map((s: any) => ({ value: s.name, label: s.name }))]} />
          </Field>
          <Field label="الموقع المغطى">
            <Select value={form.coveredSite} onChange={(e: any) => setForm({ ...form, coveredSite: e.target.value })} options={[{ value: '', label: 'اختر...' }, ...sites.map((s: any) => ({ value: s.name, label: s.name }))]} />
          </Field>
          <Field label="التاريخ"><TextInput type="date" value={form.date} onChange={(e: any) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="نوع الحركة"><Select value={form.type} onChange={(e: any) => setForm({ ...form, type: e.target.value })} options={SUPPORT_TYPES.map((t) => ({ value: t.code, label: t.label }))} /></Field>
          <Field label="دخول"><TextInput type="time" value={form.checkIn} onChange={(e: any) => setForm({ ...form, checkIn: e.target.value })} /></Field>
          <Field label="خروج"><TextInput type="time" value={form.checkOut} onChange={(e: any) => setForm({ ...form, checkOut: e.target.value })} /></Field>
          <div className="col-span-2"><Field label="ملاحظة"><TextInput value={form.note} onChange={(e: any) => setForm({ ...form, note: e.target.value })} /></Field></div>
        </div>
        <div className="mt-4 flex justify-end gap-2"><Btn variant="outline" onClick={() => setOpen(false)}>إلغاء</Btn><Btn onClick={save}>حفظ الحركة</Btn></div>
      </Modal>
    </div>
  );
}

export default function SmartReports() {
  const [tab, setTab] = useState('reports');
  return (
    <div>
      <PageToolbar title="التقارير الذكية والتايم شيت" subtitle="باني تقارير فعلي: أعمدة وفلاتر وقوالب قابلة للتخصيص، مع مخرجات رسمية Excel / CSV / PDF" />
      <div className="mb-4 flex gap-1 rounded-xl border bg-card p-1 shadow-sm">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition-colors ' + (tab === t.key ? 'bg-navy-900 text-gold-400' : 'text-muted-foreground hover:bg-muted')}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>
      {tab === 'reports' && <ReportBuilder />}
      {tab === 'monthly' && <MonthlyTimesheetTab />}
      {tab === 'center' && <ReportCenterTab />}
      {tab === 'timesheet' && <TimesheetTab />}
      {tab === 'support' && <SupportTab />}
    </div>
  );
}