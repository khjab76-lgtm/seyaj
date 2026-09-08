import { useEffect, useState } from 'react';
import { RefreshCw, Download, Route as RouteIcon, Clock, CheckCircle2, ImageIcon } from 'lucide-react';
import { useStore } from '@/lib/store';
import { PageToolbar, Btn, Table, StatusBadge, Select, EmptyRow, StatCard, useToast } from '@/components/ui-kit';
import { fetchAllPatrols, getFileUrl, SHIFT_PERIODS } from '@/lib/backend';

const PATROL_STATUS_AR: Record<string, string> = { active: 'نشطة', completed: 'مكتملة' };

export default function Patrols() {
  const { exportCSV } = useStore();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fStatus, setFStatus] = useState('all');
  const [fPeriod, setFPeriod] = useState('all');
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      setRows(await fetchAllPatrols());
    } catch {
      toast.show('تعذّر جلب الدوريات من الخادم');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const today = new Date().toISOString().slice(0, 10);
  const filtered = rows.filter((r: any) =>
    (fStatus === 'all' || r.status === fStatus) && (fPeriod === 'all' || r.shift_period === fPeriod));
  const count = (s: string) => rows.filter((r: any) => r.status === s).length;

  const viewImg = async (key: string) => {
    const url = await getFileUrl(key);
    if (url) window.open(url, '_blank');
    else toast.show('تعذّر فتح صورة التقرير');
  };

  return (
    <div>
      <PageToolbar
        title="الدوريات والتتبع"
        subtitle="متابعة دوريات الحراسات حسب الموقع والفترة الزمنية مع تقارير مصورة"
        actions={
          <>
            <Btn variant="outline" onClick={load}>
              <RefreshCw className="h-4 w-4" /> تحديث
            </Btn>
            <Btn variant="outline" onClick={() => exportCSV('patrols.csv', filtered.map((r: any) => ({
              الموظف: r.employee_name, الرقم: r.employee_code, الموقع: r.site_name, المشروع: r.project_name,
              الفترة: r.shift_period, التاريخ: r.patrol_date, البداية: r.start_time || '—', النهاية: r.end_time || '—',
              الحالة: PATROL_STATUS_AR[r.status] || r.status, الملاحظات: r.note || '—',
            })))}>
              <Download className="h-4 w-4" /> تصدير CSV
            </Btn>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="دوريات نشطة" value={count('active')} icon={<Clock className="h-5 w-5" />} tone="warning" />
        <StatCard title="مكتملة" value={count('completed')} icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard title="اليوم" value={rows.filter((r: any) => r.patrol_date === today).length} icon={<RouteIcon className="h-5 w-5" />} tone="info" />
        <StatCard title="إجمالي الدوريات" value={rows.length} icon={<RouteIcon className="h-5 w-5" />} tone="gold" />
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="w-44">
          <Select value={fStatus} onChange={(e: any) => setFStatus(e.target.value)} options={[
            { value: 'all', label: 'كل الحالات' },
            { value: 'active', label: 'نشطة' },
            { value: 'completed', label: 'مكتملة' },
          ]} />
        </div>
        <div className="w-44">
          <Select value={fPeriod} onChange={(e: any) => setFPeriod(e.target.value)} options={[
            { value: 'all', label: 'كل الفترات' },
            ...SHIFT_PERIODS.map((p) => ({ value: p, label: p })),
          ]} />
        </div>
      </div>
      <Table head={['الحارس', 'الموقع / المشروع', 'الفترة', 'التاريخ', 'البداية', 'النهاية', 'الحالة', 'تقرير مصور', 'ملاحظات']}>
        {loading && <EmptyRow colSpan={9} text="جارٍ التحميل من الخادم..." />}
        {!loading && rows.length === 0 && <EmptyRow colSpan={9} text="لا توجد دوريات بعد — يسجلها الحراس من تطبيق الموظف" />}
        {!loading && filtered.length === 0 && rows.length > 0 && <EmptyRow colSpan={9} text="لا نتائج مطابقة للتصفية" />}
        {!loading && filtered.map((r: any) => (
          <tr key={r.id} className="hover:bg-muted/40">
            <td className="px-4 py-3">
              <div className="text-sm font-bold">{r.employee_name}</div>
              <div className="num text-[11px] text-muted-foreground">{r.employee_code}</div>
            </td>
            <td className="px-4 py-3 text-xs">
              <div className="font-semibold">{r.site_name || '—'}</div>
              <div className="text-[11px] text-muted-foreground">{r.project_name || '—'}</div>
            </td>
            <td className="px-4 py-3 text-xs font-semibold">{r.shift_period}</td>
            <td className="num px-4 py-3 text-xs text-muted-foreground">{r.patrol_date}</td>
            <td className="num px-4 py-3 text-xs">{r.start_time || '—'}</td>
            <td className="num px-4 py-3 text-xs">{r.end_time || '—'}</td>
            <td className="px-4 py-3"><StatusBadge value={PATROL_STATUS_AR[r.status] || r.status} /></td>
            <td className="px-4 py-3">
              {r.report_image_key ? (
                <button onClick={() => viewImg(r.report_image_key)} className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-1 text-[11px] font-bold text-sky-700 ring-1 ring-sky-200 hover:bg-sky-100">
                  <ImageIcon className="h-3 w-3" /> عرض الصورة
                </button>
              ) : (
                <span className="text-[11px] text-muted-foreground">—</span>
              )}
            </td>
            <td className="max-w-40 px-4 py-3 text-xs text-muted-foreground">{r.note || '—'}</td>
          </tr>
        ))}
      </Table>
      {toast.node}
    </div>
  );
}