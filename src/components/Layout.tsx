import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Fingerprint, Briefcase, MapPin, Map,
  ShieldCheck, Inbox, BarChart3, Bell, Search, Smartphone,
  Route, ArrowLeftRight, ClipboardList, Building2, ClipboardCheck, AlertTriangle, Settings2,
  CalendarDays, Wallet, IdCard, ScrollText, Banknote, UserPlus, FileUp, ReceiptText, Globe,
  Menu, X, Database, ChevronDown, UserCheck, Download, RefreshCw,
} from 'lucide-react';
import { useStore, type SystemUser } from '@/lib/store';

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

interface NavItem {
  to: string;
  label: string;
  icon: any;
  module: string;
}

const NAV: NavItem[] = [
  { to: '/', label: 'لوحة التحكم', icon: LayoutDashboard, module: 'dashboard' },
  { to: '/employees', label: 'الموظفون', icon: Users, module: 'employees' },
  { to: '/attendance', label: 'الحضور والانصراف', icon: Fingerprint, module: 'attendance' },
  { to: '/patrols', label: 'الدوريات والتتبع', icon: Route, module: 'patrols' },
  { to: '/handovers', label: 'الاستلام والتسليم', icon: ArrowLeftRight, module: 'handovers' },
  { to: '/projects', label: 'المشاريع', icon: Briefcase, module: 'projects' },
  { to: '/sites', label: 'المواقع', icon: MapPin, module: 'sites' },
  { to: '/zones', label: 'المناطق', icon: Map, module: 'zones' },
  { to: '/map-center', label: 'الخرائط والحضور', icon: Globe, module: 'sites' },
  { to: '/roles', label: 'الصلاحيات والأدوار', icon: ShieldCheck, module: 'permissions' },
  { to: '/requests', label: 'الطلبات', icon: Inbox, module: 'requests' },
  { to: '/alerts', label: 'التنبيهات الأمنية', icon: Bell, module: 'dashboard' },
  { to: '/audit', label: 'سجل التدقيق (Audit)', icon: ScrollText, module: 'audit' },
  { to: '/reports', label: 'التقارير', icon: BarChart3, module: 'reports' },
  { to: '/smart-reports', label: 'التقارير الذكية والتايم شيت', icon: ClipboardList, module: 'reports' },
  { to: '/sites-capacity', label: 'المواقع والسعات', icon: Building2, module: 'sites' },
  { to: '/field-visits', label: 'الزيارات الميدانية', icon: ClipboardCheck, module: 'visits' },
  { to: '/violations', label: 'المخالفات', icon: AlertTriangle, module: 'violations' },
  { to: '/finance', label: 'الإدارة المالية', icon: Banknote, module: 'finance' },
  { to: '/settings', label: 'البدلات والتأمينات', icon: Settings2, module: 'settings' },
  { to: '/hr/dashboard', label: 'HR: لوحة المتابعة', icon: Users, module: 'employees' },
  { to: '/hr/leaves', label: 'HR: الإجازات والأرصدة', icon: CalendarDays, module: 'requests' },
  { to: '/hr/payroll', label: 'HR: الرواتب والبنوك', icon: Wallet, module: 'finance' },
  { to: '/hr/employees', label: 'HR: ملف الموظف والمستندات', icon: IdCard, module: 'employees' },
  { to: '/hr/audit', label: 'HR: الإنذارات والتدقيق', icon: ScrollText, module: 'audit' },
  { to: '/recruitment', label: 'التوظيف والخطابات', icon: UserPlus, module: 'employees' },
  { to: '/hr/import-employees', label: 'استيراد الموظفين من Excel', icon: FileUp, module: 'employees' },
  { to: '/hr/import-payroll', label: 'استيراد الرواتب من Excel', icon: ReceiptText, module: 'finance' },
];

function NavLinks({ onItemClick }: { onItemClick?: () => void }) {
  const { hasPerm } = useStore();

  const visibleItems = NAV.filter((item) => hasPerm(item.module));

  return (
    <>
      {visibleItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          onClick={onItemClick}
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
        onClick={onItemClick}
        className="mt-3 flex items-center gap-3 rounded-lg border border-gold-500/30 bg-gold-500/10 px-3 py-2.5 text-sm font-bold text-gold-400 transition-colors hover:bg-gold-500/20"
      >
        <Smartphone className="h-4 w-4 shrink-0" />
        تطبيق الموظف
        <span className="mr-auto rounded bg-gold-500/20 px-1.5 py-0.5 text-[9px] font-bold">موبايل</span>
      </a>
    </>
  );
}

function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-l border-white/10 bg-navy-950 lg:flex">
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
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <NavLinks />
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="rounded-lg bg-white/5 p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            قاعدة البيانات نشطة
          </div>
          <div className="mt-1 text-[10px] leading-snug text-white/50">
            سياج للأمن والحراسات الخاصة
          </div>
        </div>
      </div>
    </aside>
  );
}

function Header({ onOpenMobileMenu }: { onOpenMobileMenu: () => void }) {
  const { alerts, currentUser, users, switchUser, exportDatabaseJSON, resetDatabase } = useStore();
  const loc = useLocation();
  const current = NAV.find((n) => (n.to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(n.to)));
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [dbDropdownOpen, setDbDropdownOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
        setDbDropdownOpen(false);
        setAlertOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-card px-4 shadow-sm lg:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 lg:hidden"
          aria-label="فتح القائمة"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Logo
          boxClass="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white p-1 ring-1 ring-border lg:hidden"
          className="h-full w-full object-contain"
        />
        <div>
          <h1 className="font-cairo text-lg font-bold">{current ? current.label : 'سياج'}</h1>
          <p className="hidden text-xs text-muted-foreground sm:block">شركة سياج للحراسات الأمنية الخاصة</p>
        </div>
      </div>

      <div className="flex items-center gap-3" ref={dropdownRef}>
        {/* Quick Search */}
        <div className="relative hidden xl:block">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="بحث سريع..."
            className="h-9 w-48 rounded-lg border bg-background pr-9 pl-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Database Status Button & Backup Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setDbDropdownOpen(!dbDropdownOpen); setUserDropdownOpen(false); setAlertOpen(false); }}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-background px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            title="إدارة قاعدة البيانات والنسخ الاحتياطي"
          >
            <Database className="h-4 w-4 text-emerald-600" />
            <span className="hidden md:inline">قاعدة البيانات</span>
          </button>

          {dbDropdownOpen && (
            <div className="absolute left-0 mt-2 w-64 rounded-xl border bg-card p-3 shadow-xl z-50 text-right">
              <div className="flex items-center gap-2 border-b pb-2 mb-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="font-cairo text-xs font-bold">قاعدة بيانات محلية متصلة</span>
              </div>
              <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
                جميع البيانات محفوظة تلقائياً داخل المتصفح (localStorage) مع نظام التدقيق والحفظ اللحظي.
              </p>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => { exportDatabaseJSON(); setDbDropdownOpen(false); }}
                  className="flex w-full items-center justify-between rounded-lg bg-navy-50 px-2.5 py-2 text-xs font-semibold text-navy-900 hover:bg-navy-100"
                >
                  <span>تصدير نسخة احتياطية JSON</span>
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('هل أنت متأكد من إعادة ضبط قاعدة البيانات للقيم الافتراضية؟')) {
                      resetDatabase();
                      setDbDropdownOpen(false);
                      window.location.reload();
                    }
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                >
                  <span>استعادة البيانات الأولية الافتراضية</span>
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setAlertOpen(!alertOpen); setUserDropdownOpen(false); setDbDropdownOpen(false); }}
            className="relative rounded-lg p-2 text-muted-foreground hover:bg-muted"
            aria-label="التنبيهات"
          >
            <Bell className="h-5 w-5" />
            {alerts.length > 0 && (
              <span className="absolute -left-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground num">
                {alerts.length}
              </span>
            )}
          </button>

          {alertOpen && (
            <div className="absolute left-0 mt-2 w-80 max-w-[90vw] rounded-xl border bg-card p-3 shadow-xl z-50 text-right">
              <div className="font-cairo text-xs font-bold text-slate-900 border-b pb-2 mb-2 flex justify-between items-center">
                <span>التنبيهات العاجلة ({alerts.length})</span>
                <span className="text-[10px] font-normal text-muted-foreground">نشطة الآن</span>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {alerts.slice(0, 5).map((a: any) => (
                  <div key={a.id} className="rounded-lg border p-2 text-xs hover:bg-muted/50 transition">
                    <div className="font-bold text-slate-800">{a.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{a.message}</div>
                    <div className="text-[10px] text-gold-600 mt-1 num">{a.time}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-2 border-t text-center">
                <NavLink
                  to="/alerts"
                  onClick={() => setAlertOpen(false)}
                  className="text-xs font-bold text-primary hover:underline block py-1"
                >
                  فتح مركز التنبيهات والأحداث الأمنية الكامل &larr;
                </NavLink>
              </div>
            </div>
          )}
        </div>

        {/* User Switcher Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setUserDropdownOpen(!userDropdownOpen); setDbDropdownOpen(false); setAlertOpen(false); }}
            className="flex items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5 text-right hover:bg-slate-50 transition"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-navy-900 text-xs font-bold text-gold-400">
              {currentUser?.name?.slice(0, 2) || 'أد'}
            </div>
            <div className="hidden text-right sm:block">
              <div className="text-xs font-bold leading-tight flex items-center gap-1">
                <span>{currentUser?.roleName || 'مدير النظام'}</span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </div>
              <div className="text-[10px] leading-tight text-muted-foreground">{currentUser?.name || 'سلطان العتيبي'}</div>
            </div>
          </button>

          {userDropdownOpen && (
            <div className="absolute left-0 mt-2 w-64 rounded-xl border bg-card p-3 shadow-xl z-50 text-right">
              <div className="border-b pb-2 mb-2">
                <div className="text-xs font-bold text-slate-900">تبديل حساب المستخدم (اختبار الصلاحيات)</div>
                <div className="text-[10px] text-muted-foreground">اختر مستخدم لتجربة صلاحيات كل دور</div>
              </div>
              <div className="space-y-1">
                {users.map((u: SystemUser) => {
                  const isCurrent = u.id === currentUser?.id;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => { switchUser(u); setUserDropdownOpen(false); }}
                      className={
                        'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-right transition ' +
                        (isCurrent ? 'bg-gold-500/15 text-gold-800 font-bold' : 'hover:bg-muted text-slate-700')
                      }
                    >
                      <div>
                        <div className="text-xs">{u.name}</div>
                        <div className="text-[10px] text-muted-foreground">{u.roleName} — {u.jobTitle}</div>
                      </div>
                      {isCurrent && <UserCheck className="h-4 w-4 text-gold-600" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative flex h-full w-72 max-w-[80vw] flex-col border-l border-white/10 bg-navy-950 p-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <Logo
                  boxClass="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-white p-1"
                  className="h-full w-full object-contain"
                />
                <span className="font-cairo font-bold text-white">سياج</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
                aria-label="إغلاق القائمة"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto py-3">
              <NavLinks onItemClick={() => setMobileMenuOpen(false)} />
            </nav>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenMobileMenu={() => setMobileMenuOpen(true)} />
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

