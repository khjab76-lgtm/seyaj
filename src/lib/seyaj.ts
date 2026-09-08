// ============================================================
// طبقة منطق «سياج» للتوسعة الكبرى:
// التقارير الذكية، التايم شيت، البدلات/التأمينات، سعة المواقع،
// حركة المساندة، المرور الميداني والتشييك، مسار المخالفات.
// ============================================================
import { TODAY } from '@/data/mock';

// ---------- أنواع التقارير (مركز التقارير الذكي) ----------
export type ReportTypeKey =
  | 'late' | 'absent' | 'resign' | 'committed' | 'transfer' | 'leave' | 'quit' | 'detailed';

export const REPORT_TYPES: { key: ReportTypeKey; label: string; desc: string }[] = [
  { key: 'late', label: 'المتأخرون', desc: 'من تجاوز وقت بداية الوردية' },
  { key: 'absent', label: 'الغيابات', desc: 'من لم يسجّل حضوراً' },
  { key: 'resign', label: 'الانسحابات', desc: 'طلبات الانسحاب من الوردية' },
  { key: 'committed', label: 'الملتزمون', desc: 'الحضور الكامل دون تأخير' },
  { key: 'transfer', label: 'التحويلات', desc: 'طلبات النقل بين المواقع/المشاريع' },
  { key: 'leave', label: 'الإجازات', desc: 'الإجازات المعتمدة والمعلقة' },
  { key: 'quit', label: 'الاستقالات', desc: 'الموظفون المستقيلون' },
  { key: 'detailed', label: 'تقرير تفصيلي بالرواتب', desc: 'رقم وظيفي/اسم/هوية/مشروع/موقع/أيام/راتب/عميل/تواقيع' },
];

// ---------- البدلات والخصومات الافتراضية (قابلة للتعديل من الإعدادات) ----------
export type AllowanceKey =
  | 'uniform_normal' | 'uniform_formal' | 'badge' | 'belt' | 'cap'
  | 'salary_letter' | 'jacket' | 'toxic_env' | 'clear_record' | 'client_deduct';

export interface AllowanceItem {
  key: AllowanceKey;
  label: string;
  amount: number;
  kind: 'deduction' | 'allowance';
}

export const DEFAULT_ALLOWANCES: AllowanceItem[] = [
  { key: 'uniform_normal', label: 'بدلة عادية', amount: 200, kind: 'deduction' },
  { key: 'uniform_formal', label: 'بدلة رسمية', amount: 450, kind: 'deduction' },
  { key: 'badge', label: 'شعار', amount: 10, kind: 'deduction' },
  { key: 'belt', label: 'قايش', amount: 15, kind: 'deduction' },
  { key: 'cap', label: 'كاب', amount: 15, kind: 'deduction' },
  { key: 'salary_letter', label: 'تعريف راتب', amount: 35, kind: 'deduction' },
  { key: 'jacket', label: 'جاكيت', amount: 0, kind: 'deduction' },
  { key: 'toxic_env', label: 'سموم', amount: 0, kind: 'deduction' },
  { key: 'clear_record', label: 'خلو سوابق', amount: 0, kind: 'deduction' },
  { key: 'client_deduct', label: 'حسم العميل', amount: 0, kind: 'deduction' },
];

// ---------- بنود تقييم نموذج التشييك (من الصورة المرفقة) ----------
export const CHECKLIST_ITEMS = [
  'رجال الأمن ملتزمون بالزي الرسمي',
  'رجال الأمن ملتزمون بالتعليمات',
  'يوجد بطاقات عمل للحراس',
  'يوجد خطاب تثبيت للحراس',
  'يوجد سجل حراس داخل الفرع',
  'خلو سوابق',
  'شهادة تدريب',
];

// ---------- أنواع المخالفات ----------
export const VIOLATION_TYPES = [
  'تأخر عن الوردية',
  'عدم الالتزام بالزي الرسمي',
  'ترك الموقع',
  'نوم أثناء الوردية',
  'استخدام الجوال',
  'سلوك غير لائق',
  'عدم تسليم الموقع',
  'أخرى',
];

// ---------- حالات مسار المخالفة ----------
export const VIOLATION_FLOW = [
  { code: 'draft', label: 'مرصودة (مشرف)' },
  { code: 'ops_approved', label: 'معتمدة (مدير العمليات)' },
  { code: 'hr_approved', label: 'معتمدة (الموارد البشرية)' },
  { code: 'hr_rejected', label: 'مرفوضة (الموارد البشرية)' },
  { code: 'objected', label: 'اعتراض قيد الدراسة' },
  { code: 'objection_accepted', label: 'اعتراض مقبول (ملغاة)' },
  { code: 'objection_rejected', label: 'اعتراض مرفوض (مثبتة)' },
  { code: 'signed', label: 'موقعة من الموظف' },
  { code: 'deducted', label: 'مخصومة من الراتب' },
];

export function violationStatusLabel(code: string): string {
  return VIOLATION_FLOW.find((f) => f.code === code)?.label ?? code;
}

// ---------- أنواع حركة المساندة ----------
export const SUPPORT_TYPES = [
  { code: 'coverage', label: 'تغطية موقع' },
  { code: 'extra', label: 'ورديّة إضافية' },
  { code: 'rest_relief', label: 'بديل راحات' },
];

// ---------- رواتب أساسية حسب المسمى ----------
export const SALARY_BY_JOB: Record<string, number> = {
  'رجل أمن': 3200, 'حارس بوابة': 3000, 'أمن منشآت': 3500, 'مراقب كاميرات': 3800,
  'رئيس وردية': 4200, 'مشرف موقع': 5500, 'مشرف أمن': 6000,
};
export function salaryOf(job: string): number {
  return SALARY_BY_JOB[job] ?? 3000;
}

// رقم الهوية: توليد ثابت من رقم الجوال (10 أرقام تبدأ بـ1)
export function saIdOf(phone: string): string {
  return '1' + String(phone || '').replace(/\D/g, '').slice(1, 10);
}

// ---------- العميل حسب المشروع ----------
export const CLIENT_BY_PROJECT: Record<number, string> = {
  1: 'وزارة الحرس الوطني', 2: 'شركة تطوير المربع (كافد)', 3: 'أرامكو السعودية',
  4: 'الهيئة العامة للترفيه', 5: 'البنك الأهلي السعودي', 6: 'مدينة الملك فهد الطبية',
};
export function clientOf(projectId: number): string {
  return CLIENT_BY_PROJECT[projectId] ?? '—';
}

// ---------- حساب صافي الراتب ----------
// صافي = الراتب الأساسي + البدلات - الخصومات (بدلات/خصومات) - حسم التأمين - حسم المخالفات
export interface PayslipInput {
  baseSalary: number;
  allowances: number; // مجموع البدلات الإيجابية
  deductions: number; // مجموع الخصومات (البدلات المقتطعة + حسم العميل + سموم...)
  insurance: number;
  violations: number;
}

export function computeNet(p: PayslipInput): number {
  return Math.max(0, Math.round((p.baseSalary + p.allowances - p.deductions - p.insurance - p.violations) * 100) / 100);
}

export function fmt(n: number): string {
  return (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// ---------- شبكة التايم شيت (30 يوم) ----------
export const MONTH_DAYS = Array.from({ length: 30 }, (_, i) => i + 1);

// رموز الحضور في خلية التايم شيت
export const TS_MARKS = [
  { code: '1', label: 'حضور' },
  { code: 'ط', label: 'تغطية' },
  { code: 'إ', label: 'إضافي' },
  { code: 'ر', label: 'راحة' },
  { code: 'م', label: 'متأخر' },
  { code: 'غ', label: 'غياب' },
  { code: 'إج', label: 'إجازة' },
];

// ---------- كشف تجاوز سعة الموقع ----------
export interface SiteCapacity {
  siteId: number;
  base: number;      // موظف أساسي
  relief: number;    // بديل راحات
  patrol: number;    // دورية
  cost: number;      // تكلفة الموقع
}

export function siteHeadcount(siteId: number, employees: any[]): number {
  return employees.filter((e) => e.siteId === siteId && e.status === 'نشط').length;
}

export function isOverCapacity(cap: SiteCapacity, headcount: number): boolean {
  return headcount > cap.base + cap.relief + cap.patrol;
}

// ---------- بيانات بذور التوسعة ----------
export const seedSettings: AllowanceItem[] = DEFAULT_ALLOWANCES.map((a) => ({ ...a }));

export const seedSiteCapacity: SiteCapacity[] = [
  { siteId: 1, base: 4, relief: 1, patrol: 0, cost: 42000 },
  { siteId: 2, base: 3, relief: 1, patrol: 1, cost: 38000 },
  { siteId: 3, base: 2, relief: 1, patrol: 0, cost: 26000 },
  { siteId: 4, base: 2, relief: 0, patrol: 0, cost: 20000 },
  { siteId: 5, base: 2, relief: 0, patrol: 0, cost: 20000 },
  { siteId: 6, base: 2, relief: 1, patrol: 0, cost: 24000 },
  { siteId: 7, base: 1, relief: 0, patrol: 0, cost: 12000 },
  { siteId: 8, base: 1, relief: 0, patrol: 0, cost: 12000 },
];

export const seedInsurance = [
  { id: 1, employeeName: 'فهد بن محمد العتيبي', employeeId: '1012345678', project: 'حراسة مقر وزارة الحرس الوطني', site: 'الرياض الشمالي - بوابة الحرس', company: 'شركة التأمين المتحدة', monthlyDeduction: 180, status: 'مسجّل' },
  { id: 2, employeeName: 'سلطان بن علي القحطاني', employeeId: '1098765432', project: 'حراسة مقر وزارة الحرس الوطني', site: 'الرياض الشمالي - بوابة الحرس', company: 'بوبا العربية', monthlyDeduction: 200, status: 'مسجّل' },
  { id: 3, employeeName: 'ماجد بن سعد الدوسري', employeeId: '1033445566', project: 'تأمين مجمع الملك عبدالله المالي', site: 'مجمع الملك عبدالله المالي', company: 'التعاونية', monthlyDeduction: 160, status: 'مسجّل' },
];

export const seedViolations = [
  { id: 1, employeeName: 'بدر بن خالد المطيري', employeeId: '1066778899', project: 'تأمين مدينة الملك فهد الطبية', site: 'وسط الرياض - أبراج الفيصلية', type: 'عدم الالتزام بالزي الرسمي', description: 'رُصد بدون ربطة العنق أثناء جولة مسائية', amount: 150, status: 'draft', opsApprover: '', hrApprover: '', employeeSigned: false, commitmentText: '', date: TODAY, owner: 'client' },
  { id: 2, employeeName: 'سعود بن فيصل السبيعي', employeeId: '1050334455', project: 'تأمين فعاليات موسم الرياض', site: 'وسط الرياض - أبراج الفيصلية', type: 'استخدام الجوال', description: 'استخدام الجوال أثناء الوردية', amount: 100, status: 'ops_approved', opsApprover: 'سلطان العتيبي', hrApprover: '', employeeSigned: false, commitmentText: '', date: TODAY, owner: 'company' },
  { id: 3, employeeName: 'تركي بن فهد الغامدي', employeeId: '1055778899', project: 'تأمين فعاليات موسم الرياض', site: 'وسط الرياض - أبراج الفيصلية', type: 'تأخر عن الوردية', description: 'تأخر 25 دقيقة', amount: 80, status: 'deducted', opsApprover: 'سلطان العتيبي', hrApprover: 'إدارة الموارد البشرية', employeeSigned: true, commitmentText: 'أتعهد بعدم التكرار', date: '2026-08-28', owner: 'client' },
];

export const seedFieldVisits = [
  {
    id: 1, project: 'حراسة فرع البنك الأهلي - جدة', site: 'جدة الرئيسي - كورنيش', siteCode: 'S-004',
    clientName: 'البنك الأهلي (SNB)', supervisorName: 'محمد الوباص', visitDate: TODAY, shift: 'صباحية',
    rows: [
      { no: 1, name: 'ناصر بن حمد الشمري', site: 'جدة الرئيسي - كورنيش', arrival: '07:00', departure: '15:00', uniform: 'ملتزم', clean: 'جيدة', guardSign: '✓', note: '' },
    ],
    evaluation: { 'رجال الأمن ملتزمون بالزي الرسمي': true, 'رجال الأمن ملتزمون بالتعليمات': true, 'يوجد بطاقات عمل للحراس': true, 'يوجد خطاب تثبيت للحراس': true, 'يوجد سجل حراس داخل الفرع': true },
    correctiveAction: '', notes: 'لا يوجد', branchManagerSign: 'بديع بوبريد الشهراني', branchStamp: 'الأهلي SNB - 1734', status: 'مكتمل',
  },
  {
    id: 2, project: 'حراسة مقر وزارة الحرس الوطني', site: 'الرياض الشمالي - بوابة الحرس', siteCode: 'S-001',
    clientName: 'وزارة الحرس الوطني', supervisorName: 'سلطان العتيبي', visitDate: TODAY, shift: 'ليلية',
    rows: [
      { no: 1, name: 'فهد بن محمد العتيبي', site: 'الرياض الشمالي - بوابة الحرس', arrival: '22:00', departure: '06:00', uniform: 'ملتزم', clean: 'جيدة', guardSign: '✓', note: '' },
      { no: 2, name: 'سلطان بن علي القحطاني', site: 'الرياض الشمالي - بوابة الحرس', arrival: '22:00', departure: '06:00', uniform: 'ملتزم', clean: 'جيدة', guardSign: '✓', note: '' },
    ],
    evaluation: { 'رجال الأمن ملتزمون بالزي الرسمي': true, 'رجال الأمن ملتزمون بالتعليمات': true, 'يوجد بطاقات عمل للحراس': true, 'يوجد خطاب تثبيت للحراس': false, 'يوجد سجل حراس داخل الفرع': true },
    correctiveAction: 'طلب خطاب تثبيت عاجل', notes: 'بند خطاب التثبيت غير متوفر', branchManagerSign: '', branchStamp: '', status: 'مسودة',
  },
];

export const seedSupportMovements = [
  { id: 1, employeeName: 'عبدالله بن سالم الشهري', employeeId: '1057990011', homeSite: 'الدمام الصناعي - مستودعات أرامكو', coveredSite: 'الخبر الإداري - مركز الأعمال', date: TODAY, type: 'coverage', checkIn: '07:00', checkOut: '15:00', note: 'تغطية غياب' },
  { id: 2, employeeName: 'خالد بن عمر الحربي', employeeId: '1059667788', homeSite: 'مجمع الملك عبدالله المالي', coveredSite: 'مجمع الملك عبدالله المالي', date: TODAY, type: 'extra', checkIn: '15:00', checkOut: '23:00', note: 'ورديّة إضافية' },
];

// ---------- أدوات مساعدة ----------
export function arDate(iso: string): string {
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('ar-EG-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return iso;
  }
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate();
}