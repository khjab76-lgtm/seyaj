import { useState } from 'react';
import { Plus, Download, Briefcase } from 'lucide-react';
import { useStore } from '@/lib/store';
import { PageToolbar, Btn, Table, StatusBadge, Modal, Field, TextInput, Select, RowActions, EmptyRow, useToast } from '@/components/ui-kit';

const emptyPrj: any = { code: '', name: '', siteId: 1, manager: '', status: 'نشط', start: '2026-09-01', end: '2027-08-31' };

export default function Projects() {
  const { projects, sites, employees, prjCrud, exportCSV } = useStore();
  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(emptyPrj);
  const [editing, setEditing] = useState(false);
  const toast = useToast();

  const sName = (id: number) => sites.find((s: any) => s.id === id)?.name || '—';
  const teamCount = (id: number) => employees.filter((e: any) => e.projectId === id).length;

  const rows = projects.filter((p: any) =>
    (q === '' || p.name.includes(q) || p.code.includes(q) || p.manager.includes(q)) &&
    (fStatus === 'all' || p.status === fStatus)
  );

  const save = () => {
    if (!form.name.trim() || !form.code.trim()) { toast.show('كود واسم المشروع مطلوبان'); return; }
    if (editing) { prjCrud.update(form); toast.show('تم تحديث المشروع'); }
    else { prjCrud.add({ ...form, id: 0 }); toast.show('تمت إضافة المشروع'); }
    setOpen(false);
  };

  const del = (p: any) => {
    if (confirm('حذف المشروع «' + p.name + '»؟')) { prjCrud.remove(p.id); toast.show('تم حذف المشروع'); }
  };

  return (
    <div>
      <PageToolbar
        title="إدارة المشاريع"
        subtitle={projects.length + ' مشروع — ' + projects.filter((p: any) => p.status === 'نشط').length + ' نشط'}
        actions={
          <>
            <Btn variant="outline" onClick={() => exportCSV('projects.csv', rows.map((r: any) => ({ الكود: r.code, المشروع: r.name, المدير: r.manager, الموقع: sName(r.siteId), الفريق: teamCount(r.id), البداية: r.start, النهاية: r.end, الحالة: r.status })))}>
              <Download className="h-4 w-4" /> تصدير CSV
            </Btn>
            <Btn variant="gold" onClick={() => { setForm({ ...emptyPrj }); setEditing(false); setOpen(true); }}>
              <Plus className="h-4 w-4" /> مشروع جديد
            </Btn>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <TextInput placeholder="بحث بالاسم أو الكود أو المدير..." value={q} onChange={(e: any) => setQ(e.target.value)} />
        <Select value={fStatus} onChange={(e: any) => setFStatus(e.target.value)} options={[{ value: 'all', label: 'كل الحالات' }, ...['نشط', 'مكتمل'].map((s) => ({ value: s, label: s }))]} />
      </div>
      <Table head={['المشروع', 'الكود', 'الموقع', 'المدير', 'الفريق', 'المدة', 'الحالة', 'إجراءات']}>
        {rows.length === 0 && <EmptyRow colSpan={8} />}
        {rows.map((p: any) => (
          <tr key={p.id} className="hover:bg-muted/40">
            <td className="px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-500/15 text-gold-600"><Briefcase className="h-4 w-4" /></div>
                <div className="text-sm font-bold">{p.name}</div>
              </div>
            </td>
            <td className="num px-4 py-3 text-xs font-semibold text-navy-700">{p.code}</td>
            <td className="max-w-44 truncate px-4 py-3 text-xs text-muted-foreground">{sName(p.siteId)}</td>
            <td className="px-4 py-3 text-xs">{p.manager}</td>
            <td className="num px-4 py-3 text-xs font-bold">{teamCount(p.id)} موظف</td>
            <td className="num px-4 py-3 text-[11px] text-muted-foreground">{p.start} ← {p.end}</td>
            <td className="px-4 py-3"><StatusBadge value={p.status} /></td>
            <td className="px-4 py-3">
              <RowActions onEdit={() => { setForm({ ...p }); setEditing(true); setOpen(true); }} onDelete={() => del(p)} />
            </td>
          </tr>
        ))}
      </Table>
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'تعديل مشروع' : 'إضافة مشروع جديد'} wide>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="كود المشروع"><TextInput value={form.code} onChange={(e: any) => setForm({ ...form, code: e.target.value })} placeholder="PRJ-107" /></Field>
          <Field label="اسم المشروع"><TextInput value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} placeholder="حراسة مبنى..." /></Field>
          <Field label="الموقع"><Select value={form.siteId} onChange={(e: any) => setForm({ ...form, siteId: Number(e.target.value) })} options={sites.map((s: any) => ({ value: s.id, label: s.name }))} /></Field>
          <Field label="مدير المشروع"><TextInput value={form.manager} onChange={(e: any) => setForm({ ...form, manager: e.target.value })} placeholder="اسم المدير" /></Field>
          <Field label="تاريخ البداية"><TextInput type="date" value={form.start} onChange={(e: any) => setForm({ ...form, start: e.target.value })} /></Field>
          <Field label="تاريخ النهاية"><TextInput type="date" value={form.end} onChange={(e: any) => setForm({ ...form, end: e.target.value })} /></Field>
          <Field label="الحالة"><Select value={form.status} onChange={(e: any) => setForm({ ...form, status: e.target.value })} options={['نشط', 'مكتمل'].map((s) => ({ value: s, label: s }))} /></Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Btn variant="outline" onClick={() => setOpen(false)}>إلغاء</Btn>
          <Btn variant="primary" onClick={save}>{editing ? 'حفظ التعديلات' : 'إضافة المشروع'}</Btn>
        </div>
      </Modal>
      {toast.node}
    </div>
  );
}