import { useState } from 'react';
import { Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { PageToolbar, Btn, Modal, Field, TextInput, TextArea, useToast } from '@/components/ui-kit';

const MODULES: any = {
  dashboard: 'لوحة التحكم', employees: 'الموظفون', attendance: 'الحضور', projects: 'المشاريع',
  sites: 'المواقع', zones: 'المناطق', requests: 'الطلبات', reports: 'التقارير', permissions: 'الصلاحيات',
};
const emptyRole: any = { name: '', desc: '', perms: ['dashboard'] };

export default function Roles() {
  const { roles, roleCrud } = useStore();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(emptyRole);
  const [editing, setEditing] = useState(false);
  const toast = useToast();

  const toggle = (k: string) =>
    setForm((f: any) => ({ ...f, perms: f.perms.includes(k) ? f.perms.filter((p: string) => p !== k) : [...f.perms, k] }));

  const save = () => {
    if (!form.name.trim()) { toast.show('اسم الدور مطلوب'); return; }
    if (editing) { roleCrud.update(form); toast.show('تم تحديث الدور'); }
    else { roleCrud.add({ ...form, id: 0 }); toast.show('تمت إضافة الدور'); }
    setOpen(false);
  };

  const del = (r: any) => {
    if (r.id === 1) { toast.show('لا يمكن حذف دور مدير النظام'); return; }
    if (confirm('حذف الدور «' + r.name + '»؟')) { roleCrud.remove(r.id); toast.show('تم حذف الدور'); }
  };

  return (
    <div>
      <PageToolbar
        title="الصلاحيات والأدوار"
        subtitle={roles.length + ' أدوار — تحكم دقيق في الوصول للوحدات'}
        actions={<Btn variant="gold" onClick={() => { setForm({ ...emptyRole, perms: ['dashboard'] }); setEditing(false); setOpen(true); }}><Plus className="h-4 w-4" /> دور جديد</Btn>}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {roles.map((r: any) => (
          <div key={r.id} className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-900 text-gold-400"><ShieldCheck className="h-5 w-5" /></div>
                <div>
                  <div className="font-cairo text-sm font-bold">{r.name}</div>
                  <div className="text-[11px] text-muted-foreground">{r.desc}</div>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setForm({ ...r, perms: [...r.perms] }); setEditing(true); setOpen(true); }} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><Plus className="h-3.5 w-3.5" /></button>
                <button onClick={() => del(r)} className="rounded-md p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {r.perms.map((p: string) => (
                <span key={p} className="rounded-md bg-gold-500/15 px-2 py-0.5 text-[11px] font-semibold text-gold-700 ring-1 ring-gold-500/25">{MODULES[p] || p}</span>
              ))}
            </div>
            <div className="mt-3 border-t pt-3 text-[11px] text-muted-foreground num">{r.perms.length} وحدة متاحة</div>
          </div>
        ))}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'تعديل دور' : 'إضافة دور جديد'} wide>
        <div className="space-y-4">
          <Field label="اسم الدور"><TextInput value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} placeholder="مثال: منسق جداول" /></Field>
          <Field label="الوصف"><TextArea value={form.desc} onChange={(e: any) => setForm({ ...form, desc: e.target.value })} placeholder="وصف صلاحيات الدور" /></Field>
          <div>
            <span className="mb-2 block text-xs font-semibold text-muted-foreground">الوحدات المتاحة</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Object.entries(MODULES).map(([k, label]: any) => (
                <label key={k} className={'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ' + (form.perms.includes(k) ? 'border-gold-500/40 bg-gold-500/10 text-gold-700' : 'hover:bg-muted')}>
                  <input type="checkbox" checked={form.perms.includes(k)} onChange={() => toggle(k)} className="h-3.5 w-3.5" />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Btn variant="outline" onClick={() => setOpen(false)}>إلغاء</Btn>
          <Btn variant="primary" onClick={save}>{editing ? 'حفظ التعديلات' : 'إضافة الدور'}</Btn>
        </div>
      </Modal>
      {toast.node}
    </div>
  );
}