// التايم شيت الشهري — يعمل من قاعدة البيانات بنفس منطق ملف الإكسل المرجعي.
// كتل لكل موقع (رأس: المشروع/الفرع/الكود + العدد الأساسي وبدلاء الراحات وراتب الموقع)،
// دورة أيام رواتب 26->25 أو تقويمية، رموز حالات مشتقة فعليًا من الحضور/الإجازات/الأحداث،
// صف إجمالي يومي، عمود ملاحظات، مفتاح حالات، توقيعات، وتصدير Excel متعدد الأوراق + PDF أفقي A4.
// الطباعة/التصدير هنا ضمن قسم التقارير فقط (لا زر طباعة داخل الشاشة).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet, CalendarDays, Search, CheckCircle2, Users, X, Table2, Paperclip } from 'lucide-react';
import { Select, TextInput, Btn, Field, useToast } from '@/components/ui-kit';
import OfficialPaper from '@/components/OfficialPaper';
import { exportElementPdf } from '@/lib/reportBuilder';
import {
  fetchTimesheet, fetchTimesheetExtras, exportTimesheetXlsx, exportTimesheetCsv,
  type TimesheetResult, type TimesheetExtras, type TimesheetBlock,
} from '@/lib/reportEngine';

const YEARS = [2025, 2026, 2027];
const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1).padStart(2, '0'), label: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'][i] }));

const CODE_CLS: Record<string, string> = {
  '1': 'bg-emerald-50 text-emerald-700',
  'غ': 'bg-rose-50 text-rose-700',
  'ض': 'bg-amber-50 text-amber-700',
  'ج': 'bg-blue-50 text-blue-700',
  'س': 'bg-cyan-50 text-cyan-700',
  'م': 'bg-violet-50 text-violet-700',
  'ر': 'bg-indigo-50 text-indigo-700',
  'ع': 'bg-slate-100 text-slate-500',
  'ن': 'bg-orange-50 text-orange-700',
};

interface EmpOption { employee_code: string; name: string; project: string; site: string; job: string }

export default function MonthlyTimesheetTab() {
  const toast = useToast();
  const [year, setYear] = useState('2026');
  const [month, setMonth] = useState('08');
  const [mode, setMode] = useState('payroll');
  const [dayCount, setDayCount] = useState('0');
  const [projectName, setProjectName] = useState('');
  const [siteName, setSiteName] = useState('');

  const [ts, setTs] = useState<TimesheetResult | null>(null);
  const [extras, setExtras] = useState<TimesheetExtras | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [showExtras, setShowExtras] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [empQuery, setEmpQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const paperRef = useRef<HTMLDivElement>(null);

  const allEmployees = useMemo<EmpOption[]>(() => {
    const map = new Map<string, EmpOption>();
    for (const b of ts?.blocks ?? []) {
      for (const r of b.rows) {
        if (!map.has(r.employee_code)) {
          map.set(r.employee_code, { employee_code: r.employee_code, name: r.name, project: b.project_name, site: b.site_name, job: r.job });
        }
      }
    }
    return Array.from(map.values());
  }, [ts]);

  const load = async (codes?: string[]) => {
    setLoading(true);
    try {
      const params = {
        year: Number(year), month: Number(month), mode,
        day_count: Number(dayCount) || 0,
        project_name: projectName || undefined,
        site_name: siteName || undefined,
        employee_codes: (codes ?? selected).join(',') || undefined,
      };
      const [t, x] = await Promise.all([
        fetchTimesheet(params),
        fetchTimesheetExtras({ year: params.year, month: params.month, mode, day_count: params.day_count, project_name: params.project_name }),
      ]);
      setTs(t); setExtras(x);
    } catch (err: any) {
      toast.show('تعذّر تحميل التايم شيت: ' + (err?.message || 'خطأ'));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const toggleEmp = (code: string) => setSelected((p) => (p.includes(code) ? p.filter((c) => c !== code) : [...p, code]));

  const filteredPicker = allEmployees.filter((e) =>
    !empQuery || e.name.includes(empQuery) || e.employee_code.includes(empQuery) || e.site.includes(empQuery) || e.project.includes(empQuery));

  const exportExcel = () => {
    if (!ts) return;
    exportTimesheetXlsx('تايم-شيت-' + year + '-' + month + '.xlsx', ts, extras);
    toast.show('تم تصدير Excel بنفس تنظيم الملف المرجعي');
  };
  const exportCsv = () => { if (ts) exportTimesheetCsv('تايم-شيت-' + year + '-' + month + '.csv', ts); };
  const downloadPdf = async () => {
    if (!paperRef.current) return;
    setPdfBusy(true);
    try { await exportElementPdf(paperRef.current, 'تايم-شيت-' + year + '-' + month + '.pdf'); }
    catch (err: any) { toast.show('تعذّر توليد PDF: ' + (err?.message || 'خطأ')); }
    finally { setPdfBusy(false); }
  };

  const renderBlock = (b: TimesheetBlock, print = false) => {
    const days = ts?.days ?? [];
    return (
      <div key={b.site_name} className={'mb-4 overflow-hidden rounded-xl border bg-card shadow-sm ' + (print ? 'break-inside-avoid' : '')}>
        <div className="grid grid-cols-2 gap-2 bg-navy-900 px-3 py-2 text-white md:grid-cols-4">
          <div className="text-[11px] font-extrabold">{b.project_name}<div className="text-[10px] font-normal text-white/70">{b.site_name}</div></div>
          <div className="text-[10px] text-white/80">الكود: <span className="num font-bold">{b.site_code || '—'}</span></div>
          <div className="text-[10px] text-white/80">العدد الأساسي: <span className="num font-bold">{b.base_count}</span></div>
          <div className="text-[10px] text-white/80">راتب الموقع: <span className="num font-bold">{b.site_salary || 0}</span></div>
        </div>
        <div className={print ? '' : 'overflow-x-auto'}>
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr>
                <th className="sticky right-0 z-20 min-w-[120px] border border-slate-200 bg-slate-100 px-1.5 py-1 text-right font-extrabold text-navy-900">الاسم / الوظيفة</th>
                <th className="border border-slate-200 bg-slate-100 px-1 py-1 text-[9px] font-bold text-navy-900">الوردية</th>
                {days.map((d) => (
                  <th key={d.iso} className={'min-w-[20px] border border-slate-200 px-0.5 py-1 text-center text-[9px] font-bold text-white ' + (d.month !== Number(month) ? 'bg-slate-400' : 'bg-emerald-600')} title={d.iso}>{d.label}</th>
                ))}
                <th className="border border-slate-200 bg-slate-100 px-1 py-1 text-[9px] font-bold text-navy-900">عدد الايام</th>
                <th className="min-w-[120px] border border-slate-200 bg-slate-100 px-1 py-1 text-[9px] font-bold text-navy-900">ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, ri) => (
                <tr key={r.employee_code} className={ri % 2 ? 'bg-slate-50/60' : ''}>
                  <td className="sticky right-0 z-10 border border-slate-200 bg-inherit px-1.5 py-1 text-right">
                    <div className="font-bold text-navy-900">{r.name}</div>
                    <div className="text-[8px] text-muted-foreground num">{r.employee_code} — {r.job}</div>
                  </td>
                  <td className="border border-slate-200 px-1 py-1 text-center font-bold text-navy-900">{r.shift || '—'}</td>
                  {days.map((d) => {
                    const c = r.cells[d.iso];
                    return (
                      <td key={d.iso} title={c?.status} className={'border border-slate-200 px-0.5 py-1 text-center font-bold ' + (CODE_CLS[c?.code] ?? 'bg-white')}>
                        {c?.code || ''}
                      </td>
                    );
                  })}
                  <td className="border border-slate-200 px-1 py-1 text-center num font-bold text-navy-900">{r.days_count}</td>
                  <td className="border border-slate-200 px-1 py-1 text-right text-[9px] text-slate-600">{r.note || ''}</td>
                </tr>
              ))}
              <tr className="bg-yellow-300 font-extrabold">
                <td className="sticky right-0 z-10 border border-slate-200 bg-yellow-300 px-1.5 py-1 text-right text-navy-900">الإجمالي اليومي</td>
                <td className="border border-slate-200 bg-yellow-300 px-1 py-1"></td>
                {days.map((d) => <td key={d.iso} className="border border-slate-200 bg-yellow-300 px-0.5 py-1 text-center num">{b.daily_totals[d.iso] ?? 0}</td>)}
                <td className="border border-slate-200 bg-yellow-300 px-1 py-1"></td>
                <td className="border border-slate-200 bg-yellow-300 px-1 py-1"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="mb-4 rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <CalendarDays className="h-4 w-4 text-navy-900" />
          <h2 className="text-sm font-extrabold text-navy-900">التايم شيت الشهري — مطابق للملف المرجعي</h2>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> مولّد من قاعدة البيانات
          </span>
          <span className="mr-auto text-[11px] text-muted-foreground">كتل لكل موقع، دورة رواتب 26→25 أو تقويمية، رموز وحالات وإجماليات فعلية.</span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Field label="السنة"><Select value={year} onChange={(e: any) => setYear(e.target.value)} options={YEARS.map((v) => ({ value: String(v), label: String(v) }))} /></Field>
          <Field label="الشهر"><Select value={month} onChange={(e: any) => setMonth(e.target.value)} options={MONTHS} /></Field>
          <Field label="الدورة"><Select value={mode} onChange={(e: any) => setMode(e.target.value)} options={[{ value: 'payroll', label: 'رواتب (26 → 25)' }, { value: 'calendar', label: 'تقويمية (1 → نهاية الشهر)' }]} /></Field>
          <Field label="عدد الأيام"><Select value={dayCount} onChange={(e: any) => setDayCount(e.target.value)} options={[{ value: '0', label: 'تلقائي' }, { value: '28', label: '28' }, { value: '29', label: '29' }, { value: '30', label: '30' }, { value: '31', label: '31' }]} /></Field>
          <Field label="المشروع"><TextInput value={projectName} onChange={(e: any) => setProjectName(e.target.value)} placeholder="كل المشاريع" /></Field>
          <Field label="الموقع"><TextInput value={siteName} onChange={(e: any) => setSiteName(e.target.value)} placeholder="كل المواقع" /></Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Btn size="sm" onClick={() => load()} disabled={loading}><CalendarDays className="h-4 w-4" /> {loading ? 'جارٍ التحميل...' : 'تحديث من قاعدة البيانات'}</Btn>
          <Btn size="sm" variant="outline" onClick={() => setPickerOpen(true)}><Users className="h-4 w-4" /> اختيار الموظفين {selected.length > 0 ? <span className="mr-1 rounded-full bg-navy-900 px-1.5 text-[10px] text-white num">{selected.length}</span> : null}</Btn>
          {selected.length > 0 ? <Btn size="sm" variant="ghost" onClick={() => { setSelected([]); load([]); }}><X className="h-4 w-4" /> إلغاء التحديد</Btn> : null}
          <span className="mr-auto flex flex-wrap items-center gap-2">
            <Btn size="sm" variant="outline" onClick={exportExcel} disabled={!ts}><FileSpreadsheet className="h-4 w-4" /> Excel (متعدد الأوراق)</Btn>
            <Btn size="sm" variant="outline" onClick={exportCsv} disabled={!ts}>CSV</Btn>
            <Btn size="sm" variant="outline" onClick={() => setShowExtras((v) => !v)} disabled={!extras}><Paperclip className="h-4 w-4" /> الشيتات الإضافية</Btn>
            <Btn size="sm" onClick={downloadPdf} disabled={!ts || pdfBusy}><Download className="h-4 w-4" /> {pdfBusy ? 'جارٍ التوليد...' : 'PDF أفقي A4'}</Btn>
          </span>
        </div>
      </div>

      {ts ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 text-[11px] shadow-sm">
          <span className="font-extrabold text-navy-900">مفتاح الحالات:</span>
          {ts.legend.map((l) => (
            <span key={l.code} className="flex items-center gap-1">
              <span className={'inline-block h-4 w-4 rounded text-center text-[8px] font-bold leading-4 ' + (CODE_CLS[l.code] ?? 'bg-slate-100')}>{l.code}</span>{l.label}
            </span>
          ))}
        </div>
      ) : null}

      {showExtras && extras ? (
        <div className="mb-4 grid gap-3 md:grid-cols-2">
          {[
            { t: 'المخالفات', rows: extras.violations, cols: [['date', 'التاريخ'], ['employee_name', 'الاسم'], ['type', 'النوع'], ['branch', 'الفرع']] },
            { t: 'الاستئذان / الإذن', rows: extras.permissions, cols: [['from', 'من'], ['to', 'إلى'], ['employee_name', 'الاسم'], ['reason', 'السبب']] },
            { t: 'تعيين جديد / مباشر', rows: extras.new_hires, cols: [['date', 'التاريخ'], ['employee_name', 'الاسم'], ['status', 'الحالة'], ['notes', 'ملاحظات']] },
            { t: 'غير متغطي', rows: extras.uncovered, cols: [['date', 'التاريخ'], ['branch', 'الفرع'], ['covered', 'التغطية']] },
          ].map((sec) => (
            <div key={sec.t} className="rounded-xl border bg-card p-3 shadow-sm">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-navy-900"><Table2 className="h-3.5 w-3.5" /> {sec.t} <span className="num text-muted-foreground">({sec.rows.length})</span></div>
              {sec.rows.length === 0 ? <div className="text-[11px] text-muted-foreground">لا سجلات في هذه الدورة</div> : (
                <table className="w-full border-collapse text-[10px]">
                  <thead><tr>{sec.cols.map((c) => <th key={c[0]} className="border border-slate-200 bg-slate-100 px-1 py-1 text-right">{c[1]}</th>)}</tr></thead>
                  <tbody>{sec.rows.slice(0, 12).map((r, i) => <tr key={i} className={i % 2 ? 'bg-slate-50/60' : ''}>{sec.cols.map((c) => <td key={c[0]} className="border border-slate-200 px-1 py-1">{String(r[c[0]] ?? '')}</td>)}</tr>)}</tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {!ts || ts.blocks.length === 0 ? (
        <div className="rounded-xl border bg-card py-14 text-center text-sm text-muted-foreground shadow-sm">{loading ? 'جارٍ التحميل...' : 'لا توجد بيانات مطابقة — حدّث الفلاتر أو اضغط تحديث'}</div>
      ) : (
        ts.blocks.map((b) => renderBlock(b))
      )}

      <div className="seyaj-print-area absolute -left-[10000px] top-0 print:static print:left-0">
        <div ref={paperRef}>
          <OfficialPaper title={'تايم شيت — ' + (MONTHS.find((m) => m.value === month)?.label || month) + ' ' + year}
            subtitle={mode === 'payroll' ? 'دورة الرواتب من 26 إلى 25 — مولّد من قاعدة البيانات' : 'دورة تقويمية — مولّد من قاعدة البيانات'} landscape
            meta={[{ k: 'المشروع', v: projectName || 'الكل' }, { k: 'الموظفون', v: String(allEmployees.length) }, { k: 'المواقع', v: String(ts?.blocks.length ?? 0) }]}>
            {ts?.blocks.map((b) => renderBlock(b, true))}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[9px]">
              <span className="font-extrabold">مفتاح:</span>
              {ts?.legend.map((l) => <span key={l.code} className="font-bold">{l.code} = {l.label}</span>)}
            </div>
            <div className="mt-6 grid grid-cols-3 gap-6 text-center text-[10px] font-bold text-navy-900">
              <div className="border-t border-slate-400 pt-1">إعداد</div>
              <div className="border-t border-slate-400 pt-1">مراجعة</div>
              <div className="border-t border-slate-400 pt-1">اعتماد</div>
            </div>
          </OfficialPaper>
        </div>
      </div>

      {pickerOpen ? (
        <div className="seyaj-modal fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPickerOpen(false)}>
          <div className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-2xl border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b p-3">
              <Users className="h-4 w-4 text-navy-900" />
              <h3 className="text-sm font-extrabold text-navy-900">اختيار الموظفين للتايم شيت</h3>
              <span className="mr-auto flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <TextInput value={empQuery} onChange={(e: any) => setEmpQuery(e.target.value)} placeholder="ابحث بالاسم أو الكود أو الموقع..." className="pr-8" />
                </div>
                <Btn size="sm" variant="ghost" onClick={() => setPickerOpen(false)}><X className="h-4 w-4" /></Btn>
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {filteredPicker.length === 0 ? <div className="py-8 text-center text-xs text-muted-foreground">لا موظفين مطابقون</div> : (
                <table className="w-full border-collapse text-[11px]">
                  <thead><tr className="text-navy-900">
                    <th className="w-8"></th><th className="px-2 py-1 text-right">الموظف</th><th className="px-2 py-1 text-right">المشروع</th><th className="px-2 py-1 text-right">الموقع</th><th className="px-2 py-1 text-right">الوظيفة</th>
                  </tr></thead>
                  <tbody>
                    {filteredPicker.map((e, i) => {
                      const on = selected.includes(e.employee_code);
                      return (
                        <tr key={e.employee_code} onClick={() => toggleEmp(e.employee_code)} className={'cursor-pointer border-t ' + (on ? 'bg-sky-50' : i % 2 ? 'bg-slate-50/60' : '')}>
                          <td className="px-2 py-1.5"><span className={'inline-flex h-4 w-4 items-center justify-center rounded border ' + (on ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-300')}>{on ? <CheckCircle2 className="h-3 w-3" /> : null}</span></td>
                          <td className="px-2 py-1.5"><div className="font-bold text-navy-900">{e.name}</div><div className="text-[9px] num text-muted-foreground">{e.employee_code}</div></td>
                          <td className="px-2 py-1.5">{e.project || '—'}</td>
                          <td className="px-2 py-1.5">{e.site || '—'}</td>
                          <td className="px-2 py-1.5">{e.job || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="flex items-center gap-2 border-t p-3">
              <span className="text-[11px] text-muted-foreground">المحدد: <span className="num font-bold text-navy-900">{selected.length}</span></span>
              <span className="mr-auto flex gap-2">
                <Btn size="sm" variant="outline" onClick={() => setSelected(allEmployees.map((e) => e.employee_code))}>تحديد الكل</Btn>
                <Btn size="sm" variant="outline" onClick={() => setSelected([])}>تفريغ</Btn>
                <Btn size="sm" onClick={() => { setPickerOpen(false); load(); }}><CheckCircle2 className="h-4 w-4" /> تطبيق</Btn>
              </span>
            </div>
          </div>
        </div>
      ) : null}
      {toast.node}
    </div>
  );
}