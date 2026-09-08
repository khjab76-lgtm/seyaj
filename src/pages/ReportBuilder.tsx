import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpDown, BarChart3, Check, ChevronLeft, ChevronRight, Columns3, Download, Eye,
  FileDown, FileSpreadsheet, Filter, GripVertical, Layers, Loader2, Plus, Printer,
  Save, Settings2, Table2, Trash2, X,
} from 'lucide-react';
import { Btn, Field, Modal, Select, TextInput, useToast } from '@/components/ui-kit';
import OfficialPaper from '@/components/OfficialPaper';
import { exportElementPdf } from '@/lib/reportBuilder';
import {
  exportDynamicCsv, exportDynamicXlsx, exportSheetsXlsx, fetchFieldOptions, fetchFooter,
  fetchReportMeta, fmtNum, runReport, saveFooter,
  type ReportColumn, type ReportFilterDef, type ReportMeta, type ReportTypeDef,
} from '@/lib/reportEngine';
import { deleteReportTemplate, fetchReportTemplates, saveReportTemplate } from '@/lib/reportTemplatesApi';

// ===== أنواع محلية =====
interface SelCol { key: string; label: string; width: number; }
interface NumRange { min: string; max: string; }
interface Filters {
  search: string; date_from: string; date_to: string;
  [k: string]: string | NumRange | undefined;
}
interface PrintCfg { landscape: boolean; showTotals: boolean; showMeta: boolean; }
interface Template {
  name: string; type: string; cols: SelCol[]; filters: Filters;
  sortKey: string; sortDir: 'asc' | 'desc'; print: PrintCfg;
}

const FOOTER_FIELDS: Array<[string, string]> = [
  ['العنوان الوطني', 'مثال: الرياض - حي الملقا - طريق أنس بن مالك'],
  ['الرمز البريدي', '12345'],
  ['السجل التجاري', '1010XXXXXX'],
  ['ترخيص النشاط', 'ترخيص حراسات أمنية رقم ...'],
  ['الهاتف', '011XXXXXXX'],
  ['البريد الإلكتروني', 'info@seyaj.sa'],
];

function emptyFilters(): Filters { return { search: '', date_from: '', date_to: '' }; }



function displayVal(v: any, num?: boolean): string {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'boolean') return v ? 'نعم' : 'لا';
  if (num) return fmtNum(Number(v) || 0);
  const s = String(v);
  if (s === 'true' || s === 'True') return 'نعم';
  if (s === 'false' || s === 'False') return 'لا';
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  return s;
}

// ===== تايم شيت مخصص من سجلات الحضور =====
interface TsRow {
  code: string; name: string; site: string; days: Record<number, string>;
  present: number; absent: number; late: number; otHours: number;
}

function monthDays(dateFrom: string): { year: number; month: number; n: number } {
  const d = dateFrom ? new Date(dateFrom) : new Date();
  const y = d.getFullYear(); const m = d.getMonth();
  const n = new Date(y, m + 1, 0).getDate();
  return { year: y, month: m, n };
}

function statusMark(status: any): string {
  const s = String(status || '');
  if (['present', 'حاضر'].includes(s)) return 'ح';
  if (['late', 'متأخر'].includes(s)) return 'ت';
  if (['checked_out', 'منصرف'].includes(s)) return 'ان';
  if (['absent', 'غائب'].includes(s)) return 'غ';
  return s ? s.slice(0, 2) : '';
}

function hoursBetween(ci: any, co: any): number {
  const parse = (t: any) => {
    const s = String(t || ''); const m = s.match(/(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) + Number(m[2]) / 60 : null;
  };
  const a = parse(ci); const b = parse(co);
  if (a === null || b === null) return 0;
  let h = b - a; if (h < 0) h += 24;
  return h;
}

function buildTimesheet(rows: any[], dateFrom: string): { days: number[]; rows: TsRow[] } {
  const { n } = monthDays(dateFrom);
  const days = Array.from({ length: n }, (_, i) => i + 1);
  const map = new Map<string, TsRow>();
  rows.forEach((r) => {
    const code = String(r.employee_code || r.employee_name || '');
    if (!code) return;
    const day = String(r.work_date || '').slice(8, 10);
    const dn = Number(day);
    if (!dn) return;
    let row = map.get(code);
    if (!row) {
      row = { code, name: String(r.employee_name || ''), site: String(r.site_name || ''), days: {}, present: 0, absent: 0, late: 0, otHours: 0 };
      map.set(code, row);
    }
    const mark = statusMark(r.status);
    row.days[dn] = mark;
    if (mark === 'ح' || mark === 'ان') row.present += 1;
    if (mark === 'غ') row.absent += 1;
    if (mark === 'ت') row.late += 1;
    const h = hoursBetween(r.check_in_time, r.check_out_time);
    if (h > 8) row.otHours += h - 8;
  });
  return { days, rows: Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar')) };
}

// ============================================================
export default function ReportBuilder() {
  const toast = useToast();
  const [meta, setMeta] = useState<ReportMeta | null>(null);
  const [metaErr, setMetaErr] = useState('');
  const [type, setType] = useState('');

  const [sel, setSel] = useState<SelCol[]>([]);
  const [filters, setFilters] = useState<Filters>(emptyFilters());
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [res, setRes] = useState<{ columns: ReportColumn[]; rows: any[]; total: number; totals: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCols, setShowCols] = useState(true);
  const [opts, setOpts] = useState<Record<string, string[]>>({});

  const [preview, setPreview] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [print, setPrint] = useState<PrintCfg>({ landscape: false, showTotals: true, showMeta: true });
  const [footer, setFooter] = useState<Record<string, string>>({});
  const [footerOpen, setFooterOpen] = useState(false);
  const [footerDraft, setFooterDraft] = useState<Record<string, string>>({});
  const [saveOpen, setSaveOpen] = useState(false);
  const [tplName, setTplName] = useState('');
  const [tpls, setTpls] = useState<Template[]>([]);
  const [tsMode, setTsMode] = useState(false);
  const [tsBusy, setTsBusy] = useState(false);
  const paperRef = useRef<HTMLDivElement>(null);
  const dragIdx = useRef(-1);

  const typeDef: ReportTypeDef | null = useMemo(
    () => meta?.report_types.find((t) => t.key === type) || null, [meta, type]);

  // ===== تحميل التعريفات + التذييل =====
  useEffect(() => {
    fetchReportMeta()
      .then((m) => {
        setMeta(m);
        if (m.report_types.length) setType(m.report_types[0].key);
      })
      .catch((e) => setMetaErr(String(e?.message || e)));
    fetchFooter().then(setFooter).catch(() => {});
    fetchReportTemplates().then((items) => setTpls(items as Template[])).catch(() => {});
  }, []);

  // ===== عند تغيير النوع: إعادة الضبط + تحميل خيارات الفلاتر =====
  useEffect(() => {
    if (!typeDef) return;
    const defaults: SelCol[] = typeDef.columns.slice(0, 7).map((c) => ({ key: c.key, label: c.label, width: 0 }));
    setSel(defaults);
    setFilters(emptyFilters());
    setSortKey(''); setPage(1); setTsMode(false);
    setRes(null);
    const loadOpts = async () => {
      const next: Record<string, string[]> = {};
      for (const f of typeDef.filters) {
        if (f.type !== 'select') continue;
        try {
          const scope = f.field === 'site_name' && (filters.project_name as string) ? { project_name: filters.project_name as string } : undefined;
          next[f.field] = await fetchFieldOptions(typeDef.key, f.field, scope);
        } catch { next[f.field] = []; }
      }
      setOpts(next);
    };
    loadOpts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeDef?.key]);

  // ===== تنفيذ التقرير =====
  const run = useCallback(async (p = page) => {
    if (!typeDef || !sel.length) { toast.show('اختر عمودًا واحدًا على الأقل'); return; }
    setLoading(true);
    try {
      const r = await runReport({
        report_type: typeDef.key,
        columns: sel.map((c) => ({ key: c.key, label: c.label, width: c.width || undefined })),
        filters: buildFilterPayload(typeDef, filters),
        sort_key: sortKey || null, sort_dir: sortDir, page: p, page_size: pageSize,
      });
      setRes({ columns: r.columns, rows: r.rows, total: r.total, totals: r.totals });
      setPage(r.page);
    } catch (e: any) {
      toast.show('تعذّر تنفيذ التقرير: ' + (e?.message || e));
    } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeDef, sel, filters, sortKey, sortDir, pageSize]);

  useEffect(() => { if (typeDef && sel.length) run(1); /* eslint-disable-next-line */ }, [typeDef?.key, sel.length]);

  function buildFilterPayload(def: ReportTypeDef, f: Filters): Record<string, any> {
    const out: Record<string, any> = {};
    if (f.search) out.search = f.search;
    if (f.date_from) out.date_from = f.date_from;
    if (f.date_to) out.date_to = f.date_to;
    def.filters.forEach((fd) => {
      const v = f[fd.field];
      if (fd.type === 'number') {
        const nr = v as NumRange | undefined;
        if (nr && (nr.min || nr.max)) out[fd.field] = { min: nr.min || null, max: nr.max || null };
      } else if (v && v !== 'all') out[fd.field] = v;
    });
    return out;
  }

  const setF = (k: string, v: any) => { setFilters((p) => ({ ...p, [k]: v })); };
  const setNum = (k: string, part: 'min' | 'max', v: string) =>
    setFilters((p) => { const cur = (p[k] as NumRange) || { min: '', max: '' }; return { ...p, [k]: { ...cur, [part]: v } }; });

  // ===== إدارة الأعمدة =====
  const toggleCol = (key: string) => {
    if (!typeDef) return;
    setSel((p) => {
      if (p.some((c) => c.key === key)) return p.filter((c) => c.key !== key);
      const def = typeDef.columns.find((c) => c.key === key)!;
      return [...p, { key: def.key, label: def.label, width: 0 }];
    });
  };
  const renameCol = (key: string, label: string) => setSel((p) => p.map((c) => (c.key === key ? { ...c, label } : c)));
  const setWidth = (key: string, width: number) => setSel((p) => p.map((c) => (c.key === key ? { ...c, width } : c)));
  const onDrop = (idx: number) => {
    setSel((p) => {
      if (dragIdx.current < 0 || dragIdx.current === idx) return p;
      const next = [...p]; const [m] = next.splice(dragIdx.current, 1); next.splice(idx, 0, m);
      dragIdx.current = -1; return next;
    });
  };
  const sortBy = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };
  useEffect(() => { if (sortKey) run(1); /* eslint-disable-next-line */ }, [sortKey, sortDir]);

  // ===== القوالب =====
  const saveTpl = async () => {
    const name = tplName.trim();
    if (!name) { toast.show('اكتب اسم القالب'); return; }
    const t: Template = { name, type, cols: sel, filters, sortKey, sortDir, print };
    try {
      const items = await saveReportTemplate(t);
      setTpls(items as Template[]);
      setTplName(''); setSaveOpen(false); toast.show('حُفظ القالب على الخادم: ' + name);
    } catch (e: any) {
      toast.show('تعذّر حفظ القالب: ' + (e?.message || e));
    }
  };
  const applyTpl = (t: Template) => {
    if (!meta) return;
    setType(t.type);
    setTimeout(() => {
      setSel(t.cols); setFilters({ ...emptyFilters(), ...t.filters });
      setSortKey(t.sortKey); setSortDir(t.sortDir); setPrint(t.print);
      toast.show('تم تطبيق قالب: ' + t.name);
    }, 0);
  };
  const removeTpl = async (name: string) => {
    try {
      const items = await deleteReportTemplate(name);
      setTpls(items as Template[]);
      toast.show('حُذف القالب: ' + name);
    } catch (e: any) {
      toast.show('تعذّر حذف القالب: ' + (e?.message || e));
    }
  };

  // ===== التصدير =====
  const metaRows = (): Array<[string, string]> => {
    if (!typeDef) return [];
    const rows: Array<[string, string]> = [['نوع التقرير', typeDef.label]];
    if (filters.date_from || filters.date_to) rows.push(['الفترة', (filters.date_from || '...') + ' ← ' + (filters.date_to || '...')]);
    if (filters.search) rows.push(['بحث', String(filters.search)]);
    typeDef.filters.forEach((fd) => {
      const v = filters[fd.field];
      if (fd.type === 'number') { const nr = v as NumRange; if (nr && (nr.min || nr.max)) rows.push([fd.label, (nr.min || '0') + ' ← ' + (nr.max || '∞')]); }
      else if (v && v !== 'all') rows.push([fd.label, String(v)]);
    });
    return rows;
  };

  const exportExcel = () => {
    if (!res?.rows.length) return;
    exportDynamicXlsx('seyaj-' + type + '-report', res.columns, res.rows, res.totals, metaRows());
    toast.show('تم تصدير Excel');
  };
  const exportCsv = () => {
    if (!res?.rows.length) return;
    exportDynamicCsv('seyaj-' + type + '-report', res.columns, res.rows);
    toast.show('تم تصدير CSV');
  };
  const downloadPdf = async () => {
    setPdfBusy(true);
    try { await exportElementPdf(paperRef.current, 'seyaj-' + type + '-report.pdf'); toast.show('تم تنزيل PDF'); }
    catch (e: any) { toast.show('تعذّر توليد PDF: ' + (e?.message || e)); }
    finally { setPdfBusy(false); }
  };

  // ===== التايم شيت =====
  const runTimesheet = async (allSites: boolean) => {
    if (!typeDef) return;
    setTsBusy(true);
    try {
      const r = await runReport({
        report_type: 'attendance',
        columns: [
          { key: 'employee_code' }, { key: 'employee_name' }, { key: 'site_name' },
          { key: 'work_date' }, { key: 'check_in_time' }, { key: 'check_out_time' }, { key: 'status' },
        ],
        filters: buildFilterPayload(typeDef, filters), sort_key: 'work_date', sort_dir: 'asc', page: 1, page_size: 2000,
      });
      const ts = buildTimesheet(r.rows, filters.date_from);
      if (!ts.rows.length) { toast.show('لا توجد سجلات حضور للفترة'); return; }
      if (allSites) {
        const bySite = new Map<string, TsRow[]>();
        ts.rows.forEach((row) => { const k = row.site || 'غير محدد'; if (!bySite.has(k)) bySite.set(k, []); bySite.get(k)!.push(row); });
        const sheets = Array.from(bySite.entries()).map(([site, rows]) => ({
          name: site,
          aoa: [['التايم شيت — ' + site], [], ['م', 'رقم', 'اسم الموظف', ...ts.days.map(String), 'حضور', 'غياب', 'تأخير', 'إضافي'],
            ...rows.map((row, i) => [i + 1, row.code, row.name, ...ts.days.map((d) => row.days[d] || ''), row.present, row.absent, row.late, Math.round(row.otHours)])],
        }));
        exportSheetsXlsx('seyaj-timesheet-all', sheets);
      } else {
        const aoa: any[][] = [['التايم شيت الشهري'], [], ['م', 'رقم الموظف', 'اسم الموظف', 'الموقع', ...ts.days.map(String), 'حضور', 'غياب', 'تأخير', 'إضافي'],
          ...ts.rows.map((row, i) => [i + 1, row.code, row.name, row.site, ...ts.days.map((d) => row.days[d] || ''), row.present, row.absent, row.late, Math.round(row.otHours)])];
        // استبدال التصدير العام بالتايم شيت المخصص:
        exportSheetsXlsx('seyaj-timesheet', [{ name: 'التايم شيت', aoa }]);
      }
      toast.show(allSites ? 'تم تصدير جميع المواقع' : 'تم تصدير التايم شيت');
    } catch (e: any) { toast.show('تعذّر بناء التايم شيت: ' + (e?.message || e)); }
    finally { setTsBusy(false); }
  };

  // ===== التذييل =====
  const openFooter = () => { setFooterDraft({ ...footer }); setFooterOpen(true); };
  const saveFooterCfg = async () => {
    try { await saveFooter(footerDraft); setFooter(footerDraft); setFooterOpen(false); toast.show('حُفظ التذييل الرسمي'); }
    catch (e: any) { toast.show('تعذّر حفظ التذييل: ' + (e?.message || e)); }
  };

  const totalPages = res ? Math.max(1, Math.ceil(res.total / pageSize)) : 1;
  const hasNum = !!res?.columns.some((c) => c.num);

  // ============================================================
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm no-print">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-900 text-gold-400"><BarChart3 className="h-4 w-4" /></span>
          <div>
            <div className="text-sm font-extrabold text-navy-900">منشئ التقارير الديناميكي</div>
            <div className="text-[11px] text-muted-foreground">متصل بقاعدة البيانات — فلترة وفرز وترقيم وتجميع خادمي، معاينة رسمية وتصدير</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Btn variant="outline" size="sm" onClick={openFooter}><Settings2 className="h-4 w-4" /> التذييل الرسمي</Btn>
          <Btn variant="outline" size="sm" onClick={() => setSaveOpen(true)}><Save className="h-4 w-4" /> حفظ كقالب</Btn>
          <Btn variant="outline" size="sm" disabled={!res?.rows.length} onClick={exportCsv}><FileDown className="h-4 w-4" /> CSV</Btn>
          <Btn variant="outline" size="sm" disabled={!res?.rows.length} onClick={exportExcel}><FileSpreadsheet className="h-4 w-4" /> Excel</Btn>
          <Btn variant="primary" size="sm" disabled={!res?.rows.length} onClick={() => setPreview(true)}><Printer className="h-4 w-4" /> معاينة / طباعة</Btn>
        </div>
      </div>

      {metaErr && <div className="mb-4 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700 no-print">تعذّر الاتصال بخادم التقارير: {metaErr}</div>}
      {!meta && !metaErr && <div className="mb-4 flex items-center gap-2 rounded-xl border bg-card p-4 text-sm text-muted-foreground shadow-sm no-print"><Loader2 className="h-4 w-4 animate-spin" /> جارٍ تحميل تعريفات التقارير...</div>}

      {meta && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
          {/* ===== اللوحة الجانبية ===== */}
          <div className="space-y-4 no-print">
            {/* القوالب */}
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-xs font-extrabold text-navy-900"><Layers className="h-4 w-4" /> قوالب النظام</div>
              <div className="flex flex-wrap gap-1.5">
                {meta.report_types.map((t) => (
                  <button key={t.key} onClick={() => setType(t.key)}
                    className={'rounded-lg border px-2 py-1 text-[11px] font-bold transition-colors ' + (type === t.key ? 'border-navy-900 bg-navy-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}>
                    {t.label}
                  </button>
                ))}
              </div>
              {tpls.length > 0 && (
                <>
                  <div className="mb-2 mt-3 flex items-center gap-2 text-xs font-extrabold text-navy-900"><Save className="h-4 w-4" /> قوالب محفوظة</div>
                  <div className="flex flex-wrap gap-1.5">
                    {tpls.map((t) => (
                      <span key={t.name} className="flex items-center gap-1 rounded-lg border border-gold-400/50 bg-gold-400/10 px-2 py-1 text-[11px] font-bold text-navy-900">
                        <button onClick={() => applyTpl(t)}>{t.name}</button>
                        <button onClick={() => removeTpl(t.name)} className="text-rose-600"><Trash2 className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* الفلاتر */}
            {typeDef && (
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2 text-xs font-extrabold text-navy-900"><Filter className="h-4 w-4" /> الفلاتر</div>
                <div className="space-y-3">
                  {typeDef.has_search && (
                    <Field label="بحث (اسم / رقم)...">
                      <TextInput value={filters.search} onChange={(e: any) => setF('search', e.target.value)} placeholder="ابحث..." />
                    </Field>
                  )}
                  {typeDef.date_field && (
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="من تاريخ"><TextInput type="date" value={filters.date_from} onChange={(e: any) => setF('date_from', e.target.value)} /></Field>
                      <Field label="إلى تاريخ"><TextInput type="date" value={filters.date_to} onChange={(e: any) => setF('date_to', e.target.value)} /></Field>
                    </div>
                  )}
                  {typeDef.filters.map((fd: ReportFilterDef) => {
                    if (fd.type === 'select') {
                      const list = opts[fd.field] || [];
                      return (
                        <Field key={fd.field} label={fd.label}>
                          <Select value={(filters[fd.field] as string) || 'all'}
                            onChange={(e: any) => {
                              setF(fd.field, e.target.value);
                              if (fd.field === 'project_name') {
                                // إعادة ربط خيارات الموقع بالمشروع المختار
                                fetchFieldOptions(typeDef.key, 'site_name', e.target.value !== 'all' ? { project_name: e.target.value } : undefined)
                                  .then((o) => setOpts((p) => ({ ...p, site_name: o })))
                                  .catch(() => {});
                                setF('site_name', 'all');
                              }
                            }}
                            options={[{ value: 'all', label: 'الكل' }, ...list.map((v) => ({ value: String(v), label: String(v) }))]} />
                        </Field>
                      );
                    }
                    if (fd.type === 'number') {
                      const nr = (filters[fd.field] as NumRange) || { min: '', max: '' };
                      return (
                        <Field key={fd.field} label={fd.label + ' (من/إلى)'}>
                          <div className="grid grid-cols-2 gap-2">
                            <TextInput type="number" placeholder="من" value={nr.min} onChange={(e: any) => setNum(fd.field, 'min', e.target.value)} />
                            <TextInput type="number" placeholder="إلى" value={nr.max} onChange={(e: any) => setNum(fd.field, 'max', e.target.value)} />
                          </div>
                        </Field>
                      );
                    }
                    return (
                      <Field key={fd.field} label={fd.label}>
                        <Select value={(filters[fd.field] as string) || 'all'} onChange={(e: any) => setF(fd.field, e.target.value)}
                          options={[{ value: 'all', label: 'الكل' }, { value: 'true', label: 'نعم' }, { value: 'false', label: 'لا' }]} />
                      </Field>
                    );
                  })}
                  <Btn size="sm" className="w-full" disabled={loading} onClick={() => run(1)}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} تنفيذ التقرير
                  </Btn>
                </div>
              </div>
            )}

            {/* الأعمدة */}
            {typeDef && (
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <button onClick={() => setShowCols((v) => !v)} className="mb-3 flex w-full items-center justify-between text-xs font-extrabold text-navy-900">
                  <span className="flex items-center gap-2"><Columns3 className="h-4 w-4" /> الحقول ({sel.length})</span>
                  <span className="text-[10px] text-muted-foreground">{showCols ? 'إخفاء' : 'إظهار'}</span>
                </button>
                {showCols && (
                  <>
                    <div className="mb-2 text-[10px] text-muted-foreground">اسحب لإعادة الترتيب — اضغط على الاسم لإعادة التسمية</div>
                    <div className="space-y-1.5">
                      {sel.map((c, i) => (
                        <div key={c.key} draggable onDragStart={() => (dragIdx.current = i)} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(i)}
                          className="flex items-center gap-1.5 rounded-lg border bg-white p-1.5">
                          <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-slate-400" />
                          <input className="w-full min-w-0 rounded border bg-slate-50 px-1.5 py-1 text-[11px] font-bold text-navy-900 outline-none focus:ring-1 focus:ring-navy-900"
                            value={c.label} onChange={(e) => renameCol(c.key, e.target.value)} />
                          <input type="number" className="w-12 shrink-0 rounded border bg-slate-50 px-1 py-1 text-center text-[10px] outline-none"
                            placeholder="عرض" value={c.width || ''} onChange={(e) => setWidth(c.key, Number(e.target.value) || 0)} />
                          <button onClick={() => toggleCol(c.key)} className="shrink-0 text-rose-500"><X className="h-3.5 w-3.5" /></button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 border-t pt-2">
                      <div className="mb-1.5 text-[10px] font-bold text-muted-foreground">إضافة حقول</div>
                      <div className="flex flex-wrap gap-1">
                        {typeDef.columns.filter((c) => !sel.some((s) => s.key === c.key)).map((c) => (
                          <button key={c.key} onClick={() => toggleCol(c.key)} className="flex items-center gap-1 rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50">
                            <Plus className="h-2.5 w-2.5" /> {c.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* إعدادات الطباعة */}
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="mb-2 text-xs font-extrabold text-navy-900">إعدادات الطباعة</div>
              <label className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold"><input type="checkbox" checked={print.landscape} onChange={(e) => setPrint((p) => ({ ...p, landscape: e.target.checked }))} /> اتجاه عرضي (A4 Landscape)</label>
              <label className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold"><input type="checkbox" checked={print.showTotals} onChange={(e) => setPrint((p) => ({ ...p, showTotals: e.target.checked }))} /> إظهار صف الإجماليات</label>
              <label className="flex items-center gap-2 text-[11px] font-semibold"><input type="checkbox" checked={print.showMeta} onChange={(e) => setPrint((p) => ({ ...p, showMeta: e.target.checked }))} /> إظهار ملخص الفلاتر</label>
            </div>
          </div>

          {/* ===== منطقة النتائج ===== */}
          <div>
            {typeDef && (
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground no-print">
                <span>{typeDef.desc}</span>
                {type === 'attendance' && (
                  <div className="flex items-center gap-2">
                    <Btn size="sm" variant={tsMode ? 'primary' : 'outline'} onClick={() => setTsMode((v) => !v)}><Table2 className="h-3.5 w-3.5" /> عرض تايم شيت</Btn>
                    <Btn size="sm" variant="outline" disabled={tsBusy} onClick={() => runTimesheet(false)}>{tsBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />} تصدير موقع</Btn>
                    <Btn size="sm" variant="outline" disabled={tsBusy} onClick={() => runTimesheet(true)}><FileSpreadsheet className="h-3.5 w-3.5" /> جميع المواقع</Btn>
                  </div>
                )}
              </div>
            )}

            {tsMode ? (
              <TimesheetView filters={filters} />
            ) : !sel.length ? (
              <div className="rounded-xl border bg-card py-14 text-center text-sm text-muted-foreground shadow-sm no-print">اختر حقلًا واحدًا على الأقل لعرض التقرير</div>
            ) : loading && !res ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border bg-card py-14 text-sm text-muted-foreground shadow-sm no-print"><Loader2 className="h-4 w-4 animate-spin" /> جارٍ التنفيذ على قاعدة البيانات...</div>
            ) : !res?.rows.length ? (
              <div className="rounded-xl border bg-card py-14 text-center text-sm text-muted-foreground shadow-sm no-print">لا توجد بيانات مطابقة للمعايير المحددة</div>
            ) : (
              <div className="rounded-xl border bg-card shadow-sm">
                <div className="max-h-[62vh] overflow-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead className="sticky top-0 z-10 border-b bg-muted">
                      <tr>
                        <th className="whitespace-nowrap px-3 py-2.5 text-right font-bold">#</th>
                        {res.columns.map((c) => (
                          <th key={c.key} className="whitespace-nowrap px-3 py-2.5 text-right font-bold" style={c.width ? { minWidth: c.width } : undefined}>
                            <button onClick={() => sortBy(c.key)} className="flex items-center gap-1 hover:text-navy-900">
                              {c.label}
                              <ArrowUpDown className={'h-3 w-3 ' + (sortKey === c.key ? 'text-navy-900' : 'text-slate-300')} />
                              {sortKey === c.key && <span className="text-[9px]">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {res.rows.map((r, i) => (
                        <tr key={i} className="hover:bg-muted/40">
                          <td className="px-3 py-2 num text-muted-foreground">{(page - 1) * pageSize + i + 1}</td>
                          {res.columns.map((c) => (
                            <td key={c.key} className={'whitespace-nowrap px-3 py-2 ' + (c.num ? 'num font-bold text-navy-900' : '')}>
                              {displayVal(r[c.key], c.num)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                    {print.showTotals && hasNum && (
                      <tfoot className="border-t-2 bg-slate-50">
                        <tr>
                          <td className="px-3 py-2 text-right font-extrabold text-navy-900">الإجمالي</td>
                          {res.columns.map((c, i) => (
                            <td key={c.key} className={'px-3 py-2 num font-extrabold text-navy-900 ' + (i === 0 ? '' : '')}>
                              {c.num ? fmtNum(res.totals[c.key] || 0) : ''}
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 text-xs no-print">
                  <span className="text-muted-foreground">إجمالي {res.total.toLocaleString('en-US')} سجل — صفحة {page} من {totalPages}</span>
                  <div className="flex items-center gap-1.5">
                    <Select value={String(pageSize)} onChange={(e: any) => { setPageSize(Number(e.target.value)); }}
                      options={[25, 50, 100, 250].map((n) => ({ value: String(n), label: n + ' / صفحة' }))} />
                    <Btn size="sm" variant="outline" disabled={page <= 1} onClick={() => run(page - 1)}><ChevronRight className="h-4 w-4" /> السابق</Btn>
                    <Btn size="sm" variant="outline" disabled={page >= totalPages} onClick={() => run(page + 1)}>التالي <ChevronLeft className="h-4 w-4" /></Btn>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== معاينة الورق الرسمي ===== */}
      <Modal open={preview} onClose={() => setPreview(false)} title="الورق الرسمي — معاينة / طباعة / PDF" wide>
        <div className="mb-3 flex justify-end gap-2 no-print">
          <Btn variant="outline" size="sm" disabled={pdfBusy} onClick={downloadPdf}><Download className="h-4 w-4" /> {pdfBusy ? 'جارٍ التوليد...' : 'تنزيل PDF'}</Btn>
        </div>
        <div ref={paperRef}>
          <OfficialPaper title={typeDef?.label || 'تقرير'} subtitle="نظام سياج — تقرير مُنشأ حسب الخيارات المحددة"
            landscape={print.landscape} footer={footer} meta={print.showMeta ? metaRows().map(([k, v]) => ({ k, v })) : undefined}>
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr>
                  <th className="border border-slate-300 bg-navy-900 px-1.5 py-1.5 text-white">#</th>
                  {res?.columns.map((c) => (
                    <th key={c.key} className="border border-slate-300 bg-navy-900 px-1.5 py-1.5 text-white" style={c.width ? { minWidth: c.width } : undefined}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {res?.rows.map((r, i) => (
                  <tr key={i} className={i % 2 ? 'bg-slate-50' : ''}>
                    <td className="border border-slate-300 px-1.5 py-1.5 text-center num">{i + 1}</td>
                    {res.columns.map((c) => (
                      <td key={c.key} className="border border-slate-300 px-1.5 py-1.5">{displayVal(r[c.key], c.num)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {print.showTotals && hasNum && (
                <tfoot>
                  <tr>
                    <td className="border border-slate-300 bg-slate-100 px-1.5 py-1.5 text-center font-extrabold">الإجمالي</td>
                    {res?.columns.map((c) => (
                      <td key={c.key} className="border border-slate-300 bg-slate-100 px-1.5 py-1.5 num font-extrabold">{c.num ? fmtNum(res.totals[c.key] || 0) : ''}</td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </OfficialPaper>
        </div>
      </Modal>

      {/* ===== حفظ قالب ===== */}
      <Modal open={saveOpen} onClose={() => setSaveOpen(false)} title="حفظ التشكيلة الحالية كقالب">
        <Field label="اسم القالب">
          <TextInput value={tplName} onChange={(e: any) => setTplName(e.target.value)} placeholder="مثال: رواتب موقع الحرس — الربع الأول" />
        </Field>
        <div className="mt-2 text-[11px] text-muted-foreground">سيُحفظ مع {sel.length} حقلًا ونوع: {typeDef?.label} والفلاتر وإعدادات الطباعة.</div>
        <div className="mt-4 flex justify-end gap-2">
          <Btn variant="outline" onClick={() => setSaveOpen(false)}>إلغاء</Btn>
          <Btn onClick={saveTpl}><Save className="h-4 w-4" /> حفظ القالب</Btn>
        </div>
      </Modal>

      {/* ===== إعداد التذييل الرسمي ===== */}
      <Modal open={footerOpen} onClose={() => setFooterOpen(false)} title="التذييل الرسمي للتقارير">
        <div className="space-y-3">
          {FOOTER_FIELDS.map(([k, ph]) => (
            <Field key={k} label={k}>
              <TextInput value={footerDraft[k] || ''} placeholder={ph} onChange={(e: any) => setFooterDraft((p) => ({ ...p, [k]: e.target.value }))} />
            </Field>
          ))}
          <div className="text-[11px] text-muted-foreground">يُثبَّت التذييل في قاعدة البيانات ويظهر تلقائيًا أسفل كل معاينة وتصدير رسمي.</div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Btn variant="outline" onClick={() => setFooterOpen(false)}>إلغاء</Btn>
          <Btn onClick={saveFooterCfg}><Check className="h-4 w-4" /> حفظ التذييل</Btn>
        </div>
      </Modal>

      {toast.node}
    </div>
  );
}

// ===== عرض التايم شيت المصفوفي داخل الصفحة =====
function TimesheetView({ filters }: { filters: Filters }) {
  const [data, setData] = useState<{ days: number[]; rows: TsRow[] } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    setBusy(true);
    runReport({
      report_type: 'attendance',
      columns: [{ key: 'employee_code' }, { key: 'employee_name' }, { key: 'site_name' }, { key: 'work_date' }, { key: 'check_in_time' }, { key: 'check_out_time' }, { key: 'status' }],
      filters: (() => { const o: Record<string, any> = {}; if (filters.date_from) o.date_from = filters.date_from; if (filters.date_to) o.date_to = filters.date_to; if (filters.project_name && filters.project_name !== 'all') o.project_name = filters.project_name; if (filters.site_name && filters.site_name !== 'all') o.site_name = filters.site_name; return o; })(),
      sort_key: 'work_date', sort_dir: 'asc', page: 1, page_size: 2000,
    }).then((r) => { if (alive) setData(buildTimesheet(r.rows, filters.date_from)); })
      .catch(() => { if (alive) setData({ days: [], rows: [] }); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [filters.date_from, filters.date_to, filters.project_name, filters.site_name]);

  if (busy) return <div className="flex items-center justify-center gap-2 rounded-xl border bg-card py-14 text-sm text-muted-foreground shadow-sm"><Loader2 className="h-4 w-4 animate-spin" /> جارٍ بناء التايم شيت...</div>;
  if (!data || !data.rows.length) return <div className="rounded-xl border bg-card py-14 text-center text-sm text-muted-foreground shadow-sm">حدّد الفترة ثم نفّذ التقرير — لا توجد سجلات حضور</div>;

  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
      <table className="w-full border-collapse text-[10px]">
        <thead className="sticky top-0 z-10 border-b bg-muted">
          <tr>
            <th className="px-2 py-2 text-right font-bold">م</th>
            <th className="px-2 py-2 text-right font-bold">رقم الموظف</th>
            <th className="px-2 py-2 text-right font-bold">اسم الموظف</th>
            <th className="px-2 py-2 text-right font-bold">الموقع</th>
            {data.days.map((d) => <th key={d} className="w-7 px-1 py-2 text-center font-bold">{d}</th>)}
            <th className="px-2 py-2 text-center font-bold text-emerald-700">حضور</th>
            <th className="px-2 py-2 text-center font-bold text-rose-700">غياب</th>
            <th className="px-2 py-2 text-center font-bold text-amber-700">تأخير</th>
            <th className="px-2 py-2 text-center font-bold text-navy-900">إضافي</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.rows.map((r, i) => (
            <tr key={r.code} className="hover:bg-muted/40">
              <td className="px-2 py-1.5 num text-muted-foreground">{i + 1}</td>
              <td className="px-2 py-1.5">{r.code}</td>
              <td className="px-2 py-1.5 font-bold text-navy-900">{r.name}</td>
              <td className="px-2 py-1.5 text-muted-foreground">{r.site}</td>
              {data.days.map((d) => {
                const v = r.days[d] || '';
                const color = v === 'غ' ? 'text-rose-600' : v === 'ت' ? 'text-amber-600' : v === 'ح' || v === 'ان' ? 'text-emerald-700' : 'text-slate-400';
                return <td key={d} className={'px-1 py-1.5 text-center font-bold ' + color}>{v}</td>;
              })}
              <td className="px-2 py-1.5 text-center num font-bold text-emerald-700">{r.present}</td>
              <td className="px-2 py-1.5 text-center num font-bold text-rose-700">{r.absent}</td>
              <td className="px-2 py-1.5 text-center num font-bold text-amber-700">{r.late}</td>
              <td className="px-2 py-1.5 text-center num font-bold text-navy-900">{Math.round(r.otHours)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t px-3 py-2 text-[10px] text-muted-foreground">ح = حاضر · غ = غائب · ت = متأخر · ان = منصرف — الإجماليات محسوبة من سجلات الحضور الفعلية</div>
    </div>
  );
}