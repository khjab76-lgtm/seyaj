import { useMemo, useRef, useState } from 'react';
import { FileBarChart2, Filter, RotateCcw, Play, Download, Printer, Table2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { Select, TextInput, Btn, Field, Table, EmptyRow, StatusBadge, useToast } from '@/components/ui-kit';
import OfficialPaper from '@/components/OfficialPaper';
import { REPORT_CATALOG, EMPTY_FILTERS, runReport, type ReportFilters, type ReportResult } from '@/lib/reportCenter';
import { isEmpReport, runEmpReport } from '@/lib/employeeReports';
import { exportAoaXlsx, exportElementPdf, STATUSES } from '@/lib/reportBuilder';

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

export default function ReportCenterTab() {
  const store = useStore();
  const { employees, sites, projects, zones } = store;
  const toast = useToast();
  const [reportKey, setReportKey] = useState('attendance');
  const [f, setF] = useState<ReportFilters>({ ...EMPTY_FILTERS, from: '2026-09-01', to: '2026-09-30' });
  const [applied, setApplied] = useState<ReportFilters | null>(null);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const paperRef = useRef<HTMLDivElement>(null);

  const set = (k: keyof ReportFilters, v: string) => setF((p) => ({ ...p, [k]: v }));

  const run = async () => {
    if (isEmpReport(reportKey)) {
      setBusy(true);
      try {
        const code = f.employeeId === 'all' ? '' : f.employeeId;
        const empRes = await runEmpReport(reportKey, code, f.from, f.to);
        setResult(empRes);
        setApplied({ ...f });
        toast.show('تم عرض «' + empRes.title + '» — ' + empRes.rows.length + ' سجلًا (من الخادم عبر employee_code)');
      } catch (err: any) {
        toast.show('تعذّر جلب التقرير: ' + (err?.message || 'خطأ'));
      } finally {
        setBusy(false);
      }
      return;
    }
    const res = runReport(store, reportKey, f, 2026, Number(f.from ? f.from.slice(5, 7) : '09'));
    setResult(res);
    setApplied({ ...f });
    toast.show('تم عرض «' + res.title + '» — ' + res.rows.length + ' سجلًا');
  };

  const reset = () => { setF({ ...EMPTY_FILTERS, from: '2026-09-01', to: '2026-09-30' }); setResult(null); setApplied(null); };

  const aoa = useMemo(() => {
    if (!result) return [];
    return [result.columns, ...result.rows];
  }, [result]);

  const exportExcel = () => {
    if (!result) { toast.show('اعرض التقرير أولًا'); return; }
    exportAoaXlsx(result.title + '.xlsx', aoa);
  };
  const exportCsv = () => {
    if (!result) { toast.show('اعرض التقرير أولًا'); return; }
    const esc = (v: any) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    downloadText(result.title + '.csv', aoa.map((r) => r.map(esc).join(',')).join('\n'), 'text/csv;charset=utf-8;');
  };
  const downloadPdf = async () => {
    if (!result) { toast.show('اعرض التقرير أولًا'); return; }
    setPdfBusy(true);
    try { await exportElementPdf(paperRef.current, result.title + '.pdf'); }
    catch (err: any) { toast.show('تعذّر توليد PDF: ' + (err?.message || 'خطأ')); }
    finally { setPdfBusy(false); }
  };

  const def = REPORT_CATALOG.find((r) => r.key === reportKey);

  return (
    <div>
      <div className="mb-4 rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <FileBarChart2 className="h-4 w-4 text-navy-900" />
          <h2 className="text-sm font-extrabold text-navy-900">مركز التقارير — 17 تقريرًا مربوطًا ببيانات النظام الفعلية (تقارير الموظفين تُجلب من الخادم عبر employee_code)</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <div className="lg:col-span-4">
            <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4 lg:grid-cols-5">
              {REPORT_CATALOG.map((r) => (
                <button key={r.key} onClick={() => setReportKey(r.key)} title={r.desc}
                  className={'rounded-lg border px-2 py-1.5 text-right text-[11px] font-bold transition-colors ' + (reportKey === r.key ? 'border-navy-900 bg-navy-900 text-gold-400' : 'bg-card text-foreground hover:bg-muted')}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs font-bold text-muted-foreground"><Filter className="h-3.5 w-3.5" /> الفلاتر</div>
        <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
          <Field label="من"><TextInput type="date" value={f.from} onChange={(e: any) => set('from', e.target.value)} /></Field>
          <Field label="إلى"><TextInput type="date" value={f.to} onChange={(e: any) => set('to', e.target.value)} /></Field>
          <Field label="المشروع"><Select value={f.projectId} onChange={(e: any) => { set('projectId', e.target.value); set('siteId', 'all'); }} options={[{ value: 'all', label: 'الكل' }, ...projects.map((p: any) => ({ value: String(p.id), label: p.name }))]} /></Field>
          <Field label="المنطقة"><Select value={f.zoneId} onChange={(e: any) => { set('zoneId', e.target.value); set('siteId', 'all'); }} options={[{ value: 'all', label: 'الكل' }, ...zones.map((z: any) => ({ value: String(z.id), label: z.name }))]} /></Field>
          <Field label="الموقع"><Select value={f.siteId} onChange={(e: any) => set('siteId', e.target.value)} options={[{ value: 'all', label: 'الكل' }, ...sites.filter((s: any) => f.zoneId === 'all' || String(s.zoneId) === f.zoneId).map((s: any) => ({ value: String(s.id), label: s.name }))]} /></Field>
          <Field label="الموظف (employee_code)"><Select value={f.employeeId} onChange={(e: any) => set('employeeId', e.target.value)} options={[{ value: 'all', label: 'الكل' }, ...employees.map((e: any) => ({ value: e.no, label: e.name + ' — ' + e.no }))]} /></Field>
          <Field label="الحالة"><Select value={f.status} onChange={(e: any) => set('status', e.target.value)} options={[{ value: 'all', label: 'الكل' }, ...STATUSES.map((s: string) => ({ value: s, label: s }))]} /></Field>
          <Field label="بحث"><TextInput value={f.search} onChange={(e: any) => set('search', e.target.value)} placeholder="اسم أو رقم وظيفي" /></Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Btn size="sm" disabled={busy} onClick={run}><Play className="h-4 w-4" /> {busy ? 'جارٍ الجلب من الخادم...' : 'عرض التقرير'}</Btn>
          <Btn size="sm" variant="outline" onClick={reset}><RotateCcw className="h-4 w-4" /> إعادة تعيين</Btn>
          <div className="mr-auto flex flex-wrap gap-2">
            <Btn size="sm" variant="outline" onClick={exportExcel}><Download className="h-4 w-4" /> Excel</Btn>
            <Btn size="sm" variant="outline" onClick={exportCsv}>CSV</Btn>
            <Btn size="sm" variant="outline" disabled={pdfBusy} onClick={downloadPdf}>{pdfBusy ? 'جارٍ التوليد...' : 'PDF'}</Btn>
            <Btn size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> طباعة</Btn>
          </div>
        </div>
      </div>

      {result ? (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-extrabold text-navy-900"><Table2 className="h-4 w-4" /> {result.title}</div>
            <span className="text-xs text-muted-foreground">{result.rows.length} سجل — فلاتر مطبقة: {applied && (applied.from || '—')} → {applied && (applied.to || '—')}</span>
          </div>
          <Table head={result.columns}>
            {result.rows.length ? result.rows.map((r, i) => (
              <tr key={i} className="hover:bg-muted/40">
                {r.map((c: any, j: number) => (
                  <td key={j} className={'px-4 py-2.5 ' + (j === 0 ? 'font-mono text-[11px]' : '') + (String(c) === 'معتمد' || String(c) === 'معلق' || String(c) === 'مرفوض' || String(c) === 'نشط' || String(c) === 'إجازة' || String(c) === 'موقوف' ? ' ' : '')}>
                    {['معتمد', 'معلق', 'مرفوض', 'نشط', 'إجازة', 'موقوف', 'حاضر', 'غائب', 'متأخر', 'منصرف'].includes(String(c)) ? <StatusBadge value={String(c)} /> : String(c ?? '—')}
                  </td>
                ))}
              </tr>
            )) : <EmptyRow colSpan={result.columns.length} />}
          </Table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed bg-card py-16 text-center text-sm text-muted-foreground shadow-sm">
          اختر تقريرًا من الكتالوج واضبط الفلاتر ثم اضغط «عرض التقرير» — كل الأرقام تُشتق لحظيًا من الحضور والطلبات والرواتب والمخالفات.
        </div>
      )}

      {result && (
        <div className="print-paper-wrap mt-4 hidden print:block">
          <div ref={paperRef}>
            <OfficialPaper title={result.title} subtitle={'مركز تقارير سياج — الفترة ' + (applied?.from || '—') + ' إلى ' + (applied?.to || '—')} landscape
              meta={[{ k: 'عدد السجلات', v: String(result.rows.length) }, { k: 'التقرير', v: def?.label || '' }]}>
              <table className="w-full border-collapse text-[8px]">
                <thead><tr>{result.columns.map((c, i) => <th key={i} className="border border-slate-300 bg-slate-200 px-1 py-1 text-right">{c}</th>)}</tr></thead>
                <tbody>
                  {result.rows.slice(0, 120).map((r, ri) => (
                    <tr key={ri} className={ri % 2 ? 'bg-slate-50' : ''}>{r.map((c: any, j: number) => <td key={j} className="border border-slate-300 px-1 py-1">{String(c ?? '—')}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </OfficialPaper>
          </div>
        </div>
      )}
      {toast.node}
    </div>
  );
}