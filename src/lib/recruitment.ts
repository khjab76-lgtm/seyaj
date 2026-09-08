// ============================================================
// وحدة التوظيف والخطابات «سياج» — طلب التوظيف الإلكتروني
// نموذج كامل + رقم طلب تلقائي + تدفق حالات + سجل اعتماد +
// مرفقات التخزين السحابي (حاوية seyaj-docs) + تحويل بالربط إلى
// موظف مع بقاء الطلب الأصلي في الأرشيف.
// ============================================================
import { client } from './api';
import { todayISO, uploadDoc, getFileUrl, downloadDoc, BUCKET } from './backend';
import { hrAudit } from './hr';

export { todayISO, uploadDoc, getFileUrl, downloadDoc, BUCKET, hrAudit };

const TABLE = 'recruitment_applications';

// ---------- أدوات CRUD عبر Web SDK ----------
async function listAll(sort = '-id'): Promise<any[]> {
  try {
    const res: any = await (client.entities as any)[TABLE].queryAll({ sort, limit: 1000 });
    return res?.data?.items ?? [];
  } catch {
    return [];
  }
}
async function createRow(data: any): Promise<any> {
  const res: any = await (client.entities as any)[TABLE].create({ data });
  return res?.data;
}
async function updateRow(id: number, data: any): Promise<any> {
  const res: any = await (client.entities as any)[TABLE].update({ id, data });
  return res?.data;
}

// ---------- تدفق الحالات ----------
export const APP_STATUSES = ['جديد', 'قيد المراجعة', 'مقابلة', 'مقبول', 'مرفوض', 'مكتمل'];
export const STATUS_TONE: Record<string, string> = {
  'جديد': 'bg-sky-50 text-sky-700 ring-sky-200',
  'قيد المراجعة': 'bg-amber-50 text-amber-700 ring-amber-200',
  'مقابلة': 'bg-violet-50 text-violet-700 ring-violet-200',
  'مقبول': 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  'مرفوض': 'bg-rose-50 text-rose-700 ring-rose-200',
  'مكتمل': 'bg-slate-100 text-slate-700 ring-slate-300',
};

// أنواع مرفقات طلب التوظيف
export const APP_DOC_TYPES = ['السيرة الذاتية', 'صورة الهوية/الإقامة', 'المؤهلات والشهادات', 'ملف إضافي'];

// ---------- التحقق ----------
export function validateIdNumber(v: string): boolean { return /^\d{10}$/.test(v.trim()); }
export function validatePhone(v: string): boolean { return /^05\d{8}$/.test(v.trim()); }

// ---------- رقم الطلب التلقائي ----------
export function makeAppNo(rows: any[]): string {
  const year = new Date().getFullYear();
  const seq = rows.filter((r: any) => String(r.app_no || '').includes(String(year))).length + 1;
  return `REC-${year}-${String(seq).padStart(4, '0')}`;
}

// ---------- قراءة الطلبات (الأرشيف الكامل — لا يُحذف شيء) ----------
export const fetchApplications = () => listAll('-id');

// طلبات الموظف المحوَّل — قسم «طلبات التوظيف والمرفقات» في ملف الموظف
export async function fetchApplicationsForEmployee(employeeCode: string): Promise<any[]> {
  const rows = await listAll('-id');
  return rows.filter((r: any) => r.converted && r.employee_code === employeeCode);
}

// ---------- إنشاء طلب جديد ----------
export interface ApplicationForm {
  full_name: string; id_number: string; phone: string; nationality: string;
  birth_date: string; qualification: string; specialization: string;
  experience: string; experience_years: number; job_requested: string;
  city: string; address: string; email: string; emergency_contact: string;
  declaration: boolean; e_signature: string;
}

export function validateApplication(f: ApplicationForm): string | null {
  if (!f.full_name.trim()) return 'الاسم الكامل مطلوب';
  if (!validateIdNumber(f.id_number)) return 'رقم الهوية/الإقامة يجب أن يكون 10 أرقام فقط';
  if (!validatePhone(f.phone)) return 'رقم الجوال يجب أن يبدأ بـ05 ويتكون من 10 أرقام';
  if (!f.nationality.trim()) return 'الجنسية مطلوبة';
  if (!f.birth_date) return 'تاريخ الميلاد مطلوب';
  if (!f.qualification.trim()) return 'المؤهل العلمي مطلوب';
  if (!f.job_requested.trim()) return 'الوظيفة المطلوبة مطلوبة';
  if (!f.city.trim()) return 'المدينة مطلوبة';
  if (!f.declaration) return 'يجب الإقرار بصحة البيانات';
  if (!f.e_signature.trim()) return 'التوقيع الإلكتروني مطلوب';
  return null;
}

export async function createApplication(f: ApplicationForm, attachments: any[]): Promise<any> {
  const rows = await listAll('-id');
  const app_no = makeAppNo(rows);
  const log = [{ at: new Date().toISOString(), by: 'المتقدم', action: 'إنشاء الطلب', status: 'جديد' }];
  const created = await createRow({
    ...f, experience_years: Number(f.experience_years) || 0,
    app_no, app_date: todayISO(),
    attachments_json: JSON.stringify(attachments),
    status: 'جديد', approval_log_json: JSON.stringify(log),
    converted: false, employee_code: '', converted_date: '', converted_by: '', note: '',
  });
  await hrAudit('المتقدم ' + f.full_name, 'تقديم طلب توظيف', TABLE, created?.id ?? app_no, `${app_no} — ${f.job_requested}`);
  return created;
}

// ---------- تعديل الطلب من قبل المسؤول ----------
export async function updateApplication(id: number, patch: any, actor: string, actionLabel: string) {
  const rows = await listAll('-id');
  const row = rows.find((r: any) => r.id === id);
  if (!row) return;
  await updateRow(id, patch);
  const log = parseLog(row);
  log.unshift({ at: new Date().toISOString(), by: actor, action: actionLabel, status: patch.status || row.status });
  await updateRow(id, { approval_log_json: JSON.stringify(log) });
  await hrAudit(actor, actionLabel, TABLE, id, `${row.app_no} — ${row.full_name}`);
}

export function parseLog(row: any): any[] {
  try { return JSON.parse(row?.approval_log_json || '[]'); } catch { return []; }
}
export function parseAttachments(row: any): any[] {
  try { return JSON.parse(row?.attachments_json || '[]'); } catch { return []; }
}

// ---------- نقل الحالة (مراجعة/مقابلة/قبول/رفض) ----------
export async function moveStatus(row: any, status: string, actor: string, note = '') {
  const patch: any = { status };
  if (note) patch.note = note;
  await updateApplication(row.id, patch, actor, `نقل إلى «${status}»`);
}

// ---------- التحويل إلى موظف (ربط، لا نسخ) ----------
export interface ConvertInput {
  project: string; site: string; job: string; hireDate: string;
}
export function buildEmployeeFromApplication(row: any, c: ConvertInput, empNo: string): any {
  return {
    id: 0, // يُعيَّن من المخزن
    name: row.full_name,
    no: empNo,
    job: c.job || row.job_requested,
    projectId: Number(c.project) || 0,
    siteId: Number(c.site) || 0,
    phone: row.phone,
    email: row.email || '',
    status: 'نشط',
    fingerprint: 'غير مفعّل',
    joined: c.hireDate || todayISO(),
    // مراجع إضافية قادمة من طلب التوظيف
    nationality: row.nationality || '',
    idNumber: row.id_number || '',
    recruitmentAppNo: row.app_no,
  };
}

// يُنفَّذ بعد إضافة الموظف إلى المخزن — يربط الطلب بالموظف ويكتمل الأرشيف
export async function convertApplication(row: any, employeeCode: string, actor: string) {
  const log = parseLog(row);
  log.unshift({ at: new Date().toISOString(), by: actor, action: 'تحويل إلى موظف', status: 'مكتمل' });
  await updateRow(row.id, {
    converted: true, employee_code: employeeCode, converted_date: todayISO(),
    converted_by: actor, status: 'مكتمل', approval_log_json: JSON.stringify(log),
  });
  await hrAudit(actor, 'تحويل متقدم إلى موظف', TABLE, row.id, `${row.app_no} → ${employeeCode} — المرفقات مربوطة بالسجل الأصلي`);
}

// ---------- ترقيم الموظفين الجديد ----------
export function nextEmpNo(employees: any[]): string {
  const nums = employees.map((e: any) => parseInt(String(e.no || '').replace(/\D/g, ''), 10)).filter((n: number) => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 2000;
  return `EMP-${max + 1}`;
}

// ============================================================
// الخطابات والقوالب والصلاحيات — وحدة التوظيف والخطابات
// كل خطاب يُرقَّم تلقائياً، ويُنشأ من قالب بمتغيرات الموظف،
// ويمر بدورة (مسودة → معتمد → مُرسل → مؤرشف) مع سجل اعتماد،
// ويُربط بالطلب الأصلي (app_no) دون نسخ المرفقات.
// ============================================================
const LETTERS_TABLE = 'recruitment_letters';

export const LETTER_TYPES = [
  'دعوة مقابلة', 'خطاب عرض عمل', 'خطاب قبول', 'خطاب رفض',
  'خطاب تعيين', 'خطاب تحويل', 'خطاب تثبيت', 'إخلاء طرف', 'شهادة خبرة', 'خطاب بنكي',
];

export const LETTER_STATUSES = ['مسودة', 'معتمد', 'مُرسل', 'مؤرشف'];
export const LETTER_STATUS_TONE: Record<string, string> = {
  'مسودة': 'bg-slate-100 text-slate-700 ring-slate-300',
  'معتمد': 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  'مُرسل': 'bg-sky-50 text-sky-700 ring-sky-200',
  'مؤرشف': 'bg-amber-50 text-amber-700 ring-amber-200',
};

// متغيرات القالب المعتمدة — تُعبأ تلقائياً من بيانات الموظف/الطلب
export const TEMPLATE_VARS = [
  { token: '{employee_name}', label: 'اسم الموظف/المتقدم' },
  { token: '{id_number}', label: 'رقم الهوية/الإقامة' },
  { token: '{job}', label: 'المسمى الوظيفي' },
  { token: '{app_no}', label: 'رقم طلب التوظيف' },
  { token: '{project}', label: 'المشروع' },
  { token: '{site}', label: 'الموقع' },
  { token: '{salary}', label: 'الراتب' },
  { token: '{date}', label: 'تاريخ اليوم' },
  { token: '{letter_no}', label: 'رقم الخطاب' },
];

// قوالب افتراضية (مطابقة لنماذج الخطابات المرفوعة — قابلة للتعديل من الواجهة)
export const DEFAULT_TEMPLATES: Record<string, string> = {
  'دعوة مقابلة': 'يسر شركة سياج للحراسات الأمنية الخاصة دعوتكم لإجراء مقابلة وظيفية لوظيفة {job}.\nالاسم: {employee_name}\nرقم الطلب: {app_no}\nيرجى الحضور مصطحبين الهوية الأصلية والمستندات المطلوبة.\nالتاريخ: {date}',
  'خطاب عرض عمل': 'إشارة إلى طلبكم رقم {app_no}، يسرنا تقديم عرض عمل لوظيفة {job} براتب {salary} ريال.\nالاسم: {employee_name} — رقم الهوية: {id_number}\nآملين قبولكم العرض، والتوقيع بالموافقة.\nالتاريخ: {date}',
  'خطاب قبول': 'تهانينا! تم قبول طلبكم للتوظيف رقم {app_no} على وظيفة {job}.\nسيتم التواصل معكم لاستكمال إجراءات التعيين.\nالاسم: {employee_name}\nالتاريخ: {date}',
  'خطاب رفض': 'شكراً لاهتمامكم بالعمل لدى شركة سياج.\nبعد دراسة طلبكم رقم {app_no}، نعتذر عن عدم التمكن من المضي قدماً.\nالاسم: {employee_name}\nنتمنى لكم التوفيق.\nالتاريخ: {date}',
  'خطاب تعيين': 'تم تعيين السيد/ {employee_name} (رقم الهوية {id_number}) على وظيفة {job} ضمن مشروع {project} — موقع {site}.\nالراتب: {salary} ريال.\nرقم طلب التوظيف المرجعي: {app_no}\nالتاريخ: {date}',
  'إخلاء طرف': 'يقرّ السيد/ {employee_name} بأنه قد تم إخلاء طرفه من جميع التزامات العمل لدى شركة سياج.\nالمسمى: {job} — رقم الطلب: {app_no}\nالتاريخ: {date}',
  'شهادة خبرة': 'تشهد شركة سياج للحراسات الأمنية الخاصة بأن السيد/ {employee_name} يعمل لديها على وظيفة {job} براتب {salary} ريال.\nرقم الهوية: {id_number}\nوصدرت هذه الشهادة بناءً على طلبه. — {date}',
  'خطاب بنكي': 'يرجى فتح حساب مصرفي للسيد/ {employee_name} رقم الهوية {id_number}.\nالجهة: شركة سياج للحراسات الأمنية الخاصة — وظيفة {job}.\nالتاريخ: {date}',
};

export function fillTemplate(tpl: string, vars: Record<string, string>): string {
  let out = tpl || '';
  for (const [k, v] of Object.entries(vars)) out = out.split(k).join(v ?? '');
  return out;
}

// ---------- ترقيم الخطابات ----------
export function makeLetterNo(rows: any[]): string {
  const year = new Date().getFullYear();
  const seq = rows.filter((r: any) => String(r.letter_no || '').includes(String(year))).length + 1;
  return `LTR-${year}-${String(seq).padStart(4, '0')}`;
}

// ---------- CRUD الخطابات (جدول مستقل recruitment_letters) ----------
async function lList(): Promise<any[]> {
  try {
    const res: any = await (client.entities as any)[LETTERS_TABLE].queryAll({ sort: '-id', limit: 1000 });
    return res?.data?.items ?? [];
  } catch { return []; }
}
async function lCreate(data: any): Promise<any> {
  const res: any = await (client.entities as any)[LETTERS_TABLE].create({ data });
  return res?.data;
}
async function lUpdate(id: number, data: any): Promise<any> {
  const res: any = await (client.entities as any)[LETTERS_TABLE].update({ id, data });
  return res?.data;
}

export const fetchLetters = () => lList();

export async function createLetter(data: {
  letter_type: string; app_no: string; app_id: number;
  employee_code: string; employee_name: string; subject: string; content: string;
}, actor: string): Promise<any> {
  const rows = await lList();
  const letter_no = makeLetterNo(rows);
  const log = [{ at: new Date().toISOString(), by: actor, action: 'إنشاء الخطاب', status: 'مسودة' }];
  const created = await lCreate({
    ...data, letter_no, status: 'مسودة', sent_via: '', sent_date: '',
    attachment_key: '', archived: false, approval_log_json: JSON.stringify(log),
  });
  await hrAudit(actor, 'إصدار خطاب توظيف', LETTERS_TABLE, created?.id ?? letter_no, `${letter_no} — ${data.letter_type} — ${data.employee_name}`, data.employee_code || '');
  return created;
}

export async function updateLetter(id: number, patch: any, actor: string, actionLabel: string) {
  const rows = await lList();
  const row = rows.find((r: any) => r.id === id);
  if (!row) return;
  await lUpdate(id, patch);
  const log = parseLog(row);
  log.unshift({ at: new Date().toISOString(), by: actor, action: actionLabel, status: patch.status || row.status });
  await lUpdate(id, { approval_log_json: JSON.stringify(log) });
  await hrAudit(actor, actionLabel, LETTERS_TABLE, id, `${row.letter_no} — ${row.employee_name}`, row.employee_code || '');
}

export async function approveLetter(row: any, actor: string) {
  await updateLetter(row.id, { status: 'معتمد' }, actor, 'اعتماد الخطاب');
}
export async function sendLetter(row: any, channel: string, actor: string, attachmentKey = '') {
  await updateLetter(row.id, { status: 'مُرسل', sent_via: channel, sent_date: todayISO(), attachment_key: attachmentKey || row.attachment_key || '' }, actor, `إرسال الخطاب عبر ${channel}`);
}
export async function archiveLetter(row: any, actor: string) {
  await updateLetter(row.id, { status: 'مؤرشف', archived: true }, actor, 'أرشفة الخطاب');
}

// ---------- الصلاحيات ----------
// مصفوفة صلاحيات مرتبطة بدور المستخدم الحالي (من مصادقة Atoms Cloud)
export const PERMISSION_KEYS = ['عرض', 'تنزيل', 'رفع', 'اعتماد', 'تحويل', 'أرشفة'];
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  'مسؤول التوظيف': ['عرض', 'تنزيل', 'رفع', 'اعتماد', 'تحويل', 'أرشفة'],
  'مدير الموارد البشرية': ['عرض', 'تنزيل', 'رفع', 'اعتماد', 'تحويل', 'أرشفة'],
  'مراجع توظيف': ['عرض', 'تنزيل', 'رفع'],
  'موظف': ['عرض'],
};
export function roleFor(actor: string): string {
  if (/مدير/i.test(actor)) return 'مدير الموارد البشرية';
  if (/مراجع/i.test(actor)) return 'مراجع توظيف';
  return 'مسؤول التوظيف';
}
export function can(actor: string, perm: string): boolean {
  return (ROLE_PERMISSIONS[roleFor(actor)] || []).includes(perm);
}