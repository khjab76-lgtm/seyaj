import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Fingerprint, Briefcase, MapPin, Map,
  ShieldCheck, Inbox, BarChart3, Bell, Search, Smartphone,
  Route, ArrowLeftRight, ClipboardList, Building2, ClipboardCheck, AlertTriangle, Settings2,
  CalendarDays, Wallet, IdCard, ScrollText, Banknote, UserPlus, FileUp, ReceiptText, Globe,
} from 'lucide-react';
import { useStore } from '@/lib/store';

const LOGO_SRC = '/assets/logo-seyaj.png';

// شعار آمن: عند فشل تحميل الصورة يظهر بديل نصي بدل أيقونة الصورة المكسورة
function Logo({ className, boxClass }: { className?: string; boxClass?: string }) {
  const [ok, setOk] = useState(true);
  return (
    <div className={boxClass}>
      {ok ? (
        <img src={LOGO_SRC} alt="شعار شركة سياج" className={className} onError={() => setOk(false)} />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-navy-900 font-cairo text-lg font-extrabold text-gold-400">س</div>
      )}
    </div>
  );
}

const NAV = [
  { to: '/', label: 'لوحة التحكم', icon: LayoutDashboard },
  { to: '/employees', label: 'الموظفون', icon: Users },
  { to: '/attendance', label: 'الحضور والانصراف', icon: Fingerprint },
  { to: '/patrols', label: 'الدوريات والتتبع', icon: Route },
  { to: '/handovers', label: 'الاستلام والتسليم', icon: ArrowLeftRight },
  { to: '/projects', label: 'المشاريع', icon: Briefcase },
  { to: '/sites', label: 'المواقع', icon: MapPin },
  { to: '/zones', label: 'المناطق', icon: Map },
  { to: '/map-center', label: 'الخرائط والحضور', icon: Globe },
  { to: '/roles', label: 'الصلاحيات والأدوار', icon: ShieldCheck },
  { to: '/requests', label: 'الطلبات', icon: Inbox },
  { to: '/reports', label: 'التقارير', icon: BarChart3 },
  { to: '/smart-reports', label: 'التقارير الذكية والتايم شيت', icon: ClipboardList },
  { to: '/sites-capacity', label: 'المواقع والسعات', icon: Building2 },
  { to: '/field-visits', label: 'الزيارات الميدانية', icon: ClipboardCheck },
  { to: '/violations', label: 'المخالفات', icon: AlertTriangle },
  { to: '/finance', label: 'الإدارة المالية', icon: Banknote },
  { to: '/settings', label: 'البدلات والتأمينات', icon: Settings2 },
  { to: '/hr/dashboard', label: 'HR: لوحة المتابعة', icon: Users },
  { to: '/hr/leaves', label: 'HR: الإجازات والأرصدة', icon: CalendarDays },
  { to: '/hr/payroll', label: 'HR: الرواتب والبنوك', icon: Wallet },
  { to: '/hr/employees', label: 'HR: ملف الموظف والمستندات', icon: IdCard },
  { to: '/hr/audit', label: 'HR: الإنذارات والتدقيق', icon: ScrollText },
  { to: '/recruitment', label: 'التوظيف والخطابات', icon: UserPlus },
  { to: '/hr/import-employees', label: 'استيراد الموظفين من Excel', icon: FileUp },
  { to: '/hr/import-payroll', label: 'استيراد الرواتب من Excel', icon: ReceiptText },
];

function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-l border-white/10 bg-navy-950 lg:flex">
      <div className="flex h-20 items-center gap-3 border-b border-white/10 px-4">
        <Logo
          boxClass="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white p-1 shadow-lg shadow-black/30 ring-1 ring-gold-500/40"
          className="h-full w-full object-contain"
        />
        <div className="min-w-0">
          <div className="font-cairo text-lg font-extrabold leading-tight text-white">سياج</div>
          <div className="truncate text-[10px] leading-tight text-white/55">شركة سياج للحراسات الأمنية الخاصة</div>
        </div>
      </div>
      <nav className="space-y-1 p-3">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ' +
              (isActive
                ? 'bg-gold-500/15 text-gold-400 ring-1 ring-gold-500/30'
                : 'text-white/65 hover:bg-white/5 hover:text-white')
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </NavLink>
        ))}
        <a
          href="/app"
          className="mt-3 flex items-center gap-3 rounded-lg border border-gold-500/30 bg-gold-500/10 px-3 py-2.5 text-sm font-bold text-gold-400 transition-colors hover:bg-gold-500/20"
        >
          <Smartphone className="h-4 w-4 shrink-0" />
          تطبيق الموظف
          <span className="mr-auto rounded bg-gold-500/20 px-1.5 py-0.5 text-[9px] font-bold">موبايل</span>
        </a>
      </nav>
      <div className="mt-auto border-t border-white/10 p-4">
        <div className="rounded-lg bg-white/5 p-3 text-center">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gold-400">Seyaj</div>
          <div className="mt-0.5 text-[10px] leading-snug text-white/45">شركة سياج للحراسات الأمنية الخاصة</div>
        </div>
      </div>
    </aside>
  );
}

function Header() {
  const { alerts } = useStore();
  const loc = useLocation();
  const current = NAV.find((n) => (n.to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(n.to)));
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-card px-4 shadow-sm lg:px-6">
      <div className="flex items-center gap-3">
        <Logo
          boxClass="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white p-1 ring-1 ring-border lg:hidden"
          className="h-full w-full object-contain"
        />
        <div>
          <h1 className="font-cairo text-lg font-bold">{current ? current.label : 'سياج'}</h1>
          <p className="hidden text-xs text-muted-foreground sm:block">شركة سياج للحراسات الأمنية الخاصة</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="بحث سريع..."
            className="h-9 w-56 rounded-lg border bg-background pr-9 pl-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="relative">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {alerts.length > 0 && (
            <span className="absolute -left-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground num">
              {alerts.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-navy-900 text-xs font-bold text-gold-400">م.س</div>
          <div className="hidden text-right sm:block">
            <div className="text-xs font-bold leading-tight">مدير النظام</div>
            <div className="text-[10px] leading-tight text-muted-foreground">سلطان العتيبي</div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
