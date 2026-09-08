import { useState } from 'react';
import { X, Pencil, Trash2 } from 'lucide-react';

export function StatCard({ title, value, hint, icon, tone = 'navy' }: any) {
  const tones: any = {
    navy: 'from-navy-900 to-navy-700 text-gold-400',
    gold: 'from-gold-500 to-gold-600 text-navy-950',
    success: 'from-emerald-600 to-emerald-500 text-white',
    warning: 'from-amber-500 to-amber-600 text-white',
    danger: 'from-rose-600 to-rose-500 text-white',
    info: 'from-sky-600 to-sky-500 text-white',
  };
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-muted-foreground">{title}</div>
          <div className="mt-1 font-cairo text-2xl font-extrabold num">{value}</div>
          {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
        </div>
        <div className={'flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br ' + tones[tone]}>
          {icon}
        </div>
      </div>
    </div>
  );
}

const MAP: any = {
  'نشط': 'success', 'تشغيل': 'success', 'حاضر': 'success', 'معتمد': 'success', 'مكتمل': 'info',
  'معلق': 'warning', 'متأخر': 'warning', 'صيانة': 'warning', 'إجازة': 'info',
  'غائب': 'danger', 'مرفوض': 'danger', 'موقوف': 'danger', 'متوقف': 'danger',
  'غير مطابق': 'danger', 'مطابق': 'success', 'منصرف': 'info', 'غير مفعّل': 'warning', 'مفعّل': 'success',
};

export function Modal({ open, onClose, title, children, wide }: any) {
  if (!open) return null;
  return (
    <div className="seyaj-modal fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className={'relative w-full rounded-2xl border bg-card shadow-2xl ' + (wide ? 'max-w-2xl' : 'max-w-lg')}>
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="font-cairo text-base font-bold">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }: any) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const inputCls = 'h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring';

export function TextInput(props: any) {
  return <input className={inputCls} {...props} />;
}
export const Input = TextInput;

export function TextArea(props: any) {
  return <textarea className={'min-h-20 w-full rounded-lg border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring ' + (props.className || '')} {...props} />;
}

export function Select({ options, ...props }: any) {
  return (
    <select className={inputCls} {...props}>
      {options.map((o: any) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function Btn({ children, variant = 'primary', size = 'md', className = '', ...props }: any) {
  const base = 'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors disabled:opacity-50';
  const sizes: any = { sm: 'h-8 px-2.5 text-xs', md: 'h-9 px-4 text-sm' };
  const variants: any = {
    primary: 'bg-navy-900 text-gold-400 hover:bg-navy-800',
    gold: 'bg-gold-500 text-navy-950 hover:bg-gold-400',
    outline: 'border bg-card text-foreground hover:bg-muted',
    ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
    danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    success: 'bg-emerald-600 text-white hover:bg-emerald-500',
  };
  return (
    <button className={base + ' ' + sizes[size] + ' ' + variants[variant] + ' ' + className} {...props}>
      {children}
    </button>
  );
}

export function RowActions({ onEdit, onDelete }: any) {
  return (
    <div className="flex items-center gap-1">
      <button onClick={onEdit} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="تعديل">
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button onClick={onDelete} className="rounded-md p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-600" title="حذف">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function PageToolbar({ title, subtitle, actions }: any) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="font-cairo text-xl font-bold">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}

export function EmptyRow({ colSpan, text = 'لا توجد بيانات مطابقة' }: any) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-10 text-center text-sm text-muted-foreground">{text}</td>
    </tr>
  );
}

export function Table({ head, children }: any) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            {head.map((h: string) => (
              <th key={h} className="whitespace-nowrap px-4 py-3 text-right text-xs font-bold text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
    </div>
  );
}

export function useToast() {
  const [msg, setMsg] = useState('');
  const show = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(''), 2600);
  };
  const node = msg ? (
    <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-navy-950 px-4 py-2.5 text-sm font-semibold text-gold-400 shadow-xl">
      {msg}
    </div>
  ) : null;
  return { show, node };
}

export function StatusBadge({ value }: any) {
  const tone = MAP[value] || 'muted';
  const cls: any = {
    success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    warning: 'bg-amber-50 text-amber-700 ring-amber-200',
    danger: 'bg-rose-50 text-rose-700 ring-rose-200',
    info: 'bg-sky-50 text-sky-700 ring-sky-200',
    muted: 'bg-muted text-muted-foreground ring-border',
  };
  return <span className={'inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ' + cls[tone]}>{value}</span>;
}