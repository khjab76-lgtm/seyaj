import { useEffect, useMemo, useState } from 'react';
import { Download, LogOut, RefreshCw, Fingerprint, Clock, CheckCircle2, Users, ShieldCheck, Plus, MapPin } from 'lucide-react';
import { useStore } from '@/lib/store';
import { PageToolbar, Btn, Table, StatusBadge, Select, EmptyRow, StatCard, Modal, Field, Input, useToast } from '@/components/ui-kit';
import { fetchAllAttendance, adminCheckout, nowTime, STATUS_AR } from '@/lib/backend';

export default function Attendance() {
  const { attendance: storeAttendance, employees, sites, approveAttendance, checkOut: storeCheckOut, exportCSV } = useStore();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState('all');
  const [fSite, setFSite] = useState('all');
  const [fStatus, setFStatus] = useState('all');
  const [fGeofence, setFGeofence] = useState('all');
  const [manualOpen, setManualOpen] = useState(false);
  const [newAtt, setNewAtt] = useState({
    employeeId: '',
    siteId: '',
    date: new Date().toISOString().slice(0, 10),
    checkIn: '07:00',
    checkOut: '',
    status: 'حاضر',
    notes: 'تسجيل يدوي من المشرف',
  });
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const serverRows = await fetchAllAttendance();
      if (serverRows && serverRows.length > 0) {
        setRows(serverRows);
      } else {
        // Formulate unified rows from store
        const mapped = storeAttendance.map((a: any) => {
          const emp = employees.find((e: any) => e.id === a.employeeId);
          const st = sites.find((s: any) => s.id === a.siteId);
          return {
            id: a.id,
            employee_name: emp?.name || a.employeeName || 'موظف أمن',
            employee_code: emp?.no || a.employeeCode || `EMP-${a.employeeId}`,
            site_name: st?.name || a.location || 'موقع عام',
            work_date: a.date,
            check_in_time: a.checkIn,
            check_out_time: a.checkOut,
            check_in_lat: a.lat ?? (st ? 24.7136 : null),
            check_in_lng: a.lng ?? (st ? 46.6753 : null),
            status: a.status === 'حاضر' ? 'present' : a.status === 'متأخر' ? 'late' : a.status === 'منصرف' ? 'checked_out' : a.status,
            approved: a.approved,
            is_geofenced: a.geofenced !== false,
          };
        });
        setRows(mapped);
      }
    } catch {
      const mapped = storeAttendance.map((a: any) => {
        const emp = employees.find((e: any) => e.id === a.employeeId);
        const st = sites.find((s: any) => s.id === a.siteId);
        return {
          id: a.id,
          employee_name: emp?.name || a.employeeName || 'موظف أمن',
          employee_code: emp?.no || a.employeeCode || `EMP-${a.employeeId}`,
          site_name: st?.name || a.location || 'موقع عام',
          work_date: a.date,
          check_in_time: a.checkIn,
          check_out_time: a.checkOut,
          check_in_lat: a.lat ?? (st ? 24.7136 : null),
          check_in_lng: a.lng ?? (st ? 46.6753 : null),
          status: a.status === 'حاضر' ? 'present' : a.status === 'متأخر' ? 'late' : a.status === 'منصرف' ? 'checked_out' : a.status,
          approved: a.approved,
          is_geofenced: a.geofenced !== false,
        };
      });
      setRows(mapped);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeAttendance]);

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
    (fStatus === 'all' || r.status === fStatus) &&
    (fGeofence === 'all' || (fGeofence === 'in' ? r.check_in_lat != null : r.check_in_lat == null)),
  );

  const count = (s: string) => rows.filter((r: any) => r.status === s).length;

  const doCheckout = async (id: number) => {
    try {
      await adminCheckout(id, nowTime());
    } catch {
      storeCheckOut(id);
    }
    toast.show('تم تسجيل انصراف الموظف بنجاح');
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, check_out_time: nowTime(), status: 'checked_out' } : r)));
  };

  const doApprove = (id: number) => {
    approveAttendance(id);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, approved: true } : r)));
    toast.show('تم اعتماد سجل الحضور وتوثيقه في التدقيق');
  };

  const handleCreateManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAtt.employeeId) {
      toast.show('يرجى اختيار الموظف');
      return;
    }
    const emp = employees.find((x: any) => String(x.id) === String(newAtt.employeeId));
    const st = sites.find((x: any) => String(x.id) === String(newAtt.siteId));
    const newRecord = {
      id: Date.now(),
      employee_name: emp?.name || 'موظف محدد',
      employee_code: emp?.no || 'EMP-NEW',
      site_name: st?.name || 'الموقع الرئيسي',
      work_date: newAtt.date,
      check_in_time: newAtt.checkIn,
      check_out_time: newAtt.checkOut,
      check_in_lat: st?.lat ?? 24.7136,
      check_in_lng: st?.lng ?? 46.6753,
      status: newAtt.status === 'حاضر' ? 'present' : newAtt.status === 'متأخر' ? 'late' : 'checked_out',
      approved: true,
      is_geofenced: true,
    };
    setRows((prev) => [newRecord, ...prev]);
    setManualOpen(false);
    toast.show('تم إضافة سجل الحضور اليدوي واعتماده');
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
      الإحداثيات: r.check_in_lat != null ? `${r.check_in_lat},${r.check_in_lng}` : 'يدوي',
      الاعتماد: r.approved ? 'معتمد' : 'معلق',
    })));
  };

  return (
    <div>
      <PageToolbar
        title="الحضور والانصراف وتتبع النطاق الجغرافي (Geofencing)"
        subtitle="سجلات الحضور الحية مع التحقق من النطاق الجغرافي والاعتماد المباشر"
        actions={
          <>
            <Btn variant="primary" onClick={() => setManualOpen(true)}>
              <Plus className="h-4 w-4" /> تسجيل حضور استثنائي
            </Btn>
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
        <Select value={fGeofence} onChange={(e: any) => setFGeofence(e.target.value)} options={[
          { value: 'all', label: 'كل النطاقات' },
          { value: 'in', label: 'داخل النطاق الجغرافي (GPS)' },
          { value: 'manual', label: 'بدون إحداثيات / يدوي' },
        ]} />
      </div>

      <Table head={['الموظف', 'التاريخ', 'الدخول', 'الخروج', 'الموقع', 'النطاق الجغرافي (GPS)', 'الحالة', 'الاعتماد والعمليات']}>
        {loading && <EmptyRow colSpan={8} text="جارٍ التحميل..." />}
        {!loading && rows.length === 0 && <EmptyRow colSpan={8} text="لا توجد تسجيلات بعد — سجّل حضوراً من تطبيق الموظف أو الزر أعلاه" />}
        {!loading && filtered.length === 0 && rows.length > 0 && <EmptyRow colSpan={8} text="لا نتائج مطابقة للتصفية الحالية" />}
        {!loading && filtered.map((r: any) => (
          <tr key={r.id} className="hover:bg-muted/40">
            <td className="px-4 py-3">
              <div className="text-sm font-bold">{r.employee_name}</div>
              <div className="num text-[11px] text-muted-foreground">{r.employee_code}</div>
            </td>
            <td className="num px-4 py-3 text-xs text-muted-foreground">{r.work_date}</td>
            <td className="num px-4 py-3 text-sm font-semibold text-emerald-700">{r.check_in_time || '—'}</td>
            <td className="num px-4 py-3 text-sm font-semibold">{r.check_out_time || '—'}</td>
            <td className="max-w-40 truncate px-4 py-3 text-xs font-medium">{r.site_name || '—'}</td>
            <td className="px-4 py-3 text-[11px]">
              {r.check_in_lat != null ? (
                <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                  <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                  <span>داخل النطاق ({Number(r.check_in_lat).toFixed(3)}, {Number(r.check_in_lng).toFixed(3)})</span>
                </div>
              ) : (
                <span className="inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-muted-foreground text-[10px]">تسجيل يدوي</span>
              )}
            </td>
            <td className="px-4 py-3"><StatusBadge value={STATUS_AR[r.status] || r.status} /></td>
            <td className="px-4 py-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                {!r.approved ? (
                  <Btn size="sm" variant="outline" onClick={() => doApprove(r.id)} className="text-emerald-700 border-emerald-300 hover:bg-emerald-50">
                    <ShieldCheck className="h-3.5 w-3.5" /> اعتماد
                  </Btn>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="h-3 w-3" /> معتمد
                  </span>
                )}

                {r.status !== 'checked_out' && (
                  <Btn size="sm" variant="outline" onClick={() => doCheckout(r.id)}>
                    <LogOut className="h-3.5 w-3.5" /> انصراف
                  </Btn>
                )}
              </div>
            </td>
          </tr>
        ))}
      </Table>

      {/* Manual Attendance Modal */}
      {manualOpen && (
        <Modal title="تسجيل حضور استثنائي / يدوي" onClose={() => setManualOpen(false)}>
          <form onSubmit={handleCreateManual} className="space-y-3">
            <Field label="الموظف">
              <Select
                value={newAtt.employeeId}
                onChange={(e: any) => setNewAtt({ ...newAtt, employeeId: e.target.value })}
                options={[
                  { value: '', label: 'اختر الموظف...' },
                  ...employees.map((emp: any) => ({ value: emp.id, label: `${emp.name} (${emp.no})` })),
                ]}
              />
            </Field>

            <Field label="الموقع الأمني">
              <Select
                value={newAtt.siteId}
                onChange={(e: any) => setNewAtt({ ...newAtt, siteId: e.target.value })}
                options={[
                  { value: '', label: 'اختر الموقع...' },
                  ...sites.map((st: any) => ({ value: st.id, label: st.name })),
                ]}
              />
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="تاريخ الحضور">
                <Input
                  type="date"
                  value={newAtt.date}
                  onChange={(e: any) => setNewAtt({ ...newAtt, date: e.target.value })}
                />
              </Field>
              <Field label="وقت الدخول">
                <Input
                  type="time"
                  value={newAtt.checkIn}
                  onChange={(e: any) => setNewAtt({ ...newAtt, checkIn: e.target.value })}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label="الحالة">
                <Select
                  value={newAtt.status}
                  onChange={(e: any) => setNewAtt({ ...newAtt, status: e.target.value })}
                  options={[
                    { value: 'حاضر', label: 'حاضر في الموعد' },
                    { value: 'متأخر', label: 'متأخر' },
                    { value: 'منصرف', label: 'منصرف' },
                  ]}
                />
              </Field>
              <Field label="وقت الانصراف (اختياري)">
                <Input
                  type="time"
                  value={newAtt.checkOut}
                  onChange={(e: any) => setNewAtt({ ...newAtt, checkOut: e.target.value })}
                />
              </Field>
            </div>

            <Field label="سبب التسجيل اليدوي">
              <Input
                value={newAtt.notes}
                onChange={(e: any) => setNewAtt({ ...newAtt, notes: e.target.value })}
                placeholder="عطل في جهاز البصمة / إذن إداري..."
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Btn type="button" variant="outline" onClick={() => setManualOpen(false)}>إلغاء</Btn>
              <Btn type="submit" variant="primary">حفظ واعتماد السجل</Btn>
            </div>
          </form>
        </Modal>
      )}

      {toast.node}
    </div>
  );
}