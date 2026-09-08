import { Users, Fingerprint, Briefcase, MapPin, AlertTriangle, TrendingUp, Clock, ShieldAlert } from 'lucide-react';
import { useStore } from '@/lib/store';
import { StatCard, StatusBadge, PageToolbar, Btn } from '@/components/ui-kit';
import { Link } from 'react-router-dom';
import { TODAY } from '@/data/mock';

const sevTone: any = {
  critical: 'bg-rose-50 border-rose-200 text-rose-700',
  warning: 'bg-amber-50 border-amber-200 text-amber-700',
  info: 'bg-sky-50 border-sky-200 text-sky-700',
};
const sevIcon: any = { critical: ShieldAlert, warning: AlertTriangle, info: Clock };

export default function Dashboard() {
  const { employees, attendance, projects, sites, alerts, zones } = useStore();
  const today = attendance.filter((a: any) => a.date === TODAY);
  const present = today.filter((a: any) => a.status === 'حاضر' || a.status === 'منصرف').length;
  const late = today.filter((a: any) => a.status === 'متأخر').length;
  const absent = today.filter((a: any) => a.status === 'غائب').length;
  const activeProjects = projects.filter((p: any) => p.status === 'نشط').length;
  const activeSites = sites.filter((s: any) => s.status === 'تشغيل').length;
  const byProject = projects.map((p: any) => ({
    name: p.name,
    count: employees.filter((e: any) => e.projectId === p.id).length,
  }));
  const maxCount = Math.max(1, ...byProject.map((b: any) => b.count));

  return (
    <div className="space-y-6">
      <PageToolbar
        title="لوحة التحكم التنفيذية"
        subtitle="نظرة شاملة على عمليات الأمن والحضور والمشاريع اليوم"
        actions={
          <Link to="/attendance">
            <Btn variant="gold">
              <Fingerprint className="h-4 w-4" /> سجل الحضور اليومي
            </Btn>
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="إجمالي الموظفين" value={employees.length} hint={zones.length + ' مناطق جغرافية'} icon={<Users className="h-5 w-5" />} tone="navy" />
        <StatCard title="الحاضرون اليوم" value={present} hint={late + ' متأخر — ' + absent + ' غائب'} icon={<Fingerprint className="h-5 w-5" />} tone="success" />
        <StatCard title="المشاريع النشطة" value={activeProjects} hint={projects.length + ' مشروع إجمالي'} icon={<Briefcase className="h-5 w-5" />} tone="gold" />
        <StatCard title="المواقع العاملة" value={activeSites} hint={sites.length + ' موقع في الشبكة'} icon={<MapPin className="h-5 w-5" />} tone="info" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-cairo text-base font-bold">توزيع القوى العاملة على المشاريع</h3>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            {byProject.map((b: any) => (
              <div key={b.name}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-semibold">{b.name}</span>
                  <span className="num text-muted-foreground">{b.count} موظف</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-gradient-to-l from-gold-400 to-navy-700" style={{ width: (b.count / maxCount) * 100 + '%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="mb-4 font-cairo text-base font-bold">التنبيهات الأمنية ({alerts.length})</h3>
          <div className="space-y-2.5">
            {alerts.map((a: any) => {
              const Icon = sevIcon[a.severity] || AlertTriangle;
              return (
                <div key={a.id} className={'rounded-lg border p-3 ' + sevTone[a.severity]}>
                  <div className="flex items-start gap-2">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <div className="text-xs font-bold">{a.title}</div>
                      <div className="mt-0.5 text-[11px] leading-relaxed opacity-90">{a.message}</div>
                      <div className="mt-1 text-[10px] opacity-70">{a.time}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h3 className="font-cairo text-base font-bold">آخر تسجيلات الحضور</h3>
          <Link to="/attendance" className="text-xs font-semibold text-navy-700 hover:underline">عرض الكل</Link>
        </div>
        <div className="divide-y">
          {today.slice(0, 6).map((a: any) => {
            const emp = employees.find((e: any) => e.id === a.employeeId);
            const site = sites.find((s: any) => s.id === a.siteId);
            return (
              <div key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-900 text-xs font-bold text-gold-400">
                    {emp ? emp.name.slice(0, 1) : '؟'}
                  </div>
                  <div>
                    <div className="text-sm font-bold">{emp ? emp.name : 'غير معروف'}</div>
                    <div className="text-[11px] text-muted-foreground">{a.location} — {site ? site.code : ''}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="num text-xs text-muted-foreground">{a.checkIn ? 'دخول ' + a.checkIn : '—'}</span>
                  <StatusBadge value={a.status} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
