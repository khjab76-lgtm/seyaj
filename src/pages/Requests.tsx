import { useEffect, useState } from 'react';
import { Plus, Check, X, Download, RefreshCw, Inbox, Clock, CheckCircle2, ShieldAlert, Paperclip, Eye } from 'lucide-react';
import { useStore } from '@/lib/store';
import { PageToolbar, Btn, Table, StatusBadge, Modal, Field, TextInput, TextArea, Select, EmptyRow, StatCard, useToast } from '@/components/ui-kit';
import {
  fetchAllRequests, adminDecide, createRequestRecord, getFileUrl, uploadDoc, downloadDoc,
  REQ_TYPES, REQ_TYPES_NEED_ATTACH, REQ_STATUS_AR, todayISO,
} from '@/lib/backend';

export default function Requests() {
  const { requests: storeRequests, updateRequest: storeUpdateRequest, createRequest: storeCreateRequest, employees, exportCSV } = useStore();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fStatus, setFStatus] = useState('all');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [form, setForm] = useState<any>({ type: REQ_TYPES[0], start_date: '', end_date: '', reason: '', employeeId: '' });
  const [file, setFile] = useState<File | null>(null);
  const toast = useToast();
  const today = todayISO();

  const load = async () => {
    setLoading(true);
    try {
      const serverRows = await fetchAllRequests();
      if (serverRows && serverRows.length > 0) {
        setRows(serverRows);
      } else {
        const mapped = storeRequests.map((r: any) => ({
          id: r.id,
          employee_name: r.employeeName || 'موظف أمن',
          employee_code: `EMP-${r.employeeId || r.id}`,
          request_type: r.type,
          start_date: r.date || today,
          end_date: r.date || today,
          reason: r.reason,
          status: r.status === 'معتمد' ? 'approved' : r.status === 'مرفوض' ? 'rejected' : 'pending',
          attachment_name: r.type.includes('مرضية') ? 'medical_report.pdf' : null,
          attachment_key: r.type.includes('مرضية') ? 'demo' : null,
        }));
        setRows(mapped);
      }
    } catch {
      const mapped = storeRequests.map((r: any) => ({
        id: r.id,
        employee_name: r.employeeName || 'موظف أمن',
        employee_code: `EMP-${r.employeeId || r.id}`,
        request_type: r.type,
        start_date: r.date || today,
        end_date: r.date || today,
        reason: r.reason,
        status: r.status === 'معتمد' ? 'approved' : r.status === 'مرفوض' ? 'rejected' : 'pending',
        attachment_name: r.type.includes('مرضية') ? 'medical_report.pdf' : null,
        attachment_key: r.type.includes('مرضية') ? 'demo' : null,
      }));
      setRows(mapped);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [storeRequests]);

  const filtered = rows.filter((r: any) => fStatus === 'all' || r.status === fStatus);
  const count = (s: string) => rows.filter((r: any) => r.status === s).length;
  const needAttach = REQ_TYPES_NEED_ATTACH.includes(form.type);

  const decide = async (id: number, status: string) => {
    setBusy(id);
    const arStatus = status === 'approved' ? 'معتمد' : 'مرفوض';
    try {
      await adminDecide(id, status);
    } catch {
      storeUpdateRequest(id, arStatus);
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    toast.show(status === 'approved' ? 'تم اعتماد الطلب وتوثيقه' : 'تم رفض الطلب');
    setBusy(null);
  };

  const viewDoc = async (key: string) => {
    const url = await getFileUrl(key);
    if (url) window.open(url, '_blank');
    else toast.show('تعذّر فتح المرفق');
  };

  const save = async () => {
    if (!form.reason.trim()) { toast.show('السبب مطلوب'); return; }
    if (needAttach && !file) { toast.show('هذا النوع يتطلب إرفاق مستند'); return; }
    setBusy(-1);
    try {
      let att: any = {};
      if (file) att = await uploadDoc(file, 'requests');
      await createRequestRecord({
        employee_name: 'مدير النظام',
        employee_code: 'ADMIN',
        request_type: form.type,
        reason: form.reason.trim(),
        start_date: form.start_date || today,
        end_date: form.end_date || form.start_date || today,
        status: 'pending',
        attachment_key: att.object_key,
        attachment_name: att.file_name,
      });
      toast.show('تم إنشاء الطلب');
      setOpen(false);
      setForm({ type: REQ_TYPES[0], start_date: '', end_date: '', reason: '' });
      setFile(null);
      load();
    } catch {
      toast.show('تعذّر إنشاء الطلب');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageToolbar
        title="الطلبات والاعتمادات"
        subtitle="جميع أنواع الطلبات مع المرفقات — واردة من تطبيق الموظف عبر الباك-إند المشترك"
        actions={
          <>
            <Btn variant="outline" onClick={load}>
              <RefreshCw className="h-4 w-4" /> تحديث
            </Btn>
            <Btn variant="outline" onClick={() => exportCSV('requests.csv', filtered.map((r: any) => ({
              الموظف: r.employee_name, الرقم: r.employee_code, النوع: r.request_type,
              من: r.start_date, إلى: r.end_date, السبب: r.reason,
              المرفق: r.attachment_name || '—', الحالة: REQ_STATUS_AR[r.status] || r.status,
            })))}>
              <Download className="h-4 w-4" /> تصدير CSV
            </Btn>
            <Btn variant="gold" onClick={() => { setForm({ type: REQ_TYPES[0], start_date: today, end_date: today, reason: '' }); setFile(null); setOpen(true); }}>
              <Plus className="h-4 w-4" /> طلب جديد
            </Btn>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="بانتظار الاعتماد" value={count('pending')} icon={<Clock className="h-5 w-5" />} tone="warning" />
        <StatCard title="معتمدة" value={count('approved')} icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard title="مرفوضة" value={count('rejected')} icon={<ShieldAlert className="h-5 w-5" />} tone="danger" />
        <StatCard title="إجمالي الطلبات" value={rows.length} icon={<Inbox className="h-5 w-5" />} tone="gold" />
      </div>
      <div className="mb-4 w-48">
        <Select value={fStatus} onChange={(e: any) => setFStatus(e.target.value)} options={[
          { value: 'all', label: 'كل الحالات' },
          { value: 'pending', label: 'معلق' },
          { value: 'approved', label: 'معتمد' },
          { value: 'rejected', label: 'مرفوض' },
        ]} />
      </div>
      <Table head={['الموظف', 'نوع الطلب', 'من تاريخ', 'إلى تاريخ', 'السبب', 'المرفق', 'الحالة', 'إجراءات']}>
        {loading && <EmptyRow colSpan={8} text="جارٍ التحميل من الخادم..." />}
        {!loading && rows.length === 0 && <EmptyRow colSpan={8} text="لا توجد طلبات بعد — سيرفع الموظفون طلباتهم من التطبيق" />}
        {!loading && filtered.length === 0 && rows.length > 0 && <EmptyRow colSpan={8} text="لا نتائج مطابقة للتصفية" />}
        {!loading && filtered.map((r: any) => (
          <tr key={r.id} className="hover:bg-muted/40">
            <td className="px-4 py-3">
              <div className="text-sm font-bold">{r.employee_name}</div>
              <div className="num text-[11px] text-muted-foreground">{r.employee_code}</div>
            </td>
            <td className="px-4 py-3 text-xs font-semibold">{r.request_type}</td>
            <td className="num px-4 py-3 text-xs text-muted-foreground">{r.start_date}</td>
            <td className="num px-4 py-3 text-xs text-muted-foreground">{r.end_date}</td>
            <td className="max-w-48 px-4 py-3 text-xs text-muted-foreground">{r.reason}</td>
            <td className="px-4 py-3">
              {r.attachment_key ? (
                <div className="flex items-center gap-1.5">
                  <button onClick={() => viewDoc(r.attachment_key)} className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-1 text-[11px] font-bold text-sky-700 ring-1 ring-sky-200 hover:bg-sky-100">
                    <Eye className="h-3 w-3" /> معاينة
                  </button>
                  <button onClick={() => downloadDoc(r.attachment_key)} className="rounded-md bg-slate-100 p-1.5 text-slate-500 hover:bg-slate-200" title="تنزيل">
                    <Download className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <span className="text-[11px] text-muted-foreground">—</span>
              )}
            </td>
            <td className="px-4 py-3"><StatusBadge value={REQ_STATUS_AR[r.status] || r.status} /></td>
            <td className="px-4 py-3">
              {r.status === 'pending' ? (
                <div className="flex items-center gap-1.5">
                  <Btn size="sm" variant="success" onClick={() => decide(r.id, 'approved')} disabled={busy === r.id}>
                    <Check className="h-3.5 w-3.5" /> اعتماد
                  </Btn>
                  <Btn size="sm" variant="danger" onClick={() => decide(r.id, 'rejected')} disabled={busy === r.id}>
                    <X className="h-3.5 w-3.5" /> رفض
                  </Btn>
                </div>
              ) : (
                <span className="text-[11px] text-muted-foreground">تمت المعالجة</span>
              )}
            </td>
          </tr>
        ))}
      </Table>
      <Modal open={open} onClose={() => setOpen(false)} title="إنشاء طلب جديد" wide>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="نوع الطلب"><Select value={form.type} onChange={(e: any) => setForm({ ...form, type: e.target.value })} options={REQ_TYPES.map((t) => ({ value: t, label: t }))} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="من تاريخ"><TextInput type="date" value={form.start_date} onChange={(e: any) => setForm({ ...form, start_date: e.target.value })} /></Field>
            <Field label="إلى تاريخ"><TextInput type="date" value={form.end_date} onChange={(e: any) => setForm({ ...form, end_date: e.target.value })} /></Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="السبب"><TextArea value={form.reason} onChange={(e: any) => setForm({ ...form, reason: e.target.value })} placeholder="سبب الطلب..." /></Field>
          </div>
          <div className="sm:col-span-2">
            <Field label={needAttach ? 'المرفق (مطلوب)' : 'المرفق (اختياري)'}>
              <input type="file" accept="image/*,.pdf" onChange={(e: any) => setFile(e.target.files?.[0] ?? null)}
                className="h-9 w-full rounded-lg border bg-background px-3 text-sm file:ml-3 file:rounded file:border-0 file:bg-navy-900 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-gold-400" />
              {file && <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground"><Paperclip className="h-3 w-3" /> {file.name}</div>}
            </Field>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Btn variant="outline" onClick={() => setOpen(false)}>إلغاء</Btn>
          <Btn variant="primary" onClick={save} disabled={busy === -1}>{busy === -1 ? 'جارٍ الحفظ...' : 'إرسال الطلب'}</Btn>
        </div>
      </Modal>
      {toast.node}
    </div>
  );
}
