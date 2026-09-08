// ============================================================
// وحدة الإدارة المالية «سياج» — المنطق + ربط Atoms Cloud
// قيود الإيرادات/المصروفات، دورات الدفع لكل موقع/عقد،
// الاحتساب المباشر من الحضور، الزكاة والضريبة (ZATCA محاكاة)،
// المخالفات المرورية بمسار اعتماد + إنذار + خصم تلقائي،
// والإسنادات المتعددة (أكثر من وردية/موقع براتب مختلف).
// ============================================================
import { client } from './api';
import { hrAudit } from './hr';
import { todayISO } from './backend';

export { todayISO };

// ---------- أدوات CRUD عامة ----------
async function listAll(table: string, sort = '-id'): Promise<any[]> {
  try {
    const res: any = await (client.entities as any)[table].queryAll({ sort, limit: 1000 });
    return res?.data?.items ?? [];
  } catch {
    return [];
  }
}
async function createRow(table: string, data: any): Promise<any> {
  const res: any = await (client.entities as any)[table].create({ data });
  return res?.data;
}
async function updateRow(table: string, id: number, data: any): Promise<any> {
  const res: any = await (client.entities as any)[table].update({ id, data });
  return res?.data;
}

// ---------- القيود المالية ----------
export const ENTRY_TYPES = [
  { code: 'revenue', label: 'إيراد' },
  { code: 'expense', label: 'مصروف' },
];
export const REVENUE_CATEGORIES = ['إيراد عقد', 'إيراد إضافات', 'غرامات وتعويضات'];
export const EXPENSE_CATEGORIES = ['رواتب وأجور', 'معدات وتجهيزات', 'محروقات ونقل', 'صيانة ومرافق', 'إيجارات', 'تأمينات', 'أخرى'];

export const fetchFinanceEntries = () => listAll('finance_entries', '-recorded_date');
export async function createFinanceEntry(data: any, actor: string) {
  const vat = data.entry_type === 'revenue' && data.vat_rate > 0
    ? Math.round(data.amount * (data.vat_rate / 100) * 100) / 100 : 0;
  const created = await createRow('finance_entries', {
    currency: 'SAR', vat_rate: data.vat_rate || 0, vat_amount: vat,
    net_amount: Math.round((data.amount - vat) * 100) / 100,
    invoice_no: '', description: '', status: 'recorded', ...data,
  });
  await hrAudit(actor, 'قيد مالي', 'finance_entries', created?.id ?? '', `${data.entry_type === 'revenue' ? 'إيراد' : 'مصروف'} ${data.amount} SAR — ${data.site_name || data.project_name || 'عام'}`);
  return created;
}
export async function deleteFinanceEntry(id: number, actor: string) {
  await (client.entities as any).finance_entries.delete({ id });
  await hrAudit(actor, 'حذف قيد مالي', 'finance_entries', id);
}

// ---------- دورات الدفع لكل موقع/عقد ----------
export const CYCLE_TYPES = [
  { code: 'calendar', label: 'تقويمية (1 إلى نهاية الشهر)' },
  { code: 'custom', label: 'مخصصة (مثال: 26 الشهر الماضي إلى 25 الحالي)' },
];
export const cycleTypeLabel = (c: string) => CYCLE_TYPES.find((t) => t.code === c)?.label ?? c;

export const fetchPayCycles = () => listAll('site_pay_cycles', 'site_name');
export async function savePayCycle(data: any, actor: string) {
  let created;
  if (data.id) created = await updateRow('site_pay_cycles', data.id, data);
  else created = await createRow('site_pay_cycles', data);
  await hrAudit(actor, data.id ? 'تعديل دورة دفع' : 'إضافة دورة دفع', 'site_pay_cycles', created?.id ?? '', `${data.site_name} — ${data.cycle_type === 'custom' ? `${data.start_day}→${data.end_day}` : 'تقويمية'}`);
  return created;
}

// نطاق الفترة للدورة المعتمدة بتاريخ مرجعي:
// calendar: 1..آخر يوم من شهر ref. custom (26→25): إذا ref>=26 فالدورة 26 شهر ref → 25 الشهر التالي، وإلا 26 الشهر السابق → 25 شهر ref.
export function cycleRange(cycle: { cycle_type: string; start_day: number; end_day: number }, ref = todayISO()): { start: string; end: string; label: string } {
  const d = new Date(ref + 'T00:00:00');
  const y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  const iso = (yy: number, mm: number, dd: number) => `${yy}-${pad(mm + 1)}-${pad(dd)}`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  if (cycle.cycle_type !== 'custom') {
    return { start: iso(y, m, 1), end: iso(y, m, lastDay), label: `${iso(y, m, 1)} ← ${iso(y, m, lastDay)}` };
  }
  const sd = cycle.start_day || 26, ed = cycle.end_day || 25;
  if (day >= sd) {
    const ny = m === 11 ? y + 1 : y, nm = m === 11 ? 0 : m + 1;
    return { start: iso(y, m, sd), end: iso(ny, nm, ed), label: `${iso(y, m, sd)} ← ${iso(ny, nm, ed)}` };
  }
  const py = m === 0 ? y - 1 : y, pm = m === 0 ? 11 : m - 1;
  return { start: iso(py, pm, sd), end: iso(y, m, ed), label: `${iso(py, pm, sd)} ← ${iso(y, m, ed)}` };
}

// ---------- الإسنادات المتعددة (موظف × موقع × وردية × راتب) ----------
export const PAY_BASES = [
  { code: 'monthly', label: 'شهري' },
  { code: 'daily', label: 'يومي' },
];
export const fetchAssignments = () => listAll('employee_assignments', 'employee_code');
export async function saveAssignment(data: any, actor: string) {
  let created;
  if (data.id) created = await updateRow('employee_assignments', data.id, data);
  else created = await createRow('employee_assignments', data);
  await hrAudit(actor, data.id ? 'تعديل إسناد' : 'إضافة إسناد', 'employee_assignments', created?.id ?? '', `${data.employee_name} — ${data.site_name} (${data.shift_period}) ${data.salary}`);
  return created;
}
export async function deactivateAssignment(id: number, actor: string) {
  await updateRow('employee_assignments', id, { active: false, end_date: todayISO() });
  await hrAudit(actor, 'إنهاء إسناد', 'employee_assignments', id);
}

// ---------- الاحتساب المباشر من الحضور ----------
// أيام الحضور الفعلي ضمن نطاق دورة الموقع: حاضر/متأخر/منصرف = يوم عمل، غائب = صفر.
export function attendanceDaysFor(logs: any[], employeeCode: string, siteName: string, range: { start: string; end: string }): number {
  const set = new Set<string>();
  for (const l of logs) {
    if (l.employee_code !== employeeCode) continue;
    if (siteName && l.site_name && l.site_name !== siteName) continue;
    const wd = String(l.work_date || '').slice(0, 10);
    if (!wd || wd < range.start || wd > range.end) continue;
    if (l.status === 'absent' || l.status === 'غائب') continue;
    set.add(wd);
  }
  return set.size;
}

// استحقاق إسناد واحد = أيام الحضور × (شهري: راتب/30 | يومي: راتب) + إضافي معتمد
export function computeAssignmentPay(a: any, days: number, overtimeHours = 0) {
  const daily = a.pay_basis === 'daily' ? (a.salary || 0) : Math.round(((a.salary || 0) / 30) * 100) / 100;
  const base = Math.round(days * daily * 100) / 100;
  const ot = Math.round(overtimeHours * ((a.overtime_rate || 0)) * 100) / 100;
  return { daily, base, ot, total: Math.round((base + ot) * 100) / 100 };
}

// ---------- الزكاة والضريبة (ZATCA — محاكاة كاملة، بنية جاهزة للربط) ----------
export interface VatSettings {
  vat_rate: number; vat_registered: boolean; company_tax_id: string;
  company_zakat_cert_no: string; zakat_rate: number; einvoice_mode: string;
}
export const VAT_DEFAULTS: VatSettings = {
  vat_rate: 15, vat_registered: true, company_tax_id: '300123456700003',
  company_zakat_cert_no: 'ZC-2026-8891', zakat_rate: 2.5, einvoice_mode: 'simulation',
};

export async function fetchVatSettings(): Promise<VatSettings> {
  const rows = await listAll('hr_settings', 'setting_key');
  const map: Record<string, string> = {};
  for (const r of rows) map[r.setting_key] = r.setting_value;
  return {
    vat_rate: Number(map.vat_rate ?? 15),
    vat_registered: (map.vat_registered ?? 'yes') === 'yes',
    company_tax_id: map.company_tax_id ?? VAT_DEFAULTS.company_tax_id,
    company_zakat_cert_no: map.company_zakat_cert_no ?? VAT_DEFAULTS.company_zakat_cert_no,
    zakat_rate: Number(map.zakat_rate ?? 2.5),
    einvoice_mode: map.einvoice_mode ?? 'simulation',
  };
}
export async function saveVatSettings(s: VatSettings, actor: string) {
  const pairs: [string, string, string][] = [
    ['vat_rate', String(s.vat_rate), 'نسبة ضريبة القيمة المضافة %'],
    ['vat_registered', s.vat_registered ? 'yes' : 'no', 'مسجل في ضريبة القيمة المضافة (واع/غير واع)'],
    ['company_tax_id', s.company_tax_id, 'الرقم الضريبي للشركة (ZATCA)'],
    ['company_zakat_cert_no', s.company_zakat_cert_no, 'رقم شهادة الزكاة والدخل'],
    ['zakat_rate', String(s.zakat_rate), 'نسبة الزكاة على الوعاء %'],
    ['einvoice_mode', s.einvoice_mode, 'وضع الفوترة الإلكترونية: محاكاة الآن / ربط فعلي مستقبلاً'],
  ];
  const rows = await listAll('hr_settings', 'setting_key');
  for (const [k, v, d] of pairs) {
    const found = rows.find((r: any) => r.setting_key === k);
    if (found) await updateRow('hr_settings', found.id, { setting_value: v, description: d });
    else await createRow('hr_settings', { setting_key: k, setting_value: v, description: d });
  }
  await hrAudit(actor, 'تعديل إعدادات الزكاة والضريبة', 'hr_settings', 'vat', `نسبة ${s.vat_rate}% — رقم ضريبي ${s.company_tax_id}`);
}

// تقرير ضريبي/زكاتي: مخرجات ومخرجات ضريبة من قيود الإيرادات ضمن الفترة
export function buildVatReport(entries: any[], range: { start: string; end: string }) {
  const rev = entries.filter((e) => e.entry_type === 'revenue' && String(e.recorded_date || '') >= range.start && String(e.recorded_date || '') <= range.end);
  const total = Math.round(rev.reduce((s: number, e: any) => s + (e.amount || 0), 0) * 100) / 100;
  const vat = Math.round(rev.reduce((s: number, e: any) => s + (e.vat_amount || 0), 0) * 100) / 100;
  const net = Math.round((total - vat) * 100) / 100;
  const std = rev.filter((e: any) => (e.vat_rate || 0) > 0).reduce((s: number, e: any) => s + (e.net_amount || 0), 0);
  const zero = rev.filter((e: any) => !(e.vat_rate > 0)).reduce((s: number, e: any) => s + (e.amount || 0), 0);
  return { invoices: rev, count: rev.length, total, vat, net, standard: Math.round(std * 100) / 100, zeroRated: Math.round(zero * 100) / 100, range };
}

// فاتورة إلكترونية مبسطة بصيغة ZATCA (محاكاة): TLV → base64
function tlv(tag: number, value: string): number[] {
  const bytes = Array.from(new TextEncoder().encode(value));
  return [tag, bytes.length, ...bytes];
}
export function zatcaQrBase64(inv: { seller: string; vatNo: string; ts: string; total: number; vat: number }): string {
  const parts = [
    ...tlv(1, inv.seller), ...tlv(2, inv.vatNo), ...tlv(3, inv.ts),
    ...tlv(4, String(inv.total)), ...tlv(5, String(inv.vat)),
  ];
  let bin = '';
  for (const b of parts) bin += String.fromCharCode(b);
  return btoa(bin);
}
export function buildEInvoice(entry: any, s: VatSettings) {
  const ts = new Date().toISOString();
  const qr = zatcaQrBase64({
    seller: 'شركة سياج للحراسات الأمنية الخاصة', vatNo: s.company_tax_id, ts,
    total: entry.amount || 0, vat: entry.vat_amount || 0,
  });
  return {
    mode: s.einvoice_mode, version: 'ZATCA Phase-2 (محاكاة)',
    seller: 'شركة سياج للحراسات الأمنية الخاصة', vatNo: s.company_tax_id,
    certNo: s.company_zakat_cert_no,
    invoiceNo: entry.invoice_no || `SIM-${entry.id}`, date: entry.recorded_date || todayISO(),
    total: entry.amount, vat: entry.vat_amount, net: entry.net_amount,
    qr, hash: 'SIM-' + String(entry.id).padStart(6, '0') + '-' + Date.now().toString(36).toUpperCase(),
  };
}
export function vatReportCsv(rep: ReturnType<typeof buildVatReport>, s: VatSettings): string {
  const head = ['ZATCA VAT Report (simulation)', 'Company', 'شركة سياج للحراسات الأمنية الخاصة', 'VATNo', s.company_tax_id, 'Period', `${rep.range.start}..${rep.range.end}`];
  const cols = ['InvoiceNo', 'Project', 'Site', 'Date', 'Total', 'VAT', 'Net'];
  const lines = [head.join(','), cols.join(','),
    ...rep.invoices.map((e: any) => [e.invoice_no || '-', `"${e.project_name || ''}"`, `"${e.site_name || ''}"`, e.recorded_date, e.amount, e.vat_amount, e.net_amount].join(',')),
    ['TOTAL', '', '', '', rep.total, rep.vat, rep.net].join(',')];
  return '\ufeff' + lines.join('\n');
}

// ---------- المخالفات المرورية ----------
export const TRAFFIC_VIOLATION_TYPES = [
  'تجاوز سرعة', 'عدم الالتزام بخط السير', 'الوقوف في مكان ممنوع', 'تجاوز إشارة حمراء',
  'استخدام الجوال أثناء القيادة', 'عدم ربط الحزام', 'أخرى',
];
export const TRAFFIC_FLOW = [
  { code: 'pending', label: 'مرصودة — بانتظار اعتماد المشرف' },
  { code: 'sup_approved', label: 'بانتظار اعتماد العمليات' },
  { code: 'ops_approved', label: 'بانتظار اعتماد الموارد البشرية' },
  { code: 'hr_approved', label: 'معتمدة — بانتظار الإنذار' },
  { code: 'deducted', label: 'إنذار + خصم من الراتب' },
  { code: 'rejected', label: 'مرفوضة' },
];
export const trafficStatusLabel = (c: string) => TRAFFIC_FLOW.find((f) => f.code === c)?.label ?? c;

export const fetchTrafficViolations = () => listAll('traffic_violations', '-violation_date');
export async function createTrafficViolation(data: any, actor: string) {
  const created = await createRow('traffic_violations', {
    status: 'pending', approver_supervisor: '', approver_ops: '', approver_hr: '',
    warning_generated: false, deduction_applied: false, notes: '', points: 0, ...data,
  });
  await hrAudit(actor, 'رصد مخالفة مرورية', 'traffic_violations', created?.id ?? '', `${data.employee_name} — ${data.violation_type} (${data.amount} SAR)`);
  return created;
}
// قرار في مرحلة؛ اعتماد HR يولّد الإنذار ويعلّم الخصم التلقائي في المسيرة القادمة
export async function decideTrafficViolation(row: any, stage: 'supervisor' | 'ops' | 'hr', decision: 'approved' | 'rejected', actor: string, note = '') {
  const field = stage === 'supervisor' ? 'approver_supervisor' : stage === 'ops' ? 'approver_ops' : 'approver_hr';
  const nextStatus = decision === 'rejected' ? 'rejected'
    : stage === 'supervisor' ? 'sup_approved' : stage === 'ops' ? 'ops_approved' : 'hr_approved';
  await updateRow('traffic_violations', row.id, { [field]: decision === 'rejected' ? `مرفوض: ${actor}` : actor, status: nextStatus, ...(note ? { notes: note } : {}) });
  await hrAudit(actor, decision === 'approved' ? `اعتماد مرورية (${stage})` : `رفض مرورية (${stage})`, 'traffic_violations', row.id, `${row.employee_name} — ${row.violation_type} → ${trafficStatusLabel(nextStatus)}`);
  if (stage === 'hr' && decision === 'approved') {
    // توليد نموذج الإنذار المناسب تلقائياً
    const warn = await createRow('hr_warnings', {
      employee_code: row.employee_code, employee_name: row.employee_name,
      warning_type: 'إنذار مخالفة مرورية', absence_days: 0,
      absence_from: row.violation_date, absence_to: row.violation_date,
      article_ref: 'لائحة تنظيم العمل — مخالفات المرور',
      note: `مخالفة مرورية: ${row.violation_type} — لوحة ${row.plate_number} — ${row.amount} SAR`,
      letter_status: 'draft', sent_via: '', sent_date: '', attachment_key: '',
    });
    await updateRow('traffic_violations', row.id, { warning_generated: true, status: 'deducted', deduction_applied: true });
    await hrAudit('النظام', 'توليد إنذار مروري وتفعيل الخصم التلقائي', 'traffic_violations', row.id, `${row.employee_name} — ${row.amount} SAR يُخصم من المسيرة القادمة (إنذار #${warn?.id ?? ''})`);
  }
}

// إجمالي الخصومات المرورية المعتمدة المفعّلة لموظف (تُضاف إلى حسم المسيرة)
export function trafficDeductionOf(code: string, rows: any[]): number {
  return rows.filter((t: any) => t.employee_code === code)
    .filter((t: any) => t.status === 'deducted' && t.deduction_applied)
    .reduce((s: number, t: any) => s + (t.amount || 0), 0);
}

// ---------- الاحتساب المشترك للمسيرة ----------
// دورة موقع من قائمة الدورات، وتقويمية افتراضية إن لم تُحدَّد
export function resolveCycle(cycles: any[], siteName: string) {
  const found = cycles.filter((c: any) => c.site_name === siteName)
    .filter((c: any) => c.active !== false);
  return found[0] || { cycle_type: 'calendar', start_day: 1, end_day: 31 };
}

// استحقاق موظف من كل إسناداته النشطة (موقع/وردية/راتب مختلف) محتسباً من الحضور
export function empAccrual(code: string, assigns: any[], logs: any[], cycles: any[], ref = todayISO()) {
  const lines = assigns
    .filter((a: any) => a.employee_code === code)
    .filter((a: any) => a.active !== false)
    .map((a: any) => {
      const range = cycleRange(resolveCycle(cycles, a.site_name), ref);
      const days = attendanceDaysFor(logs, code, a.site_name, range);
      const pay = computeAssignmentPay(a, days);
      return {
        site: a.site_name, project: a.project_name || '—', role: a.role || '—',
        shift: a.shift_period || '—', pay_basis: a.pay_basis, salary: a.salary || 0,
        range: range.label, days, ...pay,
      };
    });
  const gross = Math.round(lines.reduce((s: number, l: any) => s + l.total, 0) * 100) / 100;
  return { lines, gross };
}