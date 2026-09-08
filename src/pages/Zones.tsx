import { useState } from 'react';
import { Plus, Download, Globe2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { PageToolbar, Btn, Table, Modal, Field, TextInput, RowActions, EmptyRow, useToast } from '@/components/ui-kit';

const emptyZone: any = { code: '', name: '', manager: '' };

export default function Zones() {
  const { zones, sites, employees, zoneCrud, exportCSV } = useStore();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(emptyZone);
  const [editing, setEditing] = useState(false);
  const toast = useToast();

  const siteCount = (id: number) => sites.filter((s: any) => s.zoneId === id).length;
  const staff = (id: number) => {
    const ids = sites.filter((s: any) => s.zoneId === id).map((s: any) => s.id);
    return employees.filter((e: any) => ids.includes(e.siteId)).length;
  };

  const save = () => {
    if (!form.name.trim() || !form.code.trim()) { toast.show('كود واسم المنطقة مطلوبان'); return; }
    if (editing) { zoneCrud.update(form); toast.show('تم تحديث المنطقة'); }
    else { zoneCrud.add({ ...form, id: 0 }); toast.show('تمت إضافة المنطقة'); }
    setOpen(false);
  };

  const del = (z: any) => {
    if (confirm('حذف المنطقة «' + z.name + '»؟')) { zoneCrud.remove(z.id); toast.show('تم حذف المنطقة'); }
  };

  return (
    <div>
      <PageToolbar
        title="إدارة المناطق الجغرافية"
        subtitle={zones.length + ' مناطق تغطي شبكة المواقع'}
        actions={
          <>
            <Btn variant="outline" onClick={() => exportCSV('zones.csv', zones.map((r: any) => ({ الكود: r.code, المنطقة: r.name, المدير: r.manager, المواقع: siteCount(r.id), الطاقم: staff(r.id) })))}>
              <Download className="h-4 w-4" /> تصدير CSV
            </Btn>
            <Btn variant="gold" onClick={() => { setForm({ ...emptyZone }); setEditing(false); setOpen(true); }}>
              <Plus className="h-4 w-4" /> منطقة جديدة
            </Btn>
          </>
        }
      />
      <Table head={['المنطقة', 'الكود', 'المدير المسؤول', 'عدد المواقع', 'إجمالي الطاقم', 'إجراءات']}>
        {zones.length === 0 && <EmptyRow colSpan={6} />}
        {zones.map((z: any) => (
          <tr key={z.id} className="hover:bg-muted/40">
            <td className="px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-900 text-gold-400"><Globe2 className="h-4 w-4" /></div>
                <div className="text-sm font-bold">{z.name}</div>
              </div>
            </td>
            <td className="num px-4 py-3 text-xs font-semibold text-navy-700">{z.code}</td>
            <td className="px-4 py-3 text-xs">{z.manager}</td>
            <td className="num px-4 py-3 text-sm font-bold">{siteCount(z.id)}</td>
            <td className="num px-4 py-3 text-sm font-bold text-emerald-600">{staff(z.id)}</td>
            <td className="px-4 py-3">
              <RowActions onEdit={() => { setForm({ ...z }); setEditing(true); setOpen(true); }} onDelete={() => del(z)} />
            </td>
          </tr>
        ))}
      </Table>
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'تعديل منطقة' : 'إضافة منطقة جديدة'}>
        <div className="space-y-4">
          <Field label="كود المنطقة"><TextInput value={form.code} onChange={(e: any) => setForm({ ...form, code: e.target.value })} placeholder="Z-05" /></Field>
          <Field label="اسم المنطقة"><TextInput value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} placeholder="منطقة القصيم" /></Field>
          <Field label="المدير المسؤول"><TextInput value={form.manager} onChange={(e: any) => setForm({ ...form, manager: e.target.value })} placeholder="اسم المدير" /></Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Btn variant="outline" onClick={() => setOpen(false)}>إلغاء</Btn>
          <Btn variant="primary" onClick={save}>{editing ? 'حفظ التعديلات' : 'إضافة المنطقة'}</Btn>
        </div>
      </Modal>
      {toast.node}
    </div>
  );
}