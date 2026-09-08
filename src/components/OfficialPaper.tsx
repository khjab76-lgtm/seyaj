import { Printer } from 'lucide-react';
import { Btn } from '@/components/ui-kit';

const LOGO = '/assets/logo-seyaj.png';

// غلاف «ورق رسمي» قابل للطباعة/PDF بهوية سياج — يُستخدم في كل التقارير والمخرجات الرسمية.
export default function OfficialPaper({ title, subtitle, meta, children, actions, landscape, footer }: any) {
  return (
    <div>
      {landscape && <style dangerouslySetInnerHTML={{ __html: '@media print { @page { size: A4 landscape; margin: 8mm; } }' }} />}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 no-print">
        <div className="text-sm text-muted-foreground">معاينة الورق الرسمي — جاهز للطباعة أو الحفظ PDF</div>
        <div className="flex items-center gap-2">
          {actions}
          <Btn variant="gold" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> طباعة / PDF
          </Btn>
        </div>
      </div>

      <div className={'seyaj-print-area mx-auto bg-white p-6 text-slate-900 shadow-xl ring-1 ring-slate-200 ' + (landscape ? 'max-w-[1200px]' : 'max-w-[820px]')}>
        {/* ترويسة رسمية */}
        <div className="flex items-center justify-between gap-4 border-b-2 border-navy-900 pb-4">
          <div className="text-right">
            <div className="font-cairo text-xl font-extrabold text-navy-900">شركة سياج للحراسات الأمنية الخاصة</div>
            <div className="text-[11px] font-semibold tracking-wide text-slate-500">SEYAJ COMPANY FOR SECURITY GUARDS</div>
            <div className="mt-1 text-[10px] text-slate-400">المملكة العربية السعودية</div>
          </div>
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-white p-1 ring-1 ring-slate-200">
            <img src={LOGO} alt="شعار سياج" className="h-full w-full object-contain" />
          </div>
          <div className="text-left">
            <div className="text-[10px] text-slate-500">رقم الوثيقة</div>
            <div className="font-mono text-xs font-bold text-navy-900">SYJ-{new Date().getFullYear()}-{String(Math.floor(Math.random() * 9000) + 1000)}</div>
            <div className="mt-1 text-[10px] text-slate-500">التاريخ: {new Date().toLocaleDateString('ar-EG-u-nu-latn')}</div>
          </div>
        </div>

        {/* عنوان التقرير */}
        <div className="my-4 text-center">
          <h2 className="font-cairo text-lg font-extrabold text-navy-900">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>

        {/* بيانات وصفية */}
        {meta && (
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-xs ring-1 ring-slate-200 sm:grid-cols-4">
            {meta.map((m: any, i: number) => (
              <div key={i}>
                <div className="text-slate-400">{m.k}</div>
                <div className="font-bold text-navy-900">{m.v}</div>
              </div>
            ))}
          </div>
        )}

        <div className="overflow-x-auto">{children}</div>

        {/* خانات التواقيع الرسمية */}
        <div className="mt-10 grid grid-cols-3 gap-6 border-t border-dashed border-slate-300 pt-6 text-center text-xs">
          {['مُعد التقرير', 'مدير العمليات', 'المدير العام'].map((s) => (
            <div key={s}>
              <div className="font-bold text-navy-900">{s}</div>
              <div className="mt-8 border-t border-slate-400 pt-1 text-slate-500">الاسم والتوقيع</div>
              <div className="mt-1 text-[10px] text-slate-400">الختم</div>
            </div>
          ))}
        </div>
        {/* التذييل الرسمي القابل للإعداد */}
        {footer && Object.values(footer).some((v: any) => v) && (
          <div className="mt-4 border-t-2 border-navy-900 pt-2 text-[9px] leading-relaxed text-slate-500">
            <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 sm:grid-cols-3">
              {Object.entries(footer).filter(([, v]) => v).map(([k, v]) => (
                <div key={k}><span className="font-bold text-navy-900">{k}: </span>{String(v)}</div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-2 text-[9px] text-slate-400">
          <span>وثيقة صادرة من نظام «سياج» الإلكتروني — هذه النسخة معتمدة إلكترونياً</span>
          <span>www.seyaj.sa</span>
        </div>
      </div>
    </div>
  );
}