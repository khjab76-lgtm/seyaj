import { useEffect, useMemo, useState } from 'react';
import { Download, LogOut, RefreshCw, Fingerprint, Clock, CheckCircle2, Users } from 'lucide-react';
import { useStore } from '@/lib/store';
import { PageToolbar, Btn, Table, StatusBadge, Select, EmptyRow, StatCard, useToast } from '@/components/ui-kit';
import { fetchAllAttendance, adminCheckout, nowTime, STATUS_AR } from '@/lib/backend';

export default function Attendance() {
  const { exportCSV } = useStore();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState('all');
  const [fSite, setFSite] = useState('all');
  const [fStatus, setFStatus] = useState('all');
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      setRows(await fetchAllAttendance());
    } catch {
      toast.show('تعذّر جلب البيانات من الخادم');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const siteOptions = useMemo(() => {
    const names = Array.from(new Set(rows.map((r: any) => r.site_name).filter(Boolean)));
    return [{ value: 'all', label: 'كل المواقع' }, ...names.map((n: any) => ({ value: n, label: n }))];
  }, [rows]);

  const dateOptions = useMemo(() => {
    const ds = Array.from(new Set(rows.map((r: any) => r.work_date).filter(Boolean))).sort().reverse();
    return [{ value: 'all', label: 'كل التواريخ' }, ...ds.map((d: any) => ({ value: d, label: d }))];
  }, [rows]);

  const filtered = rows.filter((r: any) =>
    (date === 'all' || r.work_date === date) &&
    (fSite === 'all' || r.site_name === fSite) &&
    (fStatus === 'all' || r.status === fStatus),
  );

  const count = (s: string) => rows.filter((r: any) => r.status === s).length;

  const doCheckout = async (id: number) => {
    try {
      await adminCheckout(id, nowTime());
      toast.show('تم تسجيل الانصراف');
      load();
    } catch {
      toast.show('تعذّر تنفيذ العملية');
    }
  };

  const doExport = () => {
    exportCSV('attendance.csv', filtered.map((r: any) => ({
      الموظف: r.employee_name,
      الرقم: r.employee_code,
      التاريخ: r.work_date,
      الدخول: r.check_in_time || '—',
      الخروج: r.check_out_time || '—',
      الموقع: r.site_name || '—',
      الحالة: STATUS_AR[r.status] || r.status,
      الإحداثيات: r.check_in_lat != null ? `${r.check_in_lat},${r.check_in_lng}` : '—',
    })));
  };

  return (
    <div>
      <PageToolbar
        title="الحضور والانصراف"
        subtitle="تسجيلات البصمة الحية من تطبيق الموظف عبر الباك-إند المشترك"
        actions={
          <>
            <Btn variant="outline" onClick={load}>
              <RefreshCw className="h-4 w-4" /> تحديث
            </Btn>
            <Btn variant="outline" onClick={doExport}>
              <Download className="h-4 w-4" /> تصدير CSV
            </Btn>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="حاضرون الآن" value={count('present')} icon={<Fingerprint className="h-5 w-5" />} tone="success" />
        <StatCard title="متأخرون" value={count('late')} icon={<Clock className="h-5 w-5" />} tone="warning" />
        <StatCard title="منصرفون" value={count('checked_out')} icon={<CheckCircle2 className="h-5 w-5" />} tone="info" />
        <StatCard title="إجمالي السجلات" value={rows.length} icon={<Users className="h-5 w-5" />} tone="gold" />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={date} onChange={(e: any) => setDate(e.target.value)} options={dateOptions} />
        <Select value={fSite} onChange={(e: any) => setFSite(e.target.value)} options={siteOptions} />
        <Select value={fStatus} onChange={(e: any) => setFStatus(e.target.value)} options={[
          { value: 'all', label: 'كل الحالات' },
          { value: 'present', label: 'حاضر' },
          { value: 'late', label: 'متأخر' },
          { value: 'checked_out', label: 'منصرف' },
        ]} />
      </div>
      <Table head={['الموظف', 'التاريخ', 'الدخول', 'الخروج', 'الموقع', 'الموقع الجغرافي', 'الحالة', 'إجراءات']}>
        {loading && <EmptyRow colSpan={8} text="جارٍ التحميل من الخادم..." />}
        {!loading && rows.length === 0 && <EmptyRow colSpan={8} text="لا توجد تسجيلات بعد — سجّل حضوراً من تطبيق الموظف" />}
        {!loading && filtered.length === 0 && rows.length > 0 && <EmptyRow colSpan={8} text="لا نتائج مطابقة للتصفية الحالية" />}
        {!loading && filtered.map((r: any) => (
          <tr key={r.id} className="hover:bg-muted/40">
            <td className="px-4 py-3">
              <div className="text-sm font-bold">{r.employee_name}</div>
              <div className="num text-[11px] text-muted-foreground">{r.employee_code}</div>
            </td>
            <td className="num px-4 py-3 text-xs text-muted-foreground">{r.work_date}</td>
            <td className="num px-4 py-3 text-sm font-semibold">{r.check_in_time || '—'}</td>
            <td className="num px-4 py-3 text-sm font-semibold">{r.check_out_time || '—'}</td>
            <td className="max-w-40 truncate px-4 py-3 text-xs">{r.site_name || '—'}</td>
            <td className="px-4 py-3 text-[11px]">
              {r.check_in_lat != null ? (
                <span className="num text-emerald-700">✓ {Number(r.check_in_lat).toFixed(4)}, {Number(r.check_in_lng).toFixed(4)}</span>
              ) : (
                <span className="text-muted-foreground">بدون إحداثيات</span>
              )}
            </td>
            <td className="px-4 py-3"><StatusBadge value={STATUS_AR[r.status] || r.status} /></td>
            <td className="px-4 py-3">
              {r.status !== 'checked_out' ? (
                <Btn size="sm" variant="outline" onClick={() => doCheckout(r.id)}>
                  <LogOut className="h-3.5 w-3.5" /> انصراف
                </Btn>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-1 text-[11px] font-bold text-sky-700 ring-1 ring-sky-200">
                  <CheckCircle2 className="h-3 w-3" /> اكتملت
                </span>
              )}
            </td>
          </tr>
        ))}
      </Table>
      {toast.node}
    </div>
  );
}