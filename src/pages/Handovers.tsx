import { useEffect, useState } from 'react';
import { RefreshCw, Download, ArrowLeftRight, CheckCircle2, ImageIcon, ShieldAlert } from 'lucide-react';
import { useStore } from '@/lib/store';
import { PageToolbar, Btn, Table, StatusBadge, Select, EmptyRow, StatCard, useToast } from '@/components/ui-kit';
import { fetchAllHandovers, getFileUrl, SHIFT_PERIODS, validateSaId, validateSaPhone } from '@/lib/backend';

const HO_STATUS_AR: Record<string, string> = { pending: 'معلق', completed: 'مكتمل' };

function idOk(v: string) { return v ? validateSaId(v) : true; }
function phOk(v: string) { return v ? validateSaPhone(v) : true; }

export default function Handovers() {
  const { exportCSV } = useStore();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fPeriod, setFPeriod] = useState('all');
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      setRows(await fetchAllHandovers());
    } catch {
      toast.show('تعذّر جلب عمليات التسليم من الخادم');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const filtered = rows.filter((r: any) => fPeriod === 'all' || r.shift_period === fPeriod);
  const count = (s: string) => rows.filter((r: any) => r.status === s).length;

  const viewImg = async (key: string) => {
    const url = await getFileUrl(key);
    if (url) window.open(url, '_blank');
    else toast.show('تعذّر فتح صورة التقرير');
  };

  return (
    <div>
      <PageToolbar
        title="الاستلام والتسليم"
        subtitle="توثيق تسليم المواقع بين الورديات مع بيانات المسلّم والمستلم والتحقق من الهوية والجوال"
        actions={
          <>
            <Btn variant="outline" onClick={load}>
              <RefreshCw className="h-4 w-4" /> تحديث
            </Btn>
            <Btn variant="outline" onClick={() => exportCSV('handovers.csv', filtered.map((r: any) => ({
              الموقع: r.site_name, المشروع: r.project_name, الفترة: r.shift_period,
              التاريخ: r.handover_date, الوقت: r.handover_time,
              'المسلّم': r.giver_name, 'هوية المسلّم': r.giver_id_number, 'جوال المسلّم': r.giver_phone,
              'المستلم': r.receiver_name, 'هوية المستلم': r.receiver_id_number, 'جوال المستلم': r.receiver_phone,
              الحالة: HO_STATUS_AR[r.status] || r.status, الملاحظات: r.note || '—',
            })))}>
              <Download className="h-4 w-4" /> تصدير CSV
            </Btn>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="مكتملة" value={count('completed')} icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard title="معلقة" value={count('pending')} icon={<ShieldAlert className="h-5 w-5" />} tone="warning" />
        <StatCard title="اليوم" value={rows.filter((r: any) => r.handover_date === new Date().toISOString().slice(0, 10)).length} icon={<ArrowLeftRight className="h-5 w-5" />} tone="info" />
        <StatCard title="إجمالي التسليمات" value={rows.length} icon={<ArrowLeftRight className="h-5 w-5" />} tone="gold" />
      </div>
      <div className="mb-4 w-44">
        <Select value={fPeriod} onChange={(e: any) => setFPeriod(e.target.value)} options={[
          { value: 'all', label: 'كل الفترات' },
          ...SHIFT_PERIODS.map((p) => ({ value: p, label: p })),
        ]} />
      </div>
      <Table head={['الموقع / المشروع', 'الفترة', 'التاريخ والوقت', 'المسلّم', 'المستلم', 'الحالة', 'تقرير مصور', 'ملاحظات']}>
        {loading && <EmptyRow colSpan={8} text="جارٍ التحميل من الخادم..." />}
        {!loading && rows.length === 0 && <EmptyRow colSpan={8} text="لا توجد عمليات تسليم بعد — يسجلها الحراس من تطبيق الموظف" />}
        {!loading && filtered.length === 0 && rows.length > 0 && <EmptyRow colSpan={8} text="لا نتائج مطابقة للتصفية" />}
        {!loading && filtered.map((r: any) => (
          <tr key={r.id} className="hover:bg-muted/40">
            <td className="px-4 py-3 text-xs">
              <div className="font-semibold">{r.site_name || '—'}</div>
              <div className="text-[11px] text-muted-foreground">{r.project_name || '—'}</div>
            </td>
            <td className="px-4 py-3 text-xs font-semibold">{r.shift_period}</td>
            <td className="num px-4 py-3 text-xs text-muted-foreground">
              {r.handover_date} <span className="text-gold-600">{r.handover_time}</span>
            </td>
            <td className="px-4 py-3 text-xs">
              <div className="font-bold">{r.giver_name}</div>
              <div className={'num ' + (idOk(r.giver_id_number) ? 'text-muted-foreground' : 'text-rose-600')}>هوية: {r.giver_id_number || '—'}</div>
              <div className={'num ' + (phOk(r.giver_phone) ? 'text-muted-foreground' : 'text-rose-600')}>جوال: {r.giver_phone || '—'}</div>
            </td>
            <td className="px-4 py-3 text-xs">
              <div className="font-bold">{r.receiver_name}</div>
              <div className={'num ' + (idOk(r.receiver_id_number) ? 'text-muted-foreground' : 'text-rose-600')}>هوية: {r.receiver_id_number || '—'}</div>
              <div className={'num ' + (phOk(r.receiver_phone) ? 'text-muted-foreground' : 'text-rose-600')}>جوال: {r.receiver_phone || '—'}</div>
            </td>
            <td className="px-4 py-3"><StatusBadge value={HO_STATUS_AR[r.status] || r.status} /></td>
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