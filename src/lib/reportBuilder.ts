// ============================================================
// طبقة «باني التقارير» — تعريف الأعمدة، الفلاتر المركّبة،
// أنواع التقارير، القوالب الجاهزة، والتصدير الفعلي (Excel/CSV).
// ============================================================
import * as XLSX from 'xlsx';
import { saIdOf, salaryOf, clientOf, computeNet } from '@/lib/seyaj';

export interface Ctx {
  employees: any[];
  attendance: any[];
  requests: any[];
  sites: any[];
  projects: any[];
  violations: any[];
  insurance: any[];
  allowances: any[];
  from: string;
  to: string;
  siteName: (id: number) => string;
  siteCode: (id: number) => string;
  projectName: (id: number) => string;
}

export interface ReportFilters {
  type: string;
  projectId: string;
  siteId: string;
  shift: string;
  status: string;
  insurance: string;
  salaryOp: string;
  salaryAmount: number;
  from: string;
  to: string;
  search: string;
}

export const DEFAULT_FILTERS: ReportFilters = {
  type: 'all',
  projectId: 'all',
  siteId: 'all',
  shift: 'all',
  status: 'all',
  insurance: 'all',
  salaryOp: 'none',
  salaryAmount: 4000,
  from: '2026-08-01',
  to: '2026-09-30',
  search: '',
};

export const SHIFTS = ['صباحية', 'مسائية', 'ليلية'];
export const STATUSES = ['نشط', 'إجازة', 'موقوف', 'منتهي'];

function inRange(dateStr: string, from: string, to: string): boolean {
  if (!dateStr) return false;
  if (from && from > dateStr) return false;
  if (to && dateStr > to) return false;
  return true;
}

export function buildContext(store: any, from: string, to: string): Ctx {
  const sites: any[] = store.sites ?? [];
  const projects: any[] = store.projects ?? [];
  return {
    employees: store.employees ?? [],
    attendance: store.attendance ?? [],
    requests: store.requests ?? [],
    sites,
    projects,
    violations: store.violations ?? [],
    insurance: store.insurance ?? [],
    allowances: store.allowances ?? [],
    from,
    to,
    siteName: (id: number) => sites.find((s: any) => s.id === id)?.name ?? '—',
    siteCode: (id: number) => sites.find((s: any) => s.id === id)?.code ?? '—',
    projectName: (id: number) => projects.find((p: any) => p.id === id)?.name ?? '—',
  };
}

// اشتقاق الوردية من بصمة الدخول (إن وُجدت) وإلا صباحية.
export function shiftOf(e: any, ctx: Ctx): string {
  const rows = ctx.attendance.filter((a: any) => a.employeeId === e.id && a.checkIn);
  if (!rows.length) return 'صباحية';
  const h = parseInt(String(rows[0].checkIn).slice(0, 2), 10);
  if (Number.isNaN(h)) return 'صباحية';
  if (h >= 6 && 14 > h) return 'صباحية';
  if (h >= 14 && 18 > h) return 'مسائية';
  return 'ليلية';
}

export function insOf(e: any, ctx: Ctx): any {
  return ctx.insurance.find((i: any) => i.employeeName === e.name) ?? null;
}

export function workDays(e: any, ctx: Ctx): number {
  return ctx.attendance.filter((a: any) => a.employeeId === e.id && a.checkIn && inRange(a.date, ctx.from, ctx.to)).length;
}

export function hasStatus(e: any, ctx: Ctx, status: string): boolean {
  return ctx.attendance.some((a: any) => a.employeeId === e.id && a.status === status && inRange(a.date, ctx.from, ctx.to));
}

export function hasRequest(e: any, ctx: Ctx, keywords: string[]): boolean {
  return ctx.requests.some(
    (r: any) => r.employeeId === e.id && keywords.some((k) => String(r.type || '').includes(k) || String(r.reason || '').includes(k)),
  );
}

export function deductionTotal(ctx: Ctx): number {
  return (ctx.allowances ?? []).filter((a: any) => a.kind === 'deduction' && a.amount > 0).reduce((s: number, a: any) => s + a.amount, 0);
}

export function violationTotal(e: any, ctx: Ctx): number {
  return ctx.violations.filter((v: any) => v.employeeName === e.name && v.status === 'deducted').reduce((s: number, v: any) => s + v.amount, 0);
}

export function payslip(e: any, ctx: Ctx) {
  const base = salaryOf(e.job);
  const ins = insOf(e, ctx)?.monthlyDeduction ?? 0;
  const vio = violationTotal(e, ctx);
  const ded = deductionTotal(ctx);
  const overtimeAmt = ctx.attendance.filter((a: any) => a.employeeId === e.id && a.status === 'إضافي').length * 50;
  const net = computeNet({ baseSalary: base, allowances: overtimeAmt, deductions: ded, insurance: ins, violations: vio });
  return { base, overtime: overtimeAmt, ded, ins, vio, net };
}

export interface ColumnDef {
  key: string;
  label: string;
  num?: boolean;
  get: (e: any, ctx: Ctx) => any;
}

export const COLUMN_DEFS: ColumnDef[] = [
  { key: 'no', label: 'الرقم الوظيفي', get: (e) => e.no },
  { key: 'name', label: 'الاسم الرباعي', get: (e) => e.name },
  { key: 'nid', label: 'رقم الهوية', get: (e) => saIdOf(e.phone) },
  { key: 'job', label: 'المسمى الوظيفي', get: (e) => e.job },
  { key: 'project', label: 'المشروع', get: (e, c) => c.projectName(e.projectId) },
  { key: 'site', label: 'الموقع', get: (e, c) => c.siteName(e.siteId) },
  { key: 'siteCode', label: 'رقم الموقع', get: (e, c) => c.siteCode(e.siteId) },
  { key: 'shift', label: 'الوردية', get: (e, c) => shiftOf(e, c) },
  { key: 'status', label: 'الحالة', get: (e) => e.status },
  { key: 'phone', label: 'الجوال', get: (e) => e.phone },
  { key: 'email', label: 'البريد', get: (e) => e.email },
  { key: 'joined', label: 'تاريخ التعيين', get: (e) => e.joined },
  { key: 'workDays', label: 'أيام العمل', num: true, get: (e, c) => workDays(e, c) },
  { key: 'checkIn', label: 'الحضور', get: (e, c) => c.attendance.find((a: any) => a.employeeId === e.id && a.checkIn && inRange(a.date, c.from, c.to))?.checkIn ?? '—' },
  { key: 'checkOut', label: 'الانصراف', get: (e, c) => c.attendance.find((a: any) => a.employeeId === e.id && a.checkOut && inRange(a.date, c.from, c.to))?.checkOut ?? '—' },
  { key: 'base', label: 'الراتب الأساسي', num: true, get: (e) => salaryOf(e.job) },
  { key: 'allowances', label: 'البدلات', num: true, get: (e, c) => payslip(e, c).overtime },
  { key: 'deductions', label: 'الخصومات', num: true, get: (e, c) => payslip(e, c).ded },
  { key: 'violations', label: 'حسم المخالفات', num: true, get: (e, c) => payslip(e, c).vio },
  { key: 'net', label: 'صافي الراتب', num: true, get: (e, c) => payslip(e, c).net },
  { key: 'insuranceFlag', label: 'التأمينات', get: (e, c) => (insOf(e, c) ? 'مؤمَّن' : 'غير مؤمَّن') },
  { key: 'insuranceCompany', label: 'شركة التأمين', get: (e, c) => insOf(e, c)?.company ?? '—' },
  { key: 'insuranceDeduction', label: 'حسم التأمين', num: true, get: (e, c) => insOf(e, c)?.monthlyDeduction ?? 0 },
  { key: 'client', label: 'اسم العميل', get: (e) => clientOf(e.projectId) },
  { key: 'signature', label: 'توقيع الموظف', get: () => '' },
];

export const COLUMN_MAP: Record<string, ColumnDef> = Object.fromEntries(COLUMN_DEFS.map((c) => [c.key, c]));

export const REPORT_TYPES: { key: string; label: string; desc: string }[] = [
  { key: 'all', label: 'كل الموظفين', desc: 'جميع الموظفين ضمن الفلاتر العامة' },
  { key: 'late', label: 'المتأخرون', desc: 'من سجّلوا حضوراً متأخراً في الفترة' },
  { key: 'absent', label: 'الغيابات', desc: 'من لم يسجّلوا حضوراً / غابوا في الفترة' },
  { key: 'committed', label: 'الملتزمون', desc: 'حضور كامل دون تأخير أو غياب' },
  { key: 'resign', label: 'الانسحابات', desc: 'طلبات استبدال/انسحاب من الوردية' },
  { key: 'transfer', label: 'التحويلات', desc: 'طلبات النقل بين المواقع/المشاريع' },
  { key: 'leave', label: 'الإجازات', desc: 'طلبات الإجازة (سنوية/مرضية)' },
  { key: 'quit', label: 'الاستقالات', desc: 'من لديهم طلب/سبب استقالة' },
  { key: 'insurance', label: 'المؤمَّن عليهم', desc: 'من عليهم تأمين وتفاصيل رواتبهم' },
  { key: 'without_insurance', label: 'غير المؤمَّن عليهم', desc: 'من لا يملكون سجل تأمين' },
  { key: 'salary_range', label: 'حسب نطاق الراتب', desc: 'راتب فوق/تحت مبلغ محدد' },
];

export function applyFilters(emps: any[], f: ReportFilters, ctx: Ctx): any[] {
  const q = f.search.trim();
  return emps.filter((e: any) => {
    if (f.projectId !== 'all' && String(e.projectId) !== f.projectId) return false;
    if (f.siteId !== 'all' && String(e.siteId) !== f.siteId) return false;
    if (f.status !== 'all' && e.status !== f.status) return false;
    if (f.shift !== 'all' && shiftOf(e, ctx) !== f.shift) return false;
    if (q && !(`${e.name} ${e.no} ${e.phone}`.includes(q))) return false;
    if (f.insurance === 'yes' && !insOf(e, ctx)) return false;
    if (f.insurance === 'no' && insOf(e, ctx)) return false;
    if (f.salaryOp !== 'none') {
      const base = salaryOf(e.job);
      if (f.salaryOp === 'above' && !(base > f.salaryAmount)) return false;
      if (f.salaryOp === 'below' && !(f.salaryAmount > base)) return false;
    }
    switch (f.type) {
      case 'late': return hasStatus(e, ctx, 'متأخر');
      case 'absent': return hasStatus(e, ctx, 'غائب');
      case 'committed': return workDays(e, ctx) > 0 && !hasStatus(e, ctx, 'متأخر') && !hasStatus(e, ctx, 'غائب');
      case 'resign': return hasRequest(e, ctx, ['استبدال', 'انسحاب']);
      case 'transfer': return hasRequest(e, ctx, ['نقل', 'تحويل']);
      case 'leave': return hasRequest(e, ctx, ['إجازة']);
      case 'quit': return hasRequest(e, ctx, ['استقالة']) || e.status === 'منتهي';
      case 'insurance': return !!insOf(e, ctx);
      case 'without_insurance': return !insOf(e, ctx);
      case 'salary_range': return true;
      default: return true;
    }
  });
}

export function buildRows(colKeys: string[], emps: any[], ctx: Ctx): any[] {
  const cols = colKeys.map((k) => COLUMN_MAP[k]).filter(Boolean);
  return emps.map((e: any) => {
    const row: any = {};
    cols.forEach((c: ColumnDef) => { row[c.key] = c.get(e, ctx); });
    return row;
  });
}

// ---------- التصدير الفعلي ----------
export function exportXlsx(filename: string, colKeys: string[], rows: any[]) {
  const cols = colKeys.map((k) => COLUMN_MAP[k]).filter(Boolean);
  const aoa: any[][] = [cols.map((c: ColumnDef) => c.label)];
  rows.forEach((r: any) => aoa.push(cols.map((c: ColumnDef) => (c.num ? Number(r[c.key]) || 0 : r[c.key] ?? ''))));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = cols.map((c: ColumnDef) => ({ wch: Math.max(12, c.label.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'التقرير');
  // تنزيل موثوق داخل المعاينة: تحويل المصنف إلى Blob ثم رابط تنزيل يدوي (بديل writeFile)
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xlsx') ? filename : filename + '.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportCsv(filename: string, colKeys: string[], rows: any[]) {
  const cols = colKeys.map((k) => COLUMN_MAP[k]).filter(Boolean);
  const esc = (v: any) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const lines = [cols.map((c: ColumnDef) => esc(c.label)).join(',')];
  rows.forEach((r: any) => lines.push(cols.map((c: ColumnDef) => esc(r[c.key])).join(',')));
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : filename + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// تصدير مصفوفة صفوف (AoA) إلى xlsx عبر Blob — يُستخدم في التايم شيت
export function exportAoaXlsx(filename: string, aoa: any[][]) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'التقرير');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xlsx') ? filename : filename + '.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// تنزيل PDF فعلي كملف: تصوير عنصر الورق الرسمي إلى صورة ثم تركيبها في صفحات A4
// مع تقسيم ذكي على حدود صفوف الجدول حتى لا يُقص أي صف في المنتصف،
// وإزالة القص الأفقي مؤقتاً لضمان التقاط كامل الأعمدة (جداول التايم شيت العريضة).
export async function exportElementPdf(el: HTMLElement | null, filename: string, orientation: 'auto' | 'portrait' | 'landscape' = 'auto') {
  if (!el) throw new Error('العنصر غير موجود');
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);

  // إزالة overflow من كل الحاويات الداخلية مؤقتاً حتى لا تُقص الأعمدة العريضة
  const restore: Array<[HTMLElement, string]> = [];
  el.querySelectorAll<HTMLElement>('*').forEach((n) => {
    const cs = getComputedStyle(n);
    if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
      restore.push([n, n.style.overflow]);
      n.style.overflow = 'visible';
    }
  });

  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
  } finally {
    restore.forEach(([n, v]) => { n.style.overflow = v; });
  }

  // تحديد الاتجاه تلقائياً من أبعاد العنصر عند 'auto'
  const finalOrientation = orientation === 'auto'
    ? (canvas.width >= canvas.height ? 'landscape' : 'portrait')
    : orientation;
  const pdf = new jsPDF({ orientation: finalOrientation, unit: 'mm', format: 'a4', compress: true });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 6;
  const contentW = pageW - margin * 2;
  const contentH = pageH - margin * 2;

  // عرض الصورة = عرض المحتوى، إذن mm→px
  const pxPerMm = canvas.width / contentW;
  const pageHpx = contentH * pxPerMm;

  // نقاط القص المسموحة: أسفل كل صف جدول/عنصر avoid-break (بإحداثيات canvas)
  const rect = el.getBoundingClientRect();
  const scale = canvas.height / rect.height;
  const cutPoints = new Set<number>([0]);
  el.querySelectorAll('tr, .avoid-break, thead').forEach((n) => {
    const r = n.getBoundingClientRect();
    cutPoints.add(Math.min(canvas.height, Math.ceil((r.bottom - rect.top) * scale)));
  });
  const sortedCuts = Array.from(cutPoints).sort((a, b) => a - b);

  const drawSlice = (y: number, h: number) => {
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = Math.max(1, Math.round(h));
    const ctx = slice.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, Math.round(y), canvas.width, Math.round(h), 0, 0, canvas.width, slice.height);
    pdf.addImage(slice.toDataURL('image/png'), 'PNG', margin, margin, contentW, slice.height / pxPerMm);
  };

  let y = 0;
  let first = true;
  while (y < canvas.height - 1) {
    if (!first) pdf.addPage();
    first = false;
    const limit = y + pageHpx;
    // اختر أبعد نقطة قص <= الحد؛ وإن لم توجد نقطة (صف أطول من صفحة) اقسم على الحد
    let cut = y;
    for (const c of sortedCuts) {
      if (c > y && c <= limit) cut = c;
      else if (c > limit) break;
    }
    if (cut === y) cut = Math.min(limit, canvas.height);
    drawSlice(y, cut - y);
    y = cut;
  }

  const blob = pdf.output('blob');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.pdf') ? filename : filename + '.pdf';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------- القوالب الجاهزة ----------
export interface ReportTemplate {
  name: string;
  filters: any;
  columns: string[];
  builtin?: boolean;
}

export const BUILTIN_TEMPLATES: ReportTemplate[] = [
  { name: 'تقرير رواتب المؤمَّن عليهم', builtin: true, filters: { type: 'insurance' }, columns: ['no', 'name', 'nid', 'project', 'site', 'job', 'base', 'allowances', 'deductions', 'insuranceFlag', 'insuranceCompany', 'insuranceDeduction', 'net'] },
  { name: 'تقرير غير المؤمَّن عليهم', builtin: true, filters: { type: 'without_insurance' }, columns: ['no', 'name', 'nid', 'project', 'site', 'job', 'base', 'insuranceFlag', 'net'] },
  { name: 'تقرير غيابات موقع', builtin: true, filters: { type: 'absent' }, columns: ['no', 'name', 'nid', 'project', 'site', 'shift', 'checkIn', 'status'] },
  { name: 'تقرير حضور مشروع', builtin: true, filters: { type: 'committed' }, columns: ['no', 'name', 'project', 'site', 'shift', 'workDays', 'checkIn', 'checkOut'] },
  { name: 'تقرير المتأخرين', builtin: true, filters: { type: 'late' }, columns: ['no', 'name', 'project', 'site', 'shift', 'checkIn', 'status'] },
  { name: 'تقرير رواتب فوق 4000', builtin: true, filters: { type: 'salary_range', salaryOp: 'above', salaryAmount: 4000 }, columns: ['no', 'name', 'job', 'project', 'base', 'allowances', 'net', 'client'] },
  { name: 'تقرير الاستقالات', builtin: true, filters: { type: 'quit' }, columns: ['no', 'name', 'nid', 'project', 'site', 'status'] },
  { name: 'تقرير التحويلات', builtin: true, filters: { type: 'transfer' }, columns: ['no', 'name', 'project', 'site', 'shift', 'status'] },
];

const LS_KEY = 'seyaj_report_templates';

export function loadCustomTemplates(): ReportTemplate[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomTemplate(t: ReportTemplate): ReportTemplate[] {
  const list = loadCustomTemplates().filter((x) => x.name !== t.name);
  list.push({ ...t, builtin: false });
  localStorage.setItem(LS_KEY, JSON.stringify(list));
  return list;
}

export function deleteCustomTemplate(name: string): ReportTemplate[] {
  const list = loadCustomTemplates().filter((x) => x.name !== name);
  localStorage.setItem(LS_KEY, JSON.stringify(list));
  return list;
}
