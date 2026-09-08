import { useState } from 'react';
import { Plus, Download, MapPin } from 'lucide-react';
import { useStore } from '@/lib/store';
import { PageToolbar, Btn, Table, StatusBadge, Modal, Field, TextInput, Select, RowActions, EmptyRow, useToast } from '@/components/ui-kit';

const emptySite: any = { code: '', name: '', zoneId: 1, address: '', lat: 24.7, lng: 46.7, status: 'تشغيل' };

export default function Sites() {
  const { sites, zones, employees, siteCrud, exportCSV } = useStore();
  const [q, setQ] = useState('');
  const [fZone, setFZone] = useState('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(emptySite);
  const [editing, setEditing] = useState(false);
  const toast = useToast();

  const zName = (id: number) => zones.find((z: any) => z.id === id)?.name || '—';
  const staff = (id: number) => employees.filter((e: any) => e.siteId === id).length;

  const rows = sites.filter((s: any) =>
    (q === '' || s.name.includes(q) || s.code.includes(q) || s.address.includes(q)) &&
    (fZone === 'all' || s.zoneId === Number(fZone))
  );

  const save = () => {
    if (!form.name.trim() || !form.code.trim()) { toast.show('كود واسم الموقع مطلوبان'); return; }
    if (editing) { siteCrud.update(form); toast.show('تم تحديث الموقع'); }
    else { siteCrud.add({ ...form, id: 0 }); toast.show('تمت إضافة الموقع'); }
    setOpen(false);
  };

  const del = (s: any) => {
    if (confirm('حذف الموقع «' + s.name + '»؟')) { siteCrud.remove(s.id); toast.show('تم حذف الموقع'); }
  };

  return (
    <div>
      <PageToolbar
        title="إدارة المواقع"
        subtitle={sites.length + ' موقع — ' + sites.filter((s: any) => s.status === 'تشغيل').length + ' عاملة'}
        actions={
          <>
            <Btn variant="outline" onClick={() => exportCSV('sites.csv', rows.map((r: any) => ({ الكود: r.code, الموقع: r.name, المنطقة: zName(r.zoneId), العنوان: r.address, الخط: r.lat, الطول: r.lng, الطاقم: staff(r.id), الحالة: r.status })))}>
              <Download className="h-4 w-4" /> تصدير CSV
            </Btn>
            <Btn variant="gold" onClick={() => { setForm({ ...emptySite }); setEditing(false); setOpen(true); }}>
              <Plus className="h-4 w-4" /> موقع جديد
            </Btn>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <TextInput placeholder="بحث بالاسم أو الكود أو العنوان..." value={q} onChange={(e: any) => setQ(e.target.value)} />
        <Select value={fZone} onChange={(e: any) => setFZone(e.target.value)} options={[{ value: 'all', label: 'كل المناطق' }, ...zones.map((z: any) => ({ value: z.id, label: z.name }))]} />
      </div>
      <Table head={['الموقع', 'الكود', 'المنطقة', 'العنوان', 'الإحداثيات', 'الطاقم', 'الحالة', 'إجراءات']}>
        {rows.length === 0 && <EmptyRow colSpan={8} />}
        {rows.map((s: any) => (
          <tr key={s.id} className="hover:bg-muted/40">
            <td className="px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-900 text-gold-400"><MapPin className="h-4 w-4" /></div>
                <div className="text-sm font-bold">{s.name}</div>
              </div>
            </td>
            <td className="num px-4 py-3 text-xs font-semibold text-navy-700">{s.code}</td>
            <td className="px-4 py-3 text-xs">{zName(s.zoneId)}</td>
            <td className="max-w-52 truncate px-4 py-3 text-xs text-muted-foreground">{s.address}</td>
            <td className="num px-4 py-3 text-[11px] text-muted-foreground">{s.lat}, {s.lng}</td>
            <td className="num px-4 py-3 text-xs font-bold">{staff(s.id)}</td>
            <td className="px-4 py-3"><StatusBadge value={s.status} /></td>
            <td className="px-4 py-3">
              <RowActions onEdit={() => { setForm({ ...s }); setEditing(true); setOpen(true); }} onDelete={() => del(s)} />
            </td>
          </tr>
        ))}
      </Table>
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'تعديل موقع' : 'إضافة موقع جديد'} wide>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="كود الموقع"><TextInput value={form.code} onChange={(e: any) => setForm({ ...form, code: e.target.value })} placeholder="S-009" /></Field>
          <Field label="اسم الموقع"><TextInput value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} placeholder="اسم الموقع" /></Field>
          <Field label="المنطقة"><Select value={form.zoneId} onChange={(e: any) => setForm({ ...form, zoneId: Number(e.target.value) })} options={zones.map((z: any) => ({ value: z.id, label: z.name }))} /></Field>
          <Field label="الحالة"><Select value={form.status} onChange={(e: any) => setForm({ ...form, status: e.target.value })} options={['تشغيل', 'صيانة', 'متوقف'].map((s) => ({ value: s, label: s }))} /></Field>
          <Field label="العنوان"><TextInput value={form.address} onChange={(e: any) => setForm({ ...form, address: e.target.value })} placeholder="الطريق، المدينة" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="خط العرض"><TextInput type="number" step="0.0001" value={form.lat} onChange={(e: any) => setForm({ ...form, lat: Number(e.target.value) })} /></Field>
            <Field label="خط الطول"><TextInput type="number" step="0.0001" value={form.lng} onChange={(e: any) => setForm({ ...form, lng: Number(e.target.value) })} /></Field>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Btn variant="outline" onClick={() => setOpen(false)}>إلغاء</Btn>
          <Btn variant="primary" onClick={save}>{editing ? 'حفظ التعديلات' : 'إضافة الموقع'}</Btn>
        </div>
      </Modal>
      {toast.node}
    </div>
  );
}