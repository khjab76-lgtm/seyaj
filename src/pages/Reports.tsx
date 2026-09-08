import { useState } from 'react';
import { Download, Printer, BarChart3, Users, CalendarCheck, AlertTriangle } from 'lucide-react';
import { useStore } from '@/lib/store';
import { PageToolbar, Btn, StatCard, Table, EmptyRow, useToast } from '@/components/ui-kit';
import { TODAY } from '@/data/mock';

export default function Reports() {
  const { employees, attendance, projects, sites, requests, alerts, exportCSV } = useStore();
  const toast = useToast();
  const [range, setRange] = useState('today');

  const today = attendance.filter((a: any) => a.date === TODAY);
  const present = today.filter((a: any) => a.status === 'حاضر' || a.status === 'منصرف').length;
  const late = today.filter((a: any) => a.status === 'متأخر').length;
  const absent = today.filter((a: any) => a.status === 'غائب').length;
  const rate = today.length ? Math.round((present / today.length) * 100) : 0;

  const byProject = projects.map((p: any) => {
    const emp = employees.filter((e: any) => e.projectId === p.id);
    const ids = emp.map((e: any) => e.id);
    const att = today.filter((a: any) => ids.includes(a.employeeId));
    return {
      name: p.name,
      code: p.code,
      staff: emp.length,
      present: att.filter((a: any) => a.status === 'حاضر' || a.status === 'منصرف').length,
      late: att.filter((a: any) => a.status === 'متأخر').length,
      absent: att.filter((a: any) => a.status === 'غائب').length,
    };
  });
  const maxStaff = Math.max(1, ...byProject.map((b: any) => b.staff));

  const bySite = sites.map((s: any) => ({
    name: s.name,
    code: s.code,
    count: employees.filter((e: any) => e.siteId === s.id).length,
  }));

  const reqSummary = ['معلق', 'معتمد', 'مرفوض'].map((st) => ({
    status: st,
    count: requests.filter((r: any) => r.status === st).length,
  }));

  const exportReport = () => {
    exportCSV('report_projects.csv', byProject.map((r: any) => ({ المشروع: r.name, الكود: r.code, الطاقم: r.staff, حاضرون: r.present, متأخرون: r.late, غائبون: r.absent })));
    toast.show('تم تصدير تقرير المشاريع');
  };

  return (
    <div>
      <PageToolbar
        title="التقارير والإحصاءات"
        subtitle="مؤشرات الأداء التشغيلية على مستوى المشاريع والمواقع"
        actions={
          <>
            <select value={range} onChange={(e: any) => setRange(e.target.value)} className="h-9 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
              <option value="today">اليوم</option>
              <option value="week">الأسبوع الحالي</option>
              <option value="month">الشهر الحالي</option>
            </select>
            <Btn variant="outline" onClick={exportReport}><Download className="h-4 w-4" /> تصدير التقرير</Btn>
            <Btn variant="primary" onClick={() => window.print()}><Printer className="h-4 w-4" /> طباعة</Btn>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="نسبة الحضور" value={rate + '%'} hint={'من أصل ' + today.length + ' سجل اليوم'} icon={<CalendarCheck className="h-5 w-5" />} tone="success" />
        <StatCard title="حالات تأخر" value={late} hint="تجاوز وقت البصمة" icon={<AlertTriangle className="h-5 w-5" />} tone="warning" />
        <StatCard title="حالات غياب" value={absent} hint="بدون بصمة" icon={<Users className="h-5 w-5" />} tone="danger" />
        <StatCard title="طلبات معلقة" value={requests.filter((r: any) => r.status === 'معلق').length} hint="بانتظار الاعتماد" icon={<BarChart3 className="h-5 w-5" />} tone="info" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="mb-4 font-cairo text-sm font-bold">التوزيع على المشاريع</h3>
          <div className="space-y-3">
            {byProject.map((b: any) => (
              <div key={b.code}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-semibold">{b.name}</span>
                  <span className="num text-muted-foreground">{b.staff} موظف</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-gradient-to-l from-navy-900 to-navy-700" style={{ width: Math.round((b.staff / maxStaff) * 100) + '%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="mb-4 font-cairo text-sm font-bold">طلبات الاعتماد حسب الحالة</h3>
          <div className="space-y-3">
            {reqSummary.map((r: any) => (
              <div key={r.status} className="flex items-center gap-3">
                <div className="w-16 shrink-0 text-xs font-semibold">{r.status}</div>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className={'h-full rounded-full ' + (r.status === 'معتمد' ? 'bg-emerald-500' : r.status === 'مرفوض' ? 'bg-rose-500' : 'bg-amber-500')} style={{ width: Math.round((r.count / Math.max(1, requests.length)) * 100) + '%' }} />
                </div>
                <div className="num w-6 shrink-0 text-left text-xs font-bold">{r.count}</div>
              </div>
            ))}
          </div>
          <h3 className="mb-3 mt-6 font-cairo text-sm font-bold">التنبيهات النشطة</h3>
          <div className="space-y-2">
            {alerts.slice(0, 4).map((a: any) => (
              <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-xs">
                <span className="font-semibold">{a.title}</span>
                <span className="num shrink-0 text-[10px] text-muted-foreground">{a.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4">
        <h3 className="mb-3 font-cairo text-sm font-bold">التوزيع على المواقع</h3>
        <Table head={['الموقع', 'الكود', 'عدد الموظفين']}>
          {bySite.length === 0 && <EmptyRow colSpan={3} />}
          {bySite.map((s: any) => (
            <tr key={s.code} className="hover:bg-muted/40">
              <td className="px-4 py-3 text-sm font-bold">{s.name}</td>
              <td className="num px-4 py-3 text-xs text-navy-700">{s.code}</td>
              <td className="num px-4 py-3 text-sm font-bold">{s.count}</td>
            </tr>
          ))}
        </Table>
      </div>
      {toast.node}
    </div>
  );
}