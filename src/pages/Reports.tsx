import { useState } from 'react';
import { Download, Printer, BarChart3, Users, CalendarCheck, AlertTriangle, FileText, Eye } from 'lucide-react';
import { useStore } from '@/lib/store';
import { PageToolbar, Btn, StatCard, Table, EmptyRow, Modal, useToast } from '@/components/ui-kit';
import OfficialPaper from '@/components/OfficialPaper';
import { TODAY } from '@/data/mock';

export default function Reports() {
  const { employees, attendance, projects, sites, requests, alerts, exportCSV } = useStore();
  const toast = useToast();
  const [range, setRange] = useState('today');
  const [pdfPreview, setPdfPreview] = useState(false);

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
    exportCSV(
      'report_projects.csv',
      byProject.map((r: any) => ({
        المشروع: r.name,
        الكود: r.code,
        'طاقم الحراسة': r.staff,
        حاضرون: r.present,
        متأخرون: r.late,
        غائبون: r.absent,
        'نسبة التغطية': r.staff ? Math.round((r.present / r.staff) * 100) + '%' : '0%',
      }))
    );
    toast.show('تم تصدير تقرير المشاريع بصيغة CSV / Excel');
  };

  const exportSitesReport = () => {
    exportCSV(
      'report_sites.csv',
      bySite.map((s: any) => ({
        الموقع: s.name,
        الكود: s.code,
        'عدد القوة الأمنية': s.count,
      }))
    );
    toast.show('تم تصدير تقرير توزيع المواقع بصيغة CSV / Excel');
  };

  const reportMeta = [
    { k: 'فترة التقرير', v: range === 'today' ? 'اليوم ' + TODAY : range === 'week' ? 'الأسبوع الحالي' : 'الشهر الحالي' },
    { k: 'إجمالي الموظفين', v: employees.length + ' فرد أمن' },
    { k: 'نسبة الحضور', v: rate + '%' },
    { k: 'المواقع النشطة', v: sites.length + ' موقع' },
  ];

  return (
    <div>
      <PageToolbar
        title="التقارير والإحصاءات"
        subtitle="مؤشرات الأداء التشغيلية على مستوى المشاريع والمواقع"
        actions={
          <>
            <select
              value={range}
              onChange={(e: any) => setRange(e.target.value)}
              className="h-9 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="today">اليوم</option>
              <option value="week">الأسبوع الحالي</option>
              <option value="month">الشهر الحالي</option>
            </select>
            <Btn variant="outline" onClick={exportReport}>
              <Download className="h-4 w-4" /> تصدير Excel / CSV
            </Btn>
            <Btn variant="primary" onClick={() => setPdfPreview(true)}>
              <FileText className="h-4 w-4" /> معاينة التقرير الرسمي (PDF)
            </Btn>
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
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-cairo text-sm font-bold">التوزيع على المواقع الأمنية</h3>
          <Btn size="sm" variant="outline" onClick={exportSitesReport}>
            <Download className="h-3.5 w-3.5" /> تصدير المواقع
          </Btn>
        </div>
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

      {/* Official Paper Modal for PDF Export / Printing */}
      <Modal open={pdfPreview} onClose={() => setPdfPreview(false)} title="معاينة التقرير الرسمي — طباعة / تصدير PDF" wide>
        <OfficialPaper
          title="التقرير التشغيلي الدوري للقوة الأمنية والمشاريع"
          subtitle="سجل الأداء والمتابعة الميدانية للحراسات الأمنية الخاصة"
          meta={reportMeta}
        >
          <div className="space-y-4 text-xs">
            <div>
              <h4 className="font-bold text-navy-900 border-b pb-1 mb-2">أولاً: ملخص حضور المشاريع</h4>
              <table className="w-full text-right border-collapse text-[11px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300">
                    <th className="p-2">المشروع</th>
                    <th className="p-2">الكود</th>
                    <th className="p-2">طاقم الحراسة</th>
                    <th className="p-2">حاضرون</th>
                    <th className="p-2">متأخرون</th>
                    <th className="p-2">غائبون</th>
                    <th className="p-2">نسبة الانضباط</th>
                  </tr>
                </thead>
                <tbody>
                  {byProject.map((p: any) => (
                    <tr key={p.code} className="border-b border-slate-200">
                      <td className="p-2 font-bold">{p.name}</td>
                      <td className="p-2 font-mono">{p.code}</td>
                      <td className="p-2">{p.staff}</td>
                      <td className="p-2 text-emerald-700 font-bold">{p.present}</td>
                      <td className="p-2 text-amber-700">{p.late}</td>
                      <td className="p-2 text-rose-700">{p.absent}</td>
                      <td className="p-2 font-bold">{p.staff ? Math.round((p.present / p.staff) * 100) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <h4 className="font-bold text-navy-900 border-b pb-1 mb-2">ثانياً: التوزيع الجغرافي للمواقع</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {bySite.map((s: any) => (
                  <div key={s.code} className="p-2 border rounded bg-slate-50">
                    <div className="font-bold text-slate-800">{s.name}</div>
                    <div className="text-[10px] text-slate-500">كود: {s.code} | القوة: {s.count} فرد</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </OfficialPaper>
      </Modal>

      {toast.node}
    </div>
  );
}