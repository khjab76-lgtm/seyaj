// ============================================================
// وحدة الموارد البشرية «سياج» — المنطق + ربط Atoms Cloud
// الإجازات والأرصدة والتصفية، المستندات والمرفقات، البنوك،
// الحركة الوظيفية، مسيرات الرواتب وملف البنك، الإنذارات والإرسال،
// سجل التدقيق، التنبيهات، والتكامل المستقبلي (قوى/التأمينات/Mudad).
// ============================================================
import { client } from './api';
import { todayISO, uploadDoc, getFileUrl, downloadDoc, deleteDoc, BUCKET } from './backend';

export { todayISO, uploadDoc, getFileUrl, downloadDoc, deleteDoc, BUCKET };

// ---------- ثوابت الوحدة ----------
export const LEAVE_TYPES = ['إجازة سنوية', 'إجازة مرضية', 'إجازة اضطرارية', 'إجازة بدون راتب', 'إذن'];
export const EMP_KINDS = ['إداري', 'تشغيلي'];
// التمييز بين الموظف الإداري والتشغيلي — نموذج طلب الإجازة يختلف (إداريين مقابل تشغيلي)
export function empKindOf(job?: string): string {
  return /أخصائي|محاسب|إداري|سكرتير|مكتب|موارد بشرية|تقنية/.test(job || '') ? 'إداري' : 'تشغيلي';
}
export const DOC_TYPES = [
  'تعريف راتب (عربي)', 'تعريف راتب (إنجليزي)', 'تعريف راتب مصدق', 'تعريف راتب مفصل',
  'شهادة خبرة', 'مخالصة نهائية', 'استقالة', 'إنذار كتابي', 'إنهاء خدمات', 'خطاب بنكي',
  'هوية', 'إقامة', 'شهادة تدريب', 'عقد', 'مرفق آخر',
];
export const EVENT_TYPES = ['تعيين', 'ترقية', 'نقل', 'إعادة عمل', 'استقالة', 'إنهاء عقد', 'إنذار', 'تغيير حساب بنكي'];

// دورة الاعتماد الثلاثية: المشرف ← مدير المنطقة/العمليات ← الموارد البشرية
export const APPROVAL_STAGES = [
  { code: 'supervisor', label: 'المشرف المباشر', field: 'supervisor_status' },
  { code: 'manager', label: 'مدير المنطقة/العمليات', field: 'manager_status' },
  { code: 'hr', label: 'الموارد البشرية', field: 'hr_status' },
];

// ---------- أدوات CRUD عامة عبر Web SDK ----------
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

// ---------- سجل التدقيق (مرتبط برقم الموظف عند التوفر) ----------
export async function hrAudit(actor: string, action: string, entity: string, entityId: string | number, details = '', employeeCode = '') {
  try {
    await createRow('hr_audit_logs', { actor, action, entity, entity_id: String(entityId ?? ''), details, employee_code: employeeCode });
  } catch { /* لا يُفشل العمل بسبب التدقيق */ }
}
export const fetchAuditLogs = () => listAll('hr_audit_logs', '-id');

// ---------- جلب مرتبط برقم الموظف — ترشيح employee_code من الخادم ----------
export async function listByCode(table: string, code: string, sort = '-id'): Promise<any[]> {
  if (!code) return [];
  try {
    const res: any = await (client.entities as any)[table].queryAll({ query: { employee_code: code }, sort, limit: 2000 });
    return res?.data?.items ?? [];
  } catch { return []; }
}

// ---------- ملف الموظف الشامل — جلب كل الأقسام بالرقم الوظيفي ----------
export const fetchMasterByCode = (code: string) => listByCode('imported_employees', code, 'id');
export const fetchAssignmentsByCode = (code: string) => listByCode('employee_assignments', code, '-id');
export const fetchAttendanceByCode = (code: string) => listByCode('attendance_logs', code, '-work_date');
export const fetchQualificationsByCode = (code: string) => listByCode('employee_qualifications', code, '-id');
export const fetchWorkViolationsByCode = (code: string) => listByCode('violations', code, '-id');
export const fetchTrafficViolationsByCode = (code: string) => listByCode('traffic_violations', code, '-id');
export const fetchVisitsByCode = (code: string) => listByCode('field_visits', code, '-id');
export const fetchSupportByCode = (code: string) => listByCode('support_movements', code, '-id');
export const fetchLettersByCode = (code: string) => listByCode('recruitment_letters', code, '-id');
export const fetchAuditByCode = (code: string) => listByCode('hr_audit_logs', code, '-id');

export const QUAL_TYPES = ['مؤهلات علمية', 'خبرة عملية', 'دورة تدريبية', 'رخصة', 'وسام/تكريم'];

export async function addQualification(data: {
  employee_code: string; employee_name: string; qual_type: string; title: string;
  institution?: string; from_date?: string; to_date?: string; years?: number; notes?: string;
}, actor: string) {
  const created = await createRow('employee_qualifications', { ...data, created_by: actor });
  await hrAudit(actor, 'إضافة مؤهل/خبرة', 'employee_qualifications', created?.id ?? '', `${data.employee_name} — ${data.qual_type}: ${data.title}`, data.employee_code);
  return created;
}
export async function deleteQualification(id: number, actor: string, code = '', name = '') {
  await (client.entities as any).employee_qualifications.delete({ id });
  await hrAudit(actor, 'حذف مؤهل/خبرة', 'employee_qualifications', id, name, code);
}

// جلب كل مخالفات العمل من الباك-إند
export const fetchWorkViolations = () => listAll('violations', '-id');

// حفظ مخالفة عمل في الباك-إند مرتبطة برقم الموظف
export async function createWorkViolation(data: any, actor: string) {
  const created = await createRow('violations', { ...data, created_by: actor });
  await hrAudit(actor, 'رصد مخالفة عمل', 'violations', created?.id ?? '', `${data.employee_name} — ${data.violation_type}`, data.employee_code || '');
  return created;
}
export async function updateWorkViolation(id: number, patch: any, actor: string, actionLabel: string, code = '') {
  await updateRow('violations', id, patch);
  await hrAudit(actor, actionLabel, 'violations', id, '', code);
}

// جلب نماذج المرور الميداني من الباك-إند
export const fetchFieldVisits = () => listAll('field_visits', '-id');

// حفظ نموذج المرور الميداني في الباك-إند
export async function saveFieldVisitBackend(data: any, actor: string) {
  const created = await createRow('field_visits', { ...data, created_by: actor });
  await hrAudit(actor, 'حفظ نموذج مرور ميداني', 'field_visits', created?.id ?? '', `${data.site || ''}`, data.employee_code || '');
  return created;
}

// جلب حركات المساندة من الباك-إند
export const fetchSupportMovements = () => listAll('support_movements', '-id');
export async function deleteSupportMovement(id: number) {
  await (client.entities as any).support_movements.delete({ id });
}

// حفظ حركة المساندة (المباشرات) في الباك-إند
export async function saveSupportMovementBackend(data: any, actor: string) {
  const created = await createRow('support_movements', { ...data, created_by: actor });
  await hrAudit(actor, 'تسجيل حركة مساندة', 'support_movements', created?.id ?? '', `${data.employee_name} — ${data.movement_type}`, data.employee_code || '');
  return created;
}
// ---------- الأرصدة وفق اللائحة ----------
export async function createViolationRecord(data: {
  employee_code: string; employee_name: string; employee_id_number?: string; project?: string;
  site?: string; violation_type: string; description: string; amount: number; recorded_date?: string;
}, actor: string) {
  const created = await createRow('violations', { status: 'draft', ...data, created_by: actor });
  await hrAudit(actor, 'رصد مخالفة عمل', 'violations', created?.id ?? '', `${data.employee_name} — ${data.violation_type} (${data.amount} ر.س)`, data.employee_code);
  return created;
}
export async function createFieldVisitRecord(data: {
  employee_code: string; project?: string; site?: string; site_code?: string; client_name?: string;
  supervisor_name: string; visit_date: string; shift?: string; rows_data?: string; evaluation?: string;
  corrective_action?: string; notes?: string; status?: string;
}, actor: string) {
  const created = await createRow('field_visits', { status: 'مسودة', ...data, created_by: actor });
  await hrAudit(actor, 'حفظ نموذج مرور ميداني', 'field_visits', created?.id ?? '', `مشرف ${data.supervisor_name} — ${data.visit_date}`, data.employee_code);
  return created;
}

// ---------- الأرصدة وفق اللائحة ----------
export function serviceYearsOf(joined: string, ref = todayISO()): number {
  if (!joined) return 0;
  const a = new Date(joined + 'T00:00:00').getTime();
  const b = new Date(ref + 'T00:00:00').getTime();
  if (isNaN(a) || isNaN(b) || b < a) return 0;
  return Math.floor((b - a) / (365.25 * 24 * 3600 * 1000));
}
// الاستحقاق السنوي: 21 يوماً بعد السنة الأولى، 30 يوماً بعد 5 سنوات خدمة
export function annualEntitlement(years: number): number {
  return years >= 5 ? 30 : 21;
}
export const SICK_CAP = 120; // حتى 120 يوماً حسب التقرير الطبي المعتمد

export const fetchBalances = () => listAll('hr_leave_balances', 'employee_code');

export async function ensureBalance(emp: { no: string; name: string; kind?: string; joined?: string }): Promise<any> {
  const rows = await listAll('hr_leave_balances', 'employee_code');
  const found = rows.find((r: any) => r.employee_code === emp.no);
  if (found) return found;
  const years = serviceYearsOf(emp.joined || '');
  const created = await createRow('hr_leave_balances', {
    employee_code: emp.no, employee_name: emp.name, employee_kind: emp.kind || 'تشغيلي',
    annual_balance: annualEntitlement(years), annual_used: 0,
    sick_balance: SICK_CAP, sick_used: 0, unpaid_days: 0,
    notes: `استحقاق محسوب حسب سنوات الخدمة (${years})`,
  });
  await hrAudit('النظام', 'إنشاء رصيد', 'hr_leave_balances', created?.id ?? emp.no, `موظف ${emp.name}`, emp.no);
  return created;
}

export function balanceRemaining(b: any) {
  return {
    annual: Math.max(0, (b?.annual_balance ?? 0) - (b?.annual_used ?? 0)),
    sick: Math.max(0, (b?.sick_balance ?? 0) - (b?.sick_used ?? 0)),
  };
}

// ---------- دورة اعتماد طلبات الإجازة ----------
export const fetchLeaves = () => listAll('hr_leave_requests', '-id');

export function leaveStage(row: any): string {
  for (const s of APPROVAL_STAGES) {
    if ((row[s.field] || 'pending') === 'pending') return s.code;
  }
  return 'done';
}
export function leaveOverall(row: any): string {
  if (row.supervisor_status === 'rejected' || row.manager_status === 'rejected' || row.hr_status === 'rejected') return 'مرفوضة';
  if (row.hr_status === 'approved') return 'معتمدة';
  return 'معلقة';
}

export function daysBetween(start: string, end: string): number {
  const a = new Date(start + 'T00:00:00').getTime();
  const b = new Date(end + 'T00:00:00').getTime();
  if (isNaN(a) || isNaN(b) || b < a) return 0;
  return Math.round((b - a) / (24 * 3600 * 1000)) + 1;
}

export async function createLeave(data: {
  employee_code: string; employee_name: string; employee_kind: string;
  leave_type: string; start_date: string; end_date: string; reason: string;
  attachment_key?: string; attachment_name?: string;
}) {
  const days = daysBetween(data.start_date, data.end_date);
  const created = await createRow('hr_leave_requests', {
    ...data, days_count: days,
    supervisor_status: 'pending', manager_status: 'pending', hr_status: 'pending',
    overall_status: 'معلقة', decision_note: '',
  });
  await hrAudit(data.employee_name, 'تقديم طلب إجازة', 'hr_leave_requests', created?.id ?? '', `${data.leave_type} (${days} يوم)`, data.employee_code);
  return created;
}

// قرار اعتماد/رفض في مرحلة محددة؛ اعتماد HR يرحّل تلقائياً إلى ملف الموظف (الرصيد)
export async function decideLeave(row: any, stage: string, decision: 'approved' | 'rejected', note: string, actor: string) {
  const st = APPROVAL_STAGES.find((s) => s.code === stage);
  if (!st) return;
  const patch: any = { [st.field]: decision, decision_note: note };
  await updateRow('hr_leave_requests', row.id, patch);
  const merged = { ...row, ...patch };
  const overall = leaveOverall(merged);
  await updateRow('hr_leave_requests', row.id, { overall_status: overall });
  await hrAudit(actor, decision === 'approved' ? `اعتماد (${st.label})` : `رفض (${st.label})`, 'hr_leave_requests', row.id, `${row.employee_name} — ${row.leave_type} → ${overall}`, row.employee_code);
  if (stage === 'hr' && decision === 'approved') {
    await applyLeaveToBalance(merged);
  }
  return { ...merged, overall_status: overall };
}

async function applyLeaveToBalance(row: any) {
  const bal = await ensureBalance({ no: row.employee_code, name: row.employee_name, kind: row.employee_kind });
  if (!bal) return;
  const days = row.days_count || 0;
  const patch: any = {};
  if (row.leave_type === 'إجازة سنوية') patch.annual_used = (bal.annual_used || 0) + days;
  else if (row.leave_type === 'إجازة مرضية') patch.sick_used = (bal.sick_used || 0) + days;
  else if (row.leave_type === 'إجازة بدون راتب') patch.unpaid_days = (bal.unpaid_days || 0) + days;
  if (Object.keys(patch).length) await updateRow('hr_leave_balances', bal.id, patch);
  await hrAudit('النظام', 'ترحيل إجازة معتمدة إلى الرصيد', 'hr_leave_balances', bal.id, `${row.employee_name} — ${row.leave_type} (${days} يوم)`, row.employee_code);
}

// ---------- التصفية (مستحقات نهاية الخدمة) ----------
export interface SettlementInput {
  baseSalary: number; annualRemaining: number; unpaidDays: number;
  workedDaysLastMonth: number; violationsDeduct: number;
}
export function computeSettlement(s: SettlementInput) {
  const daily = Math.round((s.baseSalary / 30) * 100) / 100;
  const leaveValue = Math.round(daily * s.annualRemaining * 100) / 100;
  const lastMonth = Math.round(daily * s.workedDaysLastMonth * 100) / 100;
  const unpaid = Math.round(daily * s.unpaidDays * 100) / 100;
  const total = Math.max(0, Math.round((leaveValue + lastMonth - unpaid - s.violationsDeduct) * 100) / 100);
  return { daily, leaveValue, lastMonth, unpaid, total };
}

// ---------- الغياب المتتالي غير المبرر وإنذاره ----------
export function consecutiveAbsence(presentDates: string[], upto = todayISO()): number {
  const set = new Set(presentDates);
  let n = 0;
  const d = new Date(upto + 'T00:00:00');
  d.setDate(d.getDate() - 1); // لا يُحسب اليوم الجاري حتى يكتمل
  while (n < 60 && !set.has(d.toISOString().slice(0, 10))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
export function warningLevelFor(days: number): { code: string; label: string; article: string } | null {
  if (days >= 15) return { code: 'termination', label: 'خطاب فصل — انقطاع 15 يوماً', article: 'المادة الثمانون من نظام العمل — الفقرة السابعة' };
  if (days >= 10) return { code: 'second', label: 'إنذار كتابي ثانٍ — انقطاع 10 أيام', article: 'المادة الثمانون من نظام العمل — الفقرة السابعة' };
  if (days >= 5) return { code: 'first', label: 'إنذار كتابي أول — انقطاع 5 أيام', article: 'المادة الثمانون من نظام العمل — الفقرة السابعة' };
  return null;
}

export const fetchWarnings = () => listAll('hr_warnings', '-id');
export async function createWarning(data: {
  employee_code: string; employee_name: string; warning_type: string;
  absence_days: number; absence_from: string; absence_to: string; article_ref: string; note?: string;
}) {
  const created = await createRow('hr_warnings', {
    ...data, letter_status: 'draft', sent_via: '', sent_date: '', attachment_key: '',
  });
  await hrAudit('إدارة الموارد البشرية', 'إصدار إنذار', 'hr_warnings', created?.id ?? '', `${data.employee_name} — ${data.warning_type} (${data.absence_days} يوم)`, data.employee_code);
  return created;
}
export async function updateWarning(id: number, patch: any) {
  return updateRow('hr_warnings', id, patch);
}

// ---------- طبقة مركز الإرسال (قابلة للربط بواتساب/بريد لاحقاً) ----------
export const SEND_CHANNELS = [
  { code: 'whatsapp', label: 'واتساب — مركز الإرسال (قيد الربط)' },
  { code: 'email', label: 'البريد الإلكتروني — مركز الإرسال (قيد الربط)' },
  { code: 'manual', label: 'تسليم يدوي مقابل التوقيع' },
];
export async function markLetterSent(warningId: number, channel: string, actor: string, attachmentKey = '') {
  await updateRow('hr_warnings', warningId, {
    letter_status: 'sent', sent_via: channel, sent_date: todayISO(),
    ...(attachmentKey ? { attachment_key: attachmentKey } : {}),
  });
  await hrAudit(actor, 'إرسال خطاب', 'hr_warnings', warningId, `عبر ${channel} — الإرسال في اليوم التالي للاعتماد`);
}

// ---------- المستندات والمرفقات ----------
export const fetchHrDocs = () => listAll('hr_documents', '-id');
export async function saveHrDoc(data: {
  employee_code: string; employee_name: string; doc_type: string; doc_lang?: string;
  doc_date?: string; content_json?: string; status?: string; verified?: boolean; issued_by?: string;
}, actor: string) {
  const created = await createRow('hr_documents', {
    doc_lang: 'ar', doc_date: todayISO(), status: 'issued', verified: false, issued_by: 'إدارة الموارد البشرية',
    ...data,
  });
  await hrAudit(actor, 'إصدار مستند', 'hr_documents', created?.id ?? '', `${data.employee_name} — ${data.doc_type}`, data.employee_code);
  return created;
}
export async function deleteHrDoc(id: number, actor: string) {
  // استخراج مفتاح الملف قبل حذف السجل حتى يُحذف من التخزين (B2 ثم Atoms)
  let fileKey = '';
  try {
    const res: any = await (client.entities as any).hr_documents.get({ id });
    const row = res?.data;
    if (row) {
      try {
        const cj = JSON.parse(row.content_json || '{}');
        fileKey = cj.file_key || row.file_key || row.attachment_key || '';
      } catch { fileKey = row.file_key || row.attachment_key || ''; }
    }
  } catch { /* لا يمنع الحذف إذا تعذّر القراءة */ }
  await (client.entities as any).hr_documents.delete({ id });
  if (fileKey) { try { await deleteDoc(fileKey); } catch { /* ignore */ } }
  await hrAudit(actor, 'حذف مستند', 'hr_documents', id);
}
export async function updateHrDoc(id: number, data: any, actor: string) {
  await updateRow('hr_documents', id, data);
  await hrAudit(actor, 'تعديل مستند', 'hr_documents', id, `${data.employee_name || ''} — ${data.doc_type || ''}`, data.employee_code || '');
}

// ---------- الحسابات البنكية ----------
export const fetchBankAccounts = () => listAll('hr_bank_accounts', '-id');
export async function upsertBankAccount(data: {
  employee_code: string; employee_name: string; bank_name: string; account_number: string;
  iban?: string; currency?: string; attachment_key?: string;
}, actor: string) {
  const rows = await listAll('hr_bank_accounts', '-id');
  const found = rows.find((r: any) => r.employee_code === data.employee_code);
  const payload = { ...data, currency: data.currency || 'SAR', changed_at: todayISO() };
  let created;
  if (found) created = await updateRow('hr_bank_accounts', found.id, payload);
  else created = await createRow('hr_bank_accounts', payload);
  await hrAudit(actor, found ? 'تحديث حساب بنكي' : 'تسجيل حساب بنكي', 'hr_bank_accounts', created?.id ?? '', `${data.employee_name} — ${data.bank_name}`, data.employee_code);
  return created;
}

// ---------- الحركة الوظيفية ----------
export const fetchEvents = () => listAll('hr_employment_events', '-id');
export async function addEvent(data: {
  employee_code: string; employee_name: string; event_type: string;
  event_date?: string; details?: string; attachment_key?: string;
}, actor: string) {
  const created = await createRow('hr_employment_events', { event_date: todayISO(), details: '', ...data });
  await hrAudit(actor, `حركة وظيفية: ${data.event_type}`, 'hr_employment_events', created?.id ?? '', data.employee_name, data.employee_code);
  return created;
}

// ---------- مسيرات الرواتب وملف البنك ----------
export const fetchPayrollRuns = () => listAll('payroll_runs', '-id');
export const fetchPayrollItems = () => listAll('payroll_run_items', 'serial_no');

export function nextDayISO(): string {
  const d = new Date(todayISO() + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
export function uniqueBatchNo(): string {
  return 'B' + Date.now().toString().slice(-8);
}
export function uniqueFileRef(): string {
  return 'SEYAJ' + Date.now().toString().slice(-10);
}

// بناء ملف البنك وفق النموذج: تاريخ الاستحقاق = اليوم التالي، التسلسل من 0001،
// رقم دفعة فريد، مرجع ملف، العملة SAR
export function buildBankFile(batchNo: string, items: any[]) {
  const paymentNo = 'PAY' + Date.now().toString();
  const fileRef = uniqueFileRef();
  const dueDate = nextDayISO();
  const rows = items.map((it, i) => ({
    serial_no: String(i + 1).padStart(4, '0'),
    employee_code: it.employee_code,
    employee_name: it.employee_name,
    id_number: it.id_number,
    account_number: it.account_number,
    amount: it.amount,
    currency: 'SAR',
  }));
  return { batchNo, paymentNo, fileRef, dueDate, currency: 'SAR', rows };
}

export function bankFileToCsv(file: ReturnType<typeof buildBankFile>): string {
  const head = ['Batch', file.batchNo, 'PaymentNo', file.paymentNo, 'FileRef', file.fileRef, 'DueDate', file.dueDate, 'Currency', file.currency];
  const cols = ['SerialNo', 'EmployeeCode', 'EmployeeName', 'IDNumber', 'AccountNumber', 'Amount', 'Currency'];
  const lines = [head.join(','), cols.join(','), ...file.rows.map((r) => [r.serial_no, r.employee_code, r.employee_name, r.id_number, r.account_number, r.amount, r.currency].join(','))];
  return '\ufeff' + lines.join('\n');
}

export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export async function createPayrollRun(meta: {
  batch_no: string; due_date: string; file_ref: string; currency: string;
  employees_count: number; total_amount: number; created_by: string;
}, items: any[]) {
  const run = await createRow('payroll_runs', { ...meta, status: 'draft', bank_file_json: '' });
  for (let i = 0; i < items.length; i++) {
    await createRow('payroll_run_items', {
      batch_no: meta.batch_no, serial_no: String(i + 1).padStart(4, '0'), ...items[i], currency: 'SAR',
    });
  }
  await hrAudit(meta.created_by, 'إنشاء مسير رواتب', 'payroll_runs', run?.id ?? meta.batch_no, `${meta.employees_count} موظف — ${meta.total_amount} SAR`);
  return run;
}
export async function approvePayrollRun(run: any, actor: string) {
  const file = buildBankFile(run.batch_no, (await fetchPayrollItems()).filter((i: any) => i.batch_no === run.batch_no));
  await updateRow('payroll_runs', run.id, { status: 'approved', bank_file_json: JSON.stringify(file) });
  await hrAudit(actor, 'اعتماد مسير وتوليد ملف البنك', 'payroll_runs', run.id, `دفعة ${file.paymentNo} — استحقاق ${file.dueDate}`);
  return file;
}

// ---------- إعدادات الوحدة ----------
export const fetchHrSettings = () => listAll('hr_settings', 'setting_key');
export async function setHrSetting(key: string, value: string, description: string, actor: string) {
  const rows = await listAll('hr_settings', 'setting_key');
  const found = rows.find((r: any) => r.setting_key === key);
  if (found) await updateRow('hr_settings', found.id, { setting_value: value, description });
  else await createRow('hr_settings', { setting_key: key, setting_value: value, description });
  await hrAudit(actor, 'تعديل إعداد', 'hr_settings', key, `${key} = ${value}`);
}

// ---------- تنبيهات الانتهاء (هوية/إقامة/شهادات/عقود) ----------
export function expiryStatus(dateStr?: string | null, warnDays = 60): { label: string; severity: 'danger' | 'warning' | 'ok' } | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00').getTime();
  if (isNaN(d)) return null;
  const now = new Date(todayISO() + 'T00:00:00').getTime();
  const diff = Math.round((d - now) / (24 * 3600 * 1000));
  if (diff < 0) return { label: `منتهية منذ ${-diff} يوم`, severity: 'danger' };
  if (diff <= warnDays) return { label: `تنتهي خلال ${diff} يوم`, severity: 'warning' };
  return { label: 'سارية', severity: 'ok' };
}

// ---------- التكامل المستقبلي ----------
export const FUTURE_INTEGRATIONS = [
  { key: 'qowa', label: 'منصة قوى (قوى عاملة)', desc: 'رفع عقود وحالات التوظيف مستقبلاً', status: 'غير مفعّل' },
  { key: 'gosi', label: 'التأمينات الاجتماعية (GOSI)', desc: 'مطابقة الاشتراكات والتسجيلات', status: 'غير مفعّل' },
  { key: 'mudad', label: 'منصة Mudad', desc: 'احتساب الأجور ومسير الرواتب الموحد', status: 'غير مفعّل' },
  { key: 'bank_api', label: 'الرفع المباشر للبنك', desc: 'رفع ملف البنك عبر API بعد تزويد المفاتيح', status: 'غير مفعّل — الملف يُصدَّر يدوياً حالياً' },
];
export const fetchIntegrationsStatus = async () => {
  const rows = await fetchHrSettings();
  const map: Record<string, string> = {};
  for (const r of rows) if (String(r.setting_key).startsWith('integration_')) map[r.setting_key] = r.setting_value;
  return map;
};
