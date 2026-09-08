// ============================================================
// نماذج الورق الرسمي لوحدة الموارد البشرية «سياج»
// مطابقة للمستندات المعتمدة: تعريف راتب (عربي/إنجليزي/مصدق/مفصل)،
// شهادة خبرة، مخالصة نهائية، استقالة، إنذار كتابي، إنهاء خدمات، خطاب بنكي.
// كل نموذج قابل للطباعة A4 والحفظ PDF.
// ============================================================
import { useRef } from 'react';
import { Printer } from 'lucide-react';
import { Btn } from '@/components/ui-kit';

const LOGO = '/assets/logo-seyaj.png';
export const COMPANY_CR = '7001463491';
export const HR_SIGNATORY = { name: 'محمد سعد السعدان', title: 'مدير الموارد البشرية' };

export interface EmployeeDoc {
  name: string;
  nameEn?: string;
  idNumber: string;
  employeeCode: string;
  nationality?: string;
  job?: string;
  project?: string;
  zone?: string;
  site?: string;
  department?: string;
  hireDate?: string;
  endDate?: string;
  expiryDate?: string;
  basicSalary?: number;
  housingAllowance?: number;
  transferAllowance?: number;
  otherAllowance?: number;
  totalSalary?: number;
  bankName?: string;
  accountNumber?: string;
  iban?: string;
  currency?: string;
  amount?: number;
  reason?: string;
  docDate?: string;
  absenceFrom?: string;
  absenceTo?: string;
  absenceDays?: number;
  toLine?: string;
  settlement?: { daily: number; leaveValue: number; lastMonth: number; unpaid: number; total: number };
  verified?: boolean;
}

function d(iso?: string): string {
  if (!iso) return '   /   /      ';
  try {
    const [y, m, dd] = iso.split('-');
    return `${dd}/${m}/${y}م`;
  } catch {
    return iso;
  }
}
function num(n?: number): string {
  return (n ?? 0).toLocaleString('en-US');
}
function docNo(): string {
  return `SYJ-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
}

// غلاف الورق الرسمي HR — ترويسة سياج + خانات توقيع قابلة للتخصيص
function HrPaper({ title, subtitle, signatories, children, actions, date }: any) {
  const refNo = useRef<string>(docNo());
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 no-print">
        <div className="text-sm text-muted-foreground">معاينة الورق الرسمي — جاهز للطباعة أو الحفظ PDF</div>
        <div className="flex items-center gap-2">
          {actions}
          <Btn variant="gold" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> طباعة / PDF
          </Btn>
        </div>
      </div>
      <div className="seyaj-print-area mx-auto max-w-[820px] bg-white p-8 text-slate-900 shadow-xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-4 border-b-2 border-navy-900 pb-4">
          <div className="text-right">
            <div className="font-cairo text-xl font-extrabold text-navy-900">شركة سياج للحراسات الأمنية المدنية الخاصة</div>
            <div className="text-[11px] font-semibold tracking-wide text-slate-500">SEYAJ COMPANY FOR SECURITY GUARDS</div>
            <div className="mt-1 text-[10px] text-slate-400">المملكة العربية السعودية — الرقم الموحد: {COMPANY_CR}</div>
          </div>
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-white p-1 ring-1 ring-slate-200">
            <img src={LOGO} alt="شعار سياج" className="h-full w-full object-contain" />
          </div>
          <div className="text-left">
            <div className="text-[10px] text-slate-500">رقم الوثيقة</div>
            <div className="font-mono text-xs font-bold text-navy-900">{refNo.current}</div>
            <div className="mt-1 text-[10px] text-slate-500">التاريخ: {d(date || new Date().toISOString().slice(0, 10))}</div>
          </div>
        </div>

        <div className="my-5 text-center">
          <h2 className="font-cairo text-lg font-extrabold text-navy-900">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>

        <div className="text-sm leading-7">{children}</div>

        <div className="mt-12 grid grid-cols-3 gap-6 border-t border-dashed border-slate-300 pt-6 text-center text-xs">
          {(signatories || [
            { label: HR_SIGNATORY.title, name: HR_SIGNATORY.name, sign: true, stamp: true },
          ]).map((s: any, i: number) => (
            <div key={i}>
              <div className="font-bold text-navy-900">{s.label}</div>
              {s.name && <div className="mt-1 text-slate-700">{s.name}</div>}
              <div className={s.sign ? 'mt-8 border-t border-slate-400 pt-1 text-slate-500' : 'mt-8 pt-1 text-slate-500'}>
                {s.sign ? 'التوقيع' : ''}
              </div>
              {s.fingerprint && <div className="mt-3 text-slate-500">البصمة: ......................</div>}
              <div className="mt-1 text-[10px] text-slate-400">{s.stamp ? 'الختم' : ''}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-2 text-[9px] text-slate-400">
          <span>وثيقة صادرة من نظام «سياج» الإلكتروني — هذه النسخة معتمدة إلكترونياً</span>
          <span>www.seyaj.sa</span>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ k, v }: any) {
  return (
    <div className="flex justify-between gap-2 border-b border-slate-100 py-1.5">
      <span className="font-semibold text-slate-500">{k}</span>
      <span className="font-bold text-navy-900">{v || '—'}</span>
    </div>
  );
}

function SalaryTable({ e }: { e: EmployeeDoc }) {
  return (
    <table className="my-4 w-full border-collapse text-center text-xs">
      <thead>
        <tr className="bg-navy-900 text-gold-400">
          <th className="border border-slate-300 px-2 py-2">الراتب الأساسي</th>
          <th className="border border-slate-300 px-2 py-2">بدل السكن</th>
          <th className="border border-slate-300 px-2 py-2">بدلات أخرى</th>
          <th className="border border-slate-300 px-2 py-2">إجمالي الراتب</th>
        </tr>
      </thead>
      <tbody>
        <tr className="font-bold text-navy-900">
          <td className="border border-slate-300 px-2 py-2">{num(e.basicSalary)}</td>
          <td className="border border-slate-300 px-2 py-2">{num(e.housingAllowance)}</td>
          <td className="border border-slate-300 px-2 py-2">{num((e.otherAllowance || 0) + (e.transferAllowance || 0))}</td>
          <td className="border border-slate-300 bg-gold-500/10 px-2 py-2">{num(e.totalSalary)}</td>
        </tr>
      </tbody>
    </table>
  );
}

// ---------- 1) تعريف راتب عربي (مصدق/غير مصدق) ----------
export function SalaryLetterAr({ e }: { e: EmployeeDoc }) {
  return (
    <HrPaper title="خطاب تعريف راتب" subtitle={e.verified ? 'نسخة مصدقة' : 'نسخة غير مصدقة'}>
      <p className="font-bold">السلام عليكم ورحمة الله وبركاته</p>
      <p className="mt-2">
        بهذا تشهد شركة سياج للحراسات الأمنية المدنية الخاصة رقم موحد {COMPANY_CR} بأن الموظف الموضح بياناته أدناه يعمل لديها
        ولا يزال على رأس العمل حتى تاريخه، وبناء على طلبه تم منحه هذا الخطاب لتقديمه إليكم وذلك دون أدنى مسؤولية على الشركة
        سواء كانت مادية أو معنوية.
      </p>
      <div className="my-4 grid grid-cols-2 gap-x-8 rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
        <InfoRow k="الاسم" v={e.name} />
        <InfoRow k="الرقم الوظيفي" v={e.employeeCode} />
        <InfoRow k="رقم الهوية" v={e.idNumber} />
        <InfoRow k="الوظيفة" v={e.job} />
        <InfoRow k="تاريخ الانتهاء" v={d(e.expiryDate)} />
        <InfoRow k="تاريخ التعيين" v={d(e.hireDate)} />
        <InfoRow k="الجنسية" v={e.nationality} />
        <InfoRow k="المشروع" v={e.project} />
        <InfoRow k="المنطقة" v={e.zone} />
      </div>
      <SalaryTable e={e} />
      {e.verified && (
        <div className="mt-3 rounded-lg border-2 border-dashed border-emerald-500 p-3 text-center text-xs font-bold text-emerald-700">
          تم تصديق هذا الخطاب من وزارة الموارد البشرية والتنمية الاجتماعية
        </div>
      )}
      <p className="mt-3">شاكرين ومقدرين حسن تعاونكم.</p>
    </HrPaper>
  );
}

// ---------- 2) تعريف راتب إنجليزي ----------
export function SalaryLetterEn({ e }: { e: EmployeeDoc }) {
  return (
    <HrPaper title="Salary Verification Letter" subtitle={e.toLine || 'To: Concerned'}>
      <div dir="ltr" className="text-left">
        <p className="font-bold">Name: {e.nameEn || e.name} &nbsp;&nbsp; Employee ID: {e.employeeCode}</p>
        <p className="font-bold">Nationality: {e.nationality || 'Saudi'} &nbsp;&nbsp; ID Number: {e.idNumber}</p>
        <p className="font-bold">Expire Date: {d(e.expiryDate)}</p>
        <table className="my-4 w-full border-collapse text-center text-xs">
          <thead>
            <tr className="bg-navy-900 text-gold-400">
              <th className="border border-slate-300 px-2 py-2">Total Salary</th>
              <th className="border border-slate-300 px-2 py-2">Transfer Allowance</th>
              <th className="border border-slate-300 px-2 py-2">Housing Allowance</th>
              <th className="border border-slate-300 px-2 py-2">Basic Salary</th>
            </tr>
          </thead>
          <tbody>
            <tr className="font-bold text-navy-900">
              <td className="border border-slate-300 px-2 py-2">{num(e.totalSalary)}</td>
              <td className="border border-slate-300 px-2 py-2">{num(e.transferAllowance)}</td>
              <td className="border border-slate-300 px-2 py-2">{num(e.housingAllowance)}</td>
              <td className="border border-slate-300 px-2 py-2">{num(e.basicSalary)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2">
          We Seyaj Company certifies that the employee whose details are shown above is one of our teamwork staff and still
          working with us and we provided him this certificate upon his request without any responsibility of our Company.
        </p>
      </div>
    </HrPaper>
  );
}

// ---------- 3) تعريف راتب مفصل بجدول ----------
export function SalaryLetterDetailed({ e }: { e: EmployeeDoc }) {
  return (
    <HrPaper title="خطاب تعريف راتب (مفصل)">
      <p className="mb-2 font-bold text-navy-900">معلومات الموظف</p>
      <table className="w-full border-collapse text-center text-xs">
        <tbody>
          <tr>
            <td className="border border-slate-300 bg-slate-50 px-2 py-2 font-bold">الاسم</td>
            <td className="border border-slate-300 px-2 py-2">{e.name}</td>
            <td className="border border-slate-300 bg-slate-50 px-2 py-2 font-bold">الرقم الوظيفي</td>
            <td className="border border-slate-300 px-2 py-2">{e.employeeCode}</td>
          </tr>
          <tr>
            <td className="border border-slate-300 bg-slate-50 px-2 py-2 font-bold">رقم الهوية</td>
            <td className="border border-slate-300 px-2 py-2">{e.idNumber}</td>
            <td className="border border-slate-300 bg-slate-50 px-2 py-2 font-bold">الوظيفة</td>
            <td className="border border-slate-300 px-2 py-2">{e.job}</td>
          </tr>
          <tr>
            <td className="border border-slate-300 bg-slate-50 px-2 py-2 font-bold">تاريخ الانتهاء</td>
            <td className="border border-slate-300 px-2 py-2">{d(e.expiryDate)}</td>
            <td className="border border-slate-300 bg-slate-50 px-2 py-2 font-bold">تاريخ التعيين</td>
            <td className="border border-slate-300 px-2 py-2">{d(e.hireDate)}</td>
          </tr>
          <tr>
            <td className="border border-slate-300 bg-slate-50 px-2 py-2 font-bold">الجنسية</td>
            <td className="border border-slate-300 px-2 py-2">{e.nationality}</td>
            <td className="border border-slate-300 bg-slate-50 px-2 py-2 font-bold">المشروع</td>
            <td className="border border-slate-300 px-2 py-2">{e.project}</td>
          </tr>
          <tr>
            <td className="border border-slate-300 bg-slate-50 px-2 py-2 font-bold">المنطقة</td>
            <td className="border border-slate-300 px-2 py-2" colSpan={3}>{e.zone}</td>
          </tr>
        </tbody>
      </table>
      <SalaryTable e={e} />
      <p className="mt-2">
        السلام عليكم ورحمة الله وبركاته، بهذا تشهد شركة سياج للحراسات الأمنية المدنية الخاصة رقم موحد {COMPANY_CR} بأن الموظف
        الموضح بياناته أعلاه يعمل لديها ولا يزال على رأس العمل حتى تاريخه، وبناء على طلبه تم منحه هذا الخطاب لتقديمه إليكم
        وذلك دون أدنى مسؤولية على الشركة سواء كانت مادية أو معنوية. شاكرين ومقدرين حسن تعاونكم.
      </p>
    </HrPaper>
  );
}

// ---------- 4) شهادة خبرة (خدمة وإخلاء طرف) ----------
export function ExperienceCertificate({ e }: { e: EmployeeDoc }) {
  return (
    <HrPaper title="شهادة خدمة وإخلاء طرف">
      <p className="text-left text-xs text-slate-500">التاريخ: {d(e.endDate)}</p>
      <p className="mt-3">
        بهذا تشهد شركة / سياج للحراسات الأمنية المدنية الخاصة بأن السيد / <b>{e.name}</b> الجنسية / <b>{e.nationality || 'سعودي'}</b>
        كان يعمل لدينا وفق البيانات التالية ذكرها:
      </p>
      <div className="my-4 rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
        <InfoRow k="الوظيفة الأخيرة التي شغلها بالشركة" v={e.job} />
        <InfoRow k="المشروع" v={e.project} />
        <InfoRow k="رقم بطاقة الأحوال المدنية" v={e.idNumber} />
        <InfoRow k="تاريخ بداية الخدمة في الشركة" v={d(e.hireDate)} />
        <InfoRow k="تاريخ نهاية الخدمة في الشركة" v={d(e.endDate)} />
        <InfoRow k="مجموع الراتب الشهري الأخير في الشركة" v={num(e.totalSalary)} />
        <InfoRow k="أسباب ترك الخدمة في الشركة" v={e.reason || 'إنهاء العقد باتفاق الطرفين'} />
      </div>
      <p>وقد حررت له هذه الشهادة بناءً على طلبه، وبموجب المادة (64) من نظام العمل في المملكة العربية السعودية.</p>
    </HrPaper>
  );
}

// ---------- 5) مخالصة نهائية ----------
export function FinalSettlement({ e }: { e: EmployeeDoc }) {
  const s = e.settlement;
  return (
    <HrPaper
      title="مخالصة نهائية"
      signatories={[
        { label: 'الموظف', name: e.name, sign: true, fingerprint: true },
        { label: HR_SIGNATORY.title, name: HR_SIGNATORY.name, sign: true, stamp: true },
      ]}
    >
      <p className="leading-8">
        أقر أنا الموقع أدناه بأنه اعتباراً من تاريخ: <b>{d(e.endDate)}</b> قد وصلني جميع الأموال والمبالغ المستحقة لي وكافة
        حقوقي على مختلف أنواعها الناتجة عن عقد عملي وحتى إنهاء فترة خدمتي، سواء كان مصدرها الرواتب الأساسية أو الإضافية أو
        البدلات النقدية أو العينية أو ساعات العمل الإضافية أو الإجازات السنوية أو مدة الإنذار أو التعويض أو أي مصدر آخر
        عادي أو استثنائي.
      </p>
      {s && (
        <table className="my-4 w-full border-collapse text-center text-xs">
          <thead>
            <tr className="bg-navy-900 text-gold-400">
              <th className="border border-slate-300 px-2 py-2">بدل الإجازات المتبقية</th>
              <th className="border border-slate-300 px-2 py-2">أجر آخر شهر</th>
              <th className="border border-slate-300 px-2 py-2">خصم أيام بدون راتب</th>
              <th className="border border-slate-300 px-2 py-2">صافي المستحق</th>
            </tr>
          </thead>
          <tbody>
            <tr className="font-bold text-navy-900">
              <td className="border border-slate-300 px-2 py-2">{num(s.leaveValue)}</td>
              <td className="border border-slate-300 px-2 py-2">{num(s.lastMonth)}</td>
              <td className="border border-slate-300 px-2 py-2">{num(s.unpaid)}</td>
              <td className="border border-slate-300 bg-gold-500/10 px-2 py-2">{num(s.total)} SAR</td>
            </tr>
          </tbody>
        </table>
      )}
      <p className="mt-3">
        وتبعاً لذلك فإنني أبرئ ذمة شركة سياج للحراسات الأمنية إبراءً شاملاً عاماً لا رجوع منه مطلقاً لأي حق أو مطالبة حالية
        أو مستقبلية ومن أي نوع أو شكل كان.
      </p>
      <p className="mt-4 font-bold">اسم الموظف / {e.name}</p>
      <p className="font-bold">التاريخ: {d(e.endDate)}</p>
    </HrPaper>
  );
}

// ---------- 6) خطاب استقالة ----------
export function ResignationLetter({ e }: { e: EmployeeDoc }) {
  return (
    <HrPaper
      title="طلب استقالة"
      signatories={[
        { label: 'الموظف', name: e.name, sign: true },
        { label: HR_SIGNATORY.title, name: HR_SIGNATORY.name, sign: true, stamp: true },
      ]}
    >
      <p className="leading-8">
        أنا الموقع أدناه / <b>{e.name}</b> — الرقم الوظيفي <b>{e.employeeCode}</b> — المسمى الوظيفي <b>{e.job}</b> —
        أتقدم بطلب استقالتي من شركة سياج للحراسات الأمنية المدنية الخاصة، وذلك اعتباراً من تاريخ <b>{d(e.endDate)}</b>،
        وأتعهد باستكمال فترة الإشعار النظامية وتسليم ما بعهدتي.
      </p>
      <p className="mt-3 font-bold">سبب الاستقالة: {e.reason || 'ظروف شخصية'}</p>
      <p className="mt-2">
        وأقر بأن جميع حقوقي ومطالباتي لدى الشركة قد سويت أو سيتم تسويتها عبر المخالصة النهائية المعتمدة.
      </p>
    </HrPaper>
  );
}

// ---------- 7) إنذار كتابي (غياب متتالٍ) ----------
export function WarningLetter({ e }: { e: EmployeeDoc }) {
  return (
    <HrPaper
      title="إنذار كتابي ما قبل الفصل"
      signatories={[
        { label: 'الموظف (استلام)', name: e.name, sign: true },
        { label: HR_SIGNATORY.title, name: HR_SIGNATORY.name, sign: true, stamp: true },
      ]}
    >
      <p className="text-left text-xs text-slate-500">الموافق: {d(e.docDate)}</p>
      <p className="mt-2 font-bold text-navy-900">المخالفة: الانقطاع عن العمل دون سبب مشروع لمدة {e.absenceDays || 10} أيام متصلة.</p>
      <div className="my-3 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
        <InfoRow k="اسم الموظف" v={e.name} />
        <InfoRow k="الرقم الوظيفي" v={e.employeeCode} />
        <InfoRow k="المسمى الوظيفي" v={e.job} />
        <InfoRow k="الإدارة / القسم" v={e.department || e.project} />
      </div>
      <p className="leading-8">
        بناءً على انقطاعكم عن العمل دون سبب مشروع لمدة {e.absenceDays || 10} أيام متصلة خلال سنة عقدية واحدة، وحيث إنه تم
        انقطاعكم عن العمل من تاريخ <b>{d(e.absenceFrom)}</b> وحتى تاريخ <b>{d(e.absenceTo)}</b>.
      </p>
      <p className="mt-2 leading-8">
        وفي حال استمراركم في الانقطاع عن العمل لمدة خمسة عشر يوماً فسوف يتم فصلكم من الخدمة بناءً على المادة الثمانون من
        نظام العمل السعودي الفقرة السابعة.
      </p>
      <p className="mt-2 text-xs text-slate-600">
        (الرجاء التوقيع على الخطاب وإعادة إرساله لنا مرة أخرى، وإلا يعتبر ذلك إقراراً صريحاً منكم على كل ما تضمنه الخطاب)
      </p>
    </HrPaper>
  );
}

// ---------- 8) إنهاء خدمات ----------
export function TerminationLetter({ e }: { e: EmployeeDoc }) {
  return (
    <HrPaper
      title="إنهاء عقد"
      signatories={[{ label: HR_SIGNATORY.title, name: HR_SIGNATORY.name, sign: true, stamp: true }]}
    >
      <p className="text-left text-xs text-slate-500">الموافق: {d(e.docDate)}</p>
      <p className="mt-3 font-bold">السيد / {e.name} &nbsp;&nbsp; المحترم</p>
      <p className="mt-2">السلام عليكم ورحمة الله وبركاته،،، وبعد:</p>
      <p className="mt-2 font-bold text-navy-900">الموضوع: إنهاء عقد</p>
      <p className="mt-2 leading-8">
        إشارة إلى الموضوع أعلاه، إنهاء عقدكم بشركة سياج للحراسات الأمنية المدنية الخاصة، يؤسفنا إبلاغكم (إنهاء خدماتكم)
        اعتباراً من تاريخ: <b>{d(e.endDate)}</b> وذلك حسب المادة (80) من نظام العمل.
      </p>
      <p className="mt-3">وتقبلوا فائق الاحترام والتقدير.</p>
    </HrPaper>
  );
}

// ---------- 9) خطاب بنكي ----------
export function BankLetter({ e }: { e: EmployeeDoc }) {
  return (
    <HrPaper
      title="خطاب بنكي"
      signatories={[{ label: HR_SIGNATORY.title, name: HR_SIGNATORY.name, sign: true, stamp: true }]}
    >
      <p className="text-left text-xs text-slate-500">التاريخ: {d(e.docDate)}</p>
      <p className="mt-3 font-bold">سعادة مدير فرع بنك / {e.bankName || '....................'} المحترم</p>
      <p className="mt-2">السلام عليكم ورحمة الله وبركاته،،، وبعد:</p>
      <p className="mt-2 leading-8">
        نرجو التكرم بتحويل مبلغ وقدره <b>{num(e.amount)} ريال سعودي</b> إلى حساب الموظف/ <b>{e.name}</b> رقم الهوية
        <b> {e.idNumber}</b> رقم الحساب <b>{e.accountNumber || '....................'}</b> لدى سعادتكم، وذلك عن مستحقاته
        النظامية المعتمدة لدينا.
      </p>
      <div className="my-3 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
        <InfoRow k="اسم الموظف" v={e.name} />
        <InfoRow k="رقم الهوية" v={e.idNumber} />
        <InfoRow k="البنك" v={e.bankName} />
        <InfoRow k="رقم الحساب / الآيبان" v={e.iban || e.accountNumber} />
        <InfoRow k="المبلغ" v={`${num(e.amount)} ${e.currency || 'SAR'}`} />
      </div>
      <p className="mt-2">شاكرين ومقدرين حسن تعاونكم.</p>
    </HrPaper>
  );
}

export const HR_PAPERS: Record<string, { label: string; Comp: (p: { e: EmployeeDoc }) => any }> = {
  'تعريف راتب (عربي)': { label: 'تعريف راتب عربي', Comp: SalaryLetterAr },
  'تعريف راتب (إنجليزي)': { label: 'تعريف راتب إنجليزي', Comp: SalaryLetterEn },
  'تعريف راتب مصدق': { label: 'تعريف راتب مصدق', Comp: (p) => <SalaryLetterAr e={{ ...p.e, verified: true }} /> },
  'تعريف راتب مفصل': { label: 'تعريف راتب مفصل', Comp: SalaryLetterDetailed },
  'شهادة خبرة': { label: 'شهادة خبرة', Comp: ExperienceCertificate },
  'مخالصة نهائية': { label: 'مخالصة نهائية', Comp: FinalSettlement },
  'استقالة': { label: 'خطاب استقالة', Comp: ResignationLetter },
  'إنذار كتابي': { label: 'إنذار كتابي', Comp: WarningLetter },
  'إنهاء خدمات': { label: 'إنهاء خدمات', Comp: TerminationLetter },
  'خطاب بنكي': { label: 'خطاب بنكي', Comp: BankLetter },
};

// ============================================================
// نموذج تحرير الخطاب قبل الإصدار — يعرض كل الحقول المُعبّأة
// تلقائياً من بيانات الموظف ويسمح بتعديلها، بدون زر طباعة داخله.
// ============================================================
import { Field, TextInput } from '@/components/ui-kit';

const numVal = (v: any) => (v === undefined || v === null ? '' : String(v));

export function DocEditForm({ value, onChange }: { value: EmployeeDoc; onChange: (v: EmployeeDoc) => void }) {
  const set = (k: keyof EmployeeDoc, v: any) => {
    const next: any = { ...value, [k]: v };
    if (['basicSalary', 'housingAllowance', 'transferAllowance', 'otherAllowance'].includes(String(k))) {
      next.totalSalary = (Number(next.basicSalary) || 0) + (Number(next.housingAllowance) || 0)
        + (Number(next.transferAllowance) || 0) + (Number(next.otherAllowance) || 0);
    }
    onChange(next);
  };
  const T = (k: keyof EmployeeDoc, label: string, type = 'text') => (
    <Field label={label}>
      <TextInput type={type} value={type === 'number' ? numVal(value[k]) : String((value as any)[k] ?? '')}
        onChange={(e: any) => set(k, type === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value)} />
    </Field>
  );
  return (
    <div className="no-print rounded-xl border bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-extrabold text-navy-900">تعبئة الخطاب — عدّل البيانات قبل الإصدار</div>
        {!value.idNumber && (
          <span className="rounded bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600 ring-1 ring-rose-200">أدخل رقم الهوية/الإقامة الصحيح</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-3">
        {T('name', 'اسم الموظف')}
        {T('nameEn', 'الاسم بالإنجليزي')}
        {T('employeeCode', 'الرقم الوظيفي')}
        {T('idNumber', 'رقم الهوية/الإقامة')}
        {T('nationality', 'الجنسية')}
        {T('job', 'المسمى الوظيفي')}
        {T('project', 'المشروع')}
        {T('zone', 'المنطقة')}
        {T('site', 'الموقع')}
        {T('department', 'الإدارة/القسم')}
        {T('hireDate', 'تاريخ التعيين', 'date')}
        {T('endDate', 'تاريخ الانتهاء', 'date')}
        {T('expiryDate', 'انتهاء الهوية/الإقامة', 'date')}
        {T('basicSalary', 'الراتب الأساسي', 'number')}
        {T('housingAllowance', 'بدل السكن', 'number')}
        {T('transferAllowance', 'بدل النقل', 'number')}
        {T('otherAllowance', 'بدلات أخرى', 'number')}
        {T('totalSalary', 'إجمالي الراتب', 'number')}
        {T('bankName', 'البنك')}
        {T('accountNumber', 'رقم الحساب')}
        {T('iban', 'الآيبان')}
        {T('currency', 'العملة')}
        {T('amount', 'المبلغ (بنكي/تحويل)', 'number')}
        {T('docDate', 'تاريخ المستند', 'date')}
        {T('reason', 'السبب')}
        {T('toLine', 'موجّه إلى')}
        {T('absenceFrom', 'الانقطاع من', 'date')}
        {T('absenceTo', 'الانقطاع إلى', 'date')}
        {T('absenceDays', 'عدد أيام الانقطاع', 'number')}
      </div>
    </div>
  );
}