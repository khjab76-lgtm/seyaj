import { useState } from 'react';
import { Plus, Download } from 'lucide-react';
import { useStore } from '@/lib/store';
import { PageToolbar, Btn, Table, StatusBadge, Modal, Field, TextInput, Select, RowActions, EmptyRow, useToast } from '@/components/ui-kit';

const JOBS = ['رجل أمن', 'رئيس وردية', 'مشرف موقع', 'أمن منشآت', 'مراقب كاميرات', 'حارس بوابة', 'مشرف أمن'];
const emptyEmp: any = { name: '', no: '', job: JOBS[0], projectId: 1, siteId: 1, phone: '', email: '', status: 'نشط', fingerprint: 'مفعّل', joined: '2026-09-01' };

export default function Employees() {
  const { employees, projects, sites, empCrud, exportCSV } = useStore();
  const [q, setQ] = useState('');
  const [fProject, setFProject] = useState('all');
  const [fStatus, setFStatus] = useState('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(emptyEmp);
  const [editing, setEditing] = useState(false);
  const toast = useToast();

  const pName = (id: number) => projects.find((p: any) => p.id === id)?.name || '—';
  const sName = (id: number) => sites.find((s: any) => s.id === id)?.name || '—';

  const rows = employees.filter((e: any) =>
    (q === '' || e.name.includes(q) || e.no.includes(q) || e.phone.includes(q)) &&
    (fProject === 'all' || e.projectId === Number(fProject)) &&
    (fStatus === 'all' || e.status === fStatus)
  );

  const save = () => {
    if (!form.name.trim()) { toast.show('اسم الموظف مطلوب'); return; }
    if (editing) { empCrud.update(form); toast.show('تم تحديث بيانات الموظف'); }
    else { empCrud.add({ ...form, id: 0 }); toast.show('تمت إضافة الموظف بنجاح'); }
    setOpen(false);
  };

  const del = (e: any) => {
    if (confirm('حذف الموظف ' + e.name + '؟')) { empCrud.remove(e.id); toast.show('تم حذف الموظف'); }
  };

  return (
    <div>
      <PageToolbar
        title="إدارة الموظفين"
        subtitle={employees.length + ' موظف مسجل في النظام'}
        actions={
          <>
            <Btn variant="outline" onClick={() => exportCSV('employees.csv', rows.map((r: any) => ({ الاسم: r.name, الرقم: r.no, الوظيفة: r.job, المشروع: pName(r.projectId), الموقع: sName(r.siteId), الجوال: r.phone, الحالة: r.status, البصمة: r.fingerprint })))}>
              <Download className="h-4 w-4" /> تصدير CSV
            </Btn>
            <Btn variant="gold" onClick={() => { setForm({ ...emptyEmp }); setEditing(false); setOpen(true); }}>
              <Plus className="h-4 w-4" /> موظف جديد
            </Btn>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <TextInput placeholder="بحث بالاسم أو الرقم أو الجوال..." value={q} onChange={(e: any) => setQ(e.target.value)} />
        <Select value={fProject} onChange={(e: any) => setFProject(e.target.value)} options={[{ value: 'all', label: 'كل المشاريع' }, ...projects.map((p: any) => ({ value: p.id, label: p.name }))]} />
        <Select value={fStatus} onChange={(e: any) => setFStatus(e.target.value)} options={[{ value: 'all', label: 'كل الحالات' }, ...['نشط', 'إجازة', 'موقوف'].map((s) => ({ value: s, label: s }))]} />
      </div>
      <Table head={['الموظف', 'الوظيفة', 'المشروع', 'الموقع', 'الجوال', 'البصمة', 'الحالة', 'إجراءات']}>
        {rows.length === 0 && <EmptyRow colSpan={8} />}
        {rows.map((e: any) => (
          <tr key={e.id} className="hover:bg-muted/40">
            <td className="px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-900 text-[11px] font-bold text-gold-400">{e.name.slice(0, 1)}</div>
                <div>
                  <div className="text-sm font-bold">{e.name}</div>
                  <div className="num text-[11px] text-muted-foreground">{e.no}</div>
                </div>
              </div>
            </td>
            <td className="px-4 py-3 text-muted-foreground">{e.job}</td>
            <td className="max-w-40 truncate px-4 py-3 text-xs">{pName(e.projectId)}</td>
            <td className="max-w-40 truncate px-4 py-3 text-xs text-muted-foreground">{sName(e.siteId)}</td>
            <td className="num px-4 py-3 text-xs">{e.phone}</td>
            <td className="px-4 py-3"><StatusBadge value={e.fingerprint} /></td>
            <td className="px-4 py-3"><StatusBadge value={e.status} /></td>
            <td className="px-4 py-3">
              <RowActions onEdit={() => { setForm({ ...e }); setEditing(true); setOpen(true); }} onDelete={() => del(e)} />
            </td>
          </tr>
        ))}
      </Table>
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'تعديل بيانات موظف' : 'إضافة موظف جديد'} wide>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="الاسم الكامل"><TextInput value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} placeholder="مثال: فهد بن محمد العتيبي" /></Field>
          <Field label="الرقم الوظيفي"><TextInput value={form.no} onChange={(e: any) => setForm({ ...form, no: e.target.value })} placeholder="EMP-1011" /></Field>
          <Field label="المسمى الوظيفي"><Select value={form.job} onChange={(e: any) => setForm({ ...form, job: e.target.value })} options={JOBS.map((j) => ({ value: j, label: j }))} /></Field>
          <Field label="المشروع"><Select value={form.projectId} onChange={(e: any) => setForm({ ...form, projectId: Number(e.target.value) })} options={projects.map((p: any) => ({ value: p.id, label: p.name }))} /></Field>
          <Field label="الموقع"><Select value={form.siteId} onChange={(e: any) => setForm({ ...form, siteId: Number(e.target.value) })} options={sites.map((s: any) => ({ value: s.id, label: s.name }))} /></Field>
          <Field label="رقم الجوال"><TextInput value={form.phone} onChange={(e: any) => setForm({ ...form, phone: e.target.value })} placeholder="05xxxxxxxx" /></Field>
          <Field label="البريد الإلكتروني"><TextInput value={form.email} onChange={(e: any) => setForm({ ...form, email: e.target.value })} placeholder="name@siaj.sa" /></Field>
          <Field label="تاريخ الالتحاق"><TextInput type="date" value={form.joined} onChange={(e: any) => setForm({ ...form, joined: e.target.value })} /></Field>
          <Field label="الحالة"><Select value={form.status} onChange={(e: any) => setForm({ ...form, status: e.target.value })} options={['نشط', 'إجازة', 'موقوف'].map((s) => ({ value: s, label: s }))} /></Field>
          <Field label="البصمة"><Select value={form.fingerprint} onChange={(e: any) => setForm({ ...form, fingerprint: e.target.value })} options={['مفعّل', 'غير مفعّل'].map((s) => ({ value: s, label: s }))} /></Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Btn variant="outline" onClick={() => setOpen(false)}>إلغاء</Btn>
          <Btn variant="primary" onClick={save}>{editing ? 'حفظ التعديلات' : 'إضافة الموظف'}</Btn>
        </div>
      </Modal>
      {toast.node}
    </div>
  );
}