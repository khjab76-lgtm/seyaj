// ============================================================
// محرك التقارير الديناميكي — اتصال خادمي كامل (فلترة/فرز/ترقيم/تجميع)
// عبر client.apiCall.invoke، وتصدير Excel/CSV بالأعمدة المختارة فقط.
// ============================================================
import { client } from '@/lib/api';
import * as XLSX from 'xlsx';

export interface ReportColumn {
  key: string;
  label: string;
  num?: boolean;
  sensitive?: string;
  width?: number;
}

export interface ReportFilterDef {
  key: string;
  field: string;
  label: string;
  type: 'select' | 'number' | 'bool';
}

export interface ReportTypeDef {
  key: string;
  label: string;
  desc: string;
  date_field: string | null;
  has_search: boolean;
  columns: ReportColumn[];
  filters: ReportFilterDef[];
}

export interface ReportMeta {
  report_types: ReportTypeDef[];
  permissions: { payroll: boolean; id: boolean };
}

export interface RunColumn {
  key: string;
  label?: string;
  width?: number;
}

export interface RunPayload {
  report_type: string;
  columns: RunColumn[];
  filters: Record<string, any>;
  sort_key?: string | null;
  sort_dir?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
}

export interface RunResult {
  columns: ReportColumn[];
  rows: any[];
  total: number;
  page: number;
  page_size: number;
  totals: Record<string, number>;
  report_label: string;
}

async function invoke(url: string, method: string, data: any): Promise<any> {
  const res: any = await client.apiCall.invoke({ url, method, data });
  if (res && res.data !== undefined) return res.data;
  if (res && res.error) throw new Error(String(res.error));
  return res;
}

export async function fetchReportMeta(): Promise<ReportMeta> {
  return (await invoke('/api/v1/seyaj/reports/meta', 'GET', {})) as ReportMeta;
}

export async function fetchFieldOptions(type: string, field: string, scope?: Record<string, string>): Promise<string[]> {
  const d = await invoke('/api/v1/seyaj/reports/options', 'GET', {
    type, field, scope: scope ? JSON.stringify(scope) : undefined,
  });
  return d?.options ?? [];
}

export async function runReport(payload: RunPayload): Promise<RunResult> {
  return (await invoke('/api/v1/seyaj/reports/run', 'POST', payload)) as RunResult;
}

export async function fetchFooter(): Promise<Record<string, string>> {
  const d = await invoke('/api/v1/seyaj/reports/footer', 'GET', {});
  return d?.data ?? {};
}

export async function saveFooter(data: Record<string, string>): Promise<void> {
  await invoke('/api/v1/seyaj/reports/footer', 'PUT', { data });
}

// ---------- أدوات مساعدة ----------
export function fmtNum(n: number): string {
  return (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// تصدير Excel ديناميكي: الأعمدة المختارة فقط وبنفس ترتيبها + ترويسة رسمية + إجماليات.
export function exportDynamicXlsx(
  filename: string,
  cols: ReportColumn[],
  rows: any[],
  totals: Record<string, number>,
  metaRows: Array<[string, string]>,
) {
  const aoa: any[][] = [];
  metaRows.forEach(([k, v]) => aoa.push([k, v]));
  if (metaRows.length) aoa.push([]);
  aoa.push(cols.map((c) => c.label));
  rows.forEach((r) => aoa.push(cols.map((c) => (c.num ? Number(r[c.key]) || 0 : r[c.key] ?? ''))));
  if (cols.some((c) => c.num)) {
    const trow: any[] = [];
    cols.forEach((c, i) => {
      if (i === 0) trow.push('الإجمالي');
      else trow.push(c.num ? Number(totals[c.key]) || 0 : '');
    });
    aoa.push(trow);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = cols.map((c) => ({ wch: Math.max(12, c.label.length + 2, c.width || 0) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'التقرير');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  download(
    new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename.endsWith('.xlsx') ? filename : filename + '.xlsx',
  );
}

// تصدير Excel متعدد الأوراق (لتايم شيت حسب الموقع — كل موقع ورقة منفصلة).
export function exportSheetsXlsx(filename: string, sheets: Array<{ name: string; aoa: any[][] }>) {
  const wb = XLSX.utils.book_new();
  sheets.forEach((s) => {
    const ws = XLSX.utils.aoa_to_sheet(s.aoa);
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 30) || 'ورقة');
  });
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  download(
    new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename.endsWith('.xlsx') ? filename : filename + '.xlsx',
  );
}

export function exportDynamicCsv(filename: string, cols: ReportColumn[], rows: any[]) {
  const esc = (v: any) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const lines = [cols.map((c) => esc(c.label)).join(',')];
  rows.forEach((r) => lines.push(cols.map((c) => esc(r[c.key])).join(',')));
  download(new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' }), filename.endsWith('.csv') ? filename : filename + '.csv');
}

// ============================================================
// التايم شيت الشهري — مطابق لمنطق ملف الإكسل المرجعي
// ============================================================
export interface TimesheetCell { code: string; status: string; note: string }
export interface TimesheetDay { iso: string; day: number; label: string; month: number }
export interface TimesheetRow {
  employee_code: string; name: string; job: string; shift: string;
  cells: Record<string, TimesheetCell>; days_count: number; note: string;
}
export interface TimesheetBlock {
  site_name: string; project_name: string; site_code: string;
  base_count: number; relief_count: number; site_salary: number;
  rows: TimesheetRow[]; daily_totals: Record<string, number>;
}
export interface TimesheetResult {
  year: number; month: number; mode: string;
  days: TimesheetDay[]; legend: Array<{ code: string; label: string }>;
  blocks: TimesheetBlock[];
}
export interface TimesheetExtras {
  violations: any[]; permissions: any[]; new_hires: any[]; uncovered: any[];
  range: { from: string | null; to: string | null };
}

export async function fetchTimesheet(params: {
  year: number; month: number; mode: string; day_count?: number;
  project_name?: string; site_name?: string; employee_codes?: string;
}): Promise<TimesheetResult> {
  return (await invoke('/api/v1/seyaj/reports/timesheet', 'GET', params)) as TimesheetResult;
}

export async function fetchTimesheetExtras(params: {
  year: number; month: number; mode: string; day_count?: number; project_name?: string;
}): Promise<TimesheetExtras> {
  return (await invoke('/api/v1/seyaj/reports/timesheet/extras', 'GET', params)) as TimesheetExtras;
}

// بناء ورقة Excel مطابقة لتنظيم الملف: كتلة لكل موقع
// (رأس مشروع/موقع/كود + العدد الأساسي وبدلاء الراحات وراتب الموقع،
//  ثم رأس الأعمدة 26..25، صفوف الموظفين، صف الإجمالي اليومي، ملاحظات).
function timesheetBlockAoa(ts: TimesheetResult, b: TimesheetBlock): any[][] {
  const days = ts.days;
  const aoa: any[][] = [];
  aoa.push(['', b.project_name, '', '', ...Array(days.length).fill(''), 'العدد الأساسي الوردية الأولى', b.base_count, '']);
  aoa.push(['', b.site_name, '', '', ...Array(days.length).fill(''), 'بدلاء الراحات', b.relief_count, '']);
  aoa.push(['', b.site_code, '', '', ...Array(days.length).fill(''), 'راتب الموقع', b.site_salary, '']);
  aoa.push(['الرقم الوظيفي', 'الاسم', 'الوظيفة', 'الوردية', ...days.map((d) => d.label), 'عدد الايام', 'ملاحظات']);
  for (const r of b.rows) {
    aoa.push([r.employee_code, r.name, r.job, r.shift, ...days.map((d) => r.cells[d.iso]?.code ?? ''), r.days_count, r.note ?? '']);
  }
  aoa.push(['', 'الإجمالي اليومي', '', '', ...days.map((d) => b.daily_totals[d.iso] ?? 0), '', '']);
  aoa.push([]);
  return aoa;
}

export function exportTimesheetXlsx(
  filename: string, ts: TimesheetResult, extras?: TimesheetExtras | null,
) {
  const wb = XLSX.utils.book_new();
  const main: any[][] = [];
  main.push(['تايم شيت — ' + ts.year + '/' + ts.month, '', '', '', 'الدورة: ' + (ts.mode === 'payroll' ? 'رواتب 26 إلى 25' : 'تقويمية')]);
  main.push([]);
  for (const b of ts.blocks) main.push(...timesheetBlockAoa(ts, b));
  main.push(['مفتاح الحالات:', ...ts.legend.map((l) => l.code + ' = ' + l.label)]);
  main.push([]);
  main.push(['إعداد: ____________________', '', 'مراجعة: ____________________', '', 'اعتماد: ____________________']);
  const wsMain = XLSX.utils.aoa_to_sheet(main);
  const fixed = 4;
  wsMain['!cols'] = [
    { wch: 12 }, { wch: 28 }, { wch: 14 }, { wch: 8 },
    ...ts.days.map(() => ({ wch: 4 })), { wch: 9 }, { wch: 30 },
  ];
  wsMain['!freeze'] = { xSplit: fixed + ts.days.length + 2, ySplit: 4 };
  XLSX.utils.book_append_sheet(wb, wsMain, 'التايم شيت');

  if (extras) {
    const vio: any[][] = [['الرقم', 'الاسم', 'الوردية', 'التاريخ', 'الفرع', 'نوع المخالفة', 'ملاحظات']];
    extras.violations.forEach((v, i) => vio.push([i + 1, v.employee_name ?? '', v.shift ?? '', v.date ?? '', v.branch ?? '', v.type ?? '', v.notes ?? '']));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(vio), 'مخالفات');

    const per: any[][] = [['الاسم', 'النوع', 'من', 'إلى', 'السبب']];
    extras.permissions.forEach((p) => per.push([p.employee_name ?? '', p.type ?? '', p.from ?? '', p.to ?? '', p.reason ?? '']));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(per), 'اذن');

    const neu: any[][] = [['م', 'الرقم الوظيفي', 'الاسم', 'المشروع', 'الفرع', 'الحالة', 'ملاحظات']];
    extras.new_hires.forEach((n, i) => neu.push([i + 1, n.employee_code ?? '', n.employee_name ?? '', n.project ?? '', n.branch ?? '', n.status ?? '', n.notes ?? '']));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(neu), 'تعين جديد');

    const unc: any[][] = [['م', 'الفرع', 'الوردية', 'التاريخ', 'الحالة', 'متغطي', 'غير متغطي']];
    extras.uncovered.forEach((u, i) => unc.push([i + 1, u.branch ?? '', u.shift ?? '', u.date ?? '', u.status ?? '', u.covered === 'متغطي' ? '✓' : '', u.covered === 'غير متغطي' ? '✓' : '']));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(unc), 'غير متغطي');
  }

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  download(
    new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename.endsWith('.xlsx') ? filename : filename + '.xlsx',
  );
}

export function exportTimesheetCsv(filename: string, ts: TimesheetResult) {
  const esc = (v: any) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const lines: string[] = [];
  for (const b of ts.blocks) {
    timesheetBlockAoa(ts, b).forEach((r) => lines.push(r.map(esc).join(',')));
  }
  download(new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' }), filename.endsWith('.csv') ? filename : filename + '.csv');
}