import { useMemo, useState } from 'react';
import { Plus, Trash2, ShieldCheck, Save } from 'lucide-react';
import { useStore } from '@/lib/store';
import { PageToolbar, Table, EmptyRow, Btn, Field, TextInput, Select, Modal, StatusBadge, useToast } from '@/components/ui-kit';
import { fmt } from '@/lib/seyaj';

export default function Settings() {
  const { allowances, setAllowanceAmount, addAllowance, removeAllowance, insurance, employees, sites, insuranceCrud } = useStore();
  const toast = useToast();
  const [newLabel, setNewLabel] = useState('');
  const [newAmount, setNewAmount] = useState('0');
  const [openIns, setOpenIns] = useState(false);
  const [insForm, setInsForm] = useState<any>({ employeeName: '', employeeId: '', project: '', site: '', company: '', monthlyDeduction: 180, status: 'مسجّل' });

  const totalDed = useMemo(() => allowances.filter((a: any) => a.kind === 'deduction').reduce((s: number, a: any) => s + a.amount, 0), [allowances]);

  const saveIns = () => {
    if (!insForm.employeeName || !insForm.company) { toast.show('أكمل اسم الموظف وشركة التأمين'); return; }
    insuranceCrud.add({ ...insForm, id: 0 });
    setOpenIns(false);
    toast.show('تم تسجيل التأمين');
  };

  return (
    <div>
      <PageToolbar title="إعدادات البدلات والخصومات والتأمينات" subtitle="قيم قابلة للتعديل تُطبق تلقائياً على التايم شيت وصافي الراتب" />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* البدلات والخصومات */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2 font-cairo text-sm font-bold"><ShieldCheck className="h-4 w-4 text-navy-900" /> البدلات والخصومات الشهرية</div>
            <StatusBadge value={'الإجمالي ' + fmt(totalDed) + ' ر.س'} />
          </div>
          <Table head={['البند', 'النوع', 'المبلغ (ر.س)', '']}>
            {allowances.map((a: any) => (
              <tr key={a.key} className="hover:bg-muted/40">
                <td className="px-4 py-2.5 font-bold">{a.label}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{a.kind === 'deduction' ? 'خصم' : 'بدل'}</td>
                <td className="px-4 py-2.5">
                  <TextInput type="number" value={a.amount} onChange={(e: any) => setAllowanceAmount(a.key, Number(e.target.value) || 0)} className="h-8 w-24" />
                </td>
                <td className="px-4 py-2.5">
                  <button onClick={() => removeAllowance(a.key)} className="rounded-md p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
                </td>
              </tr>
            ))}
          </Table>
          <div className="flex flex-wrap items-end gap-2 border-t p-4">
            <div className="flex-1"><Field label="بند جديد"><TextInput value={newLabel} onChange={(e: any) => setNewLabel(e.target.value)} placeholder="مثال: بدل مخاطر" /></Field></div>
            <div><Field label="المبلغ"><TextInput type="number" value={newAmount} onChange={(e: any) => setNewAmount(e.target.value)} className="w-28" /></Field></div>
            <Btn size="sm" onClick={() => {
              if (!newLabel) { toast.show('اكتب اسم البند'); return; }
              addAllowance({ key: ('custom_' + Date.now()) as any, label: newLabel, amount: Number(newAmount) || 0, kind: 'deduction' });
              setNewLabel(''); setNewAmount('0'); toast.show('أُضيف البند');
            }}><Plus className="h-4 w-4" /> إضافة</Btn>
          </div>
          <div className="border-t p-3 text-[11px] text-muted-foreground">
            القيم الافتراضية المعتمدة: بدلة عادية 200، بدلة رسمية 450، شعار 10، قايش 15، كاب 15، تعريف راتب 35 ر.س. أي تعديل هنا ينعكس فوراً على التايم شيت وتقارير الرواتب.
          </div>
        </div>

        {/* التأمينات */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="font-cairo text-sm font-bold">التأمينات — خصم مستقل لكل موظف</div>
            <Btn size="sm" onClick={() => setOpenIns(true)}><Plus className="h-4 w-4" /> تسجيل تأمين</Btn>
          </div>
          <Table head={['الموظف', 'الهوية', 'الشركة', 'الخصم الشهري', 'الحالة', '']}>
            {insurance.length ? insurance.map((r: any) => (
              <tr key={r.id} className="hover:bg-muted/40">
                <td className="px-4 py-2.5 font-bold">{r.employeeName}</td>
                <td className="px-4 py-2.5 num">{r.employeeId}</td>
                <td className="px-4 py-2.5">{r.company}</td>
                <td className="px-4 py-2.5">
                  <TextInput type="number" value={r.monthlyDeduction} onChange={(e: any) => insuranceCrud.update({ ...r, monthlyDeduction: Number(e.target.value) || 0 })} className="h-8 w-24" />
                </td>
                <td className="px-4 py-2.5"><StatusBadge value={r.status} /></td>
                <td className="px-4 py-2.5">
                  <button onClick={() => insuranceCrud.remove(r.id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
                </td>
              </tr>
            )) : <EmptyRow colSpan={6} />}
          </Table>
          <div className="border-t p-3 text-[11px] text-muted-foreground">
            يُخصم مبلغ التأمين الشهري لكل موظف بشكل مستقل من صافي الراتب، ويُظهره التقرير التفصيلي في عمود «التأمين».
          </div>
        </div>
      </div>
      {toast.node}

      <Modal open={openIns} onClose={() => setOpenIns(false)} title="تسجيل تأمين موظف" wide>
        <div className="grid grid-cols-2 gap-3">
          <Field label="الموظف">
            <Select value={insForm.employeeName} onChange={(e: any) => {
              const emp = employees.find((x: any) => x.name === e.target.value);
              const site = sites.find((s: any) => s.id === emp?.siteId);
              setInsForm({ ...insForm, employeeName: e.target.value, employeeId: emp ? '1' + String(emp.phone).replace(/\D/g, '').slice(1, 10) : '', site: site?.name ?? '' });
            }} options={[{ value: '', label: 'اختر الموظف...' }, ...employees.map((x: any) => ({ value: x.name, label: x.name }))]} />
          </Field>
          <Field label="رقم الهوية"><TextInput value={insForm.employeeId} onChange={(e: any) => setInsForm({ ...insForm, employeeId: e.target.value })} /></Field>
          <Field label="شركة التأمين"><TextInput value={insForm.company} onChange={(e: any) => setInsForm({ ...insForm, company: e.target.value })} placeholder="بوبا العربية" /></Field>
          <Field label="الخصم الشهري (ر.س)"><TextInput type="number" value={insForm.monthlyDeduction} onChange={(e: any) => setInsForm({ ...insForm, monthlyDeduction: Number(e.target.value) || 0 })} /></Field>
          <div className="col-span-2"><Field label="الموقع"><TextInput value={insForm.site} onChange={(e: any) => setInsForm({ ...insForm, site: e.target.value })} /></Field></div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Btn variant="outline" onClick={() => setOpenIns(false)}>إلغاء</Btn>
          <Btn onClick={saveIns}><Save className="h-4 w-4" /> حفظ</Btn>
        </div>
      </Modal>
    </div>
  );
}
