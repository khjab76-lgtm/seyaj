import { useMemo, useState } from 'react';
import { Plus, Download, Printer, Search, ShieldCheck, PackageCheck } from 'lucide-react';
import { useStore } from '@/lib/store';
import { PageToolbar, Btn, Table, StatusBadge, Modal, Field, TextInput, Select, EmptyRow, useToast } from '@/components/ui-kit';

export default function Custody() {
  const { custodyRecords, custodyTemplate, employees, setCustodyRecords, addAuditLog, exportCSV } = useStore();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ employeeId: '', employeeName: '', department: custodyTemplate?.department || 'OPERATIONS', siteOrProject: '', date: new Date().toISOString().slice(0, 10), status: 'سليم', refCode: `DOC-OPS-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}` });

  const rows = useMemo(() => custodyRecords.filter((r: any) => !q || String(r.employeeName || '').includes(q) || String(r.employeeId || '').includes(q) || String(r.refCode || '').includes(q)), [custodyRecords, q]);
  const add = () => {
    if (!form.employeeId || !form.employeeName) { toast.show('اختر الموظف أولاً'); return; }
    const row = { ...form, id: form.refCode, employeeId: form.employeeId, createdAt: new Date().toISOString() };
    setCustodyRecords((p: any[]) => [row, ...p]);
    addAuditLog({ action: 'إضافة عهدة', module: 'custody', details: `إضافة محضر عهدة للموظف ${form.employeeName}`, entityId: form.refCode });
    setOpen(false); toast.show('تم حفظ محضر العهدة');
  };
  const print = (r: any) => { const w = window.open('', '_blank'); if (!w) return; w.document.write(`<html dir="rtl"><head><title>${r.refCode}</title></head><body style="font-family:Arial;padding:40px"><h1>${custodyTemplate.title}</h1><p>رقم المحضر: ${r.refCode}</p><p>الموظف: ${r.employeeName}</p><p>الرقم الوظيفي: ${r.employeeId}</p><p>المشروع/الموقع: ${r.siteOrProject || '—'}</p><p>التاريخ: ${r.date}</p><p>الحالة: ${r.status}</p><hr/><p>${custodyTemplate.termsText}</p><script>window.print()</script></body></html>`); w.document.close(); };

  return <div>
    <PageToolbar title="العهد والتجهيزات الأمنية" subtitle="إدارة محاضر الاستلام والتسليم وربطها بملف الموظف" actions={<><Btn variant="outline" onClick={() => exportCSV('custody.csv', rows)}><Download className="h-4 w-4"/>تصدير</Btn><Btn variant="gold" onClick={() => setOpen(true)}><Plus className="h-4 w-4"/>محضر عهدة جديد</Btn></>} />
    <div className="mb-4 flex items-center gap-2"><Search className="h-4 w-4 text-muted-foreground"/><TextInput value={q} onChange={(e:any)=>setQ(e.target.value)} placeholder="بحث بالموظف أو رقم المحضر..."/></div>
    <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3"><div className="rounded-xl border p-4"><div className="text-xs text-muted-foreground">إجمالي المحاضر</div><div className="text-2xl font-extrabold">{custodyRecords.length}</div></div><div className="rounded-xl border p-4"><div className="text-xs text-muted-foreground">عهد سليمة</div><div className="text-2xl font-extrabold">{custodyRecords.filter((r:any)=>r.status==='سليم').length}</div></div><div className="rounded-xl border p-4"><div className="text-xs text-muted-foreground">النموذج المعتمد</div><div className="text-sm font-bold mt-1"><ShieldCheck className="inline h-4 w-4 ml-1"/>{custodyTemplate.title}</div></div></div>
    <Table head={['رقم المحضر','الموظف','المشروع/الموقع','التاريخ','الحالة','إجراءات']}>
      {rows.length===0?<EmptyRow colSpan={6} text="لا توجد محاضر عهدة"/>:rows.map((r:any)=><tr key={r.id} className="hover:bg-muted/40"><td className="px-4 py-3 font-mono text-xs font-bold">{r.refCode}</td><td className="px-4 py-3"><div className="font-bold text-sm">{r.employeeName}</div><div className="text-[11px] text-muted-foreground">{r.employeeId}</div></td><td className="px-4 py-3 text-xs">{r.siteOrProject||'—'}</td><td className="px-4 py-3 text-xs">{r.date}</td><td className="px-4 py-3"><StatusBadge value={r.status}/></td><td className="px-4 py-3"><Btn size="sm" variant="outline" onClick={()=>print(r)}><Printer className="h-3.5 w-3.5"/>طباعة</Btn></td></tr>)}
    </Table>
    <Modal open={open} onClose={()=>setOpen(false)} title="محضر عهدة جديد" wide>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Field label="الموظف"><Select value={form.employeeId} onChange={(e:any)=>{const e1=employees.find((x:any)=>String(x.no||x.id)===String(e.target.value)); setForm({...form,employeeId:e.target.value,employeeName:e1?.name||e1?.full_name||''});}} options={[{value:'',label:'اختر الموظف'},...employees.map((e:any)=>({value:e.no||e.id,label:`${e.name||e.full_name||'—'} — ${e.no||e.employee_number||''}`}))]}/></Field><Field label="رقم المحضر"><TextInput value={form.refCode} onChange={(e:any)=>setForm({...form,refCode:e.target.value})}/></Field><Field label="المشروع / الموقع"><TextInput value={form.siteOrProject} onChange={(e:any)=>setForm({...form,siteOrProject:e.target.value})}/></Field><Field label="التاريخ"><TextInput type="date" value={form.date} onChange={(e:any)=>setForm({...form,date:e.target.value})}/></Field><Field label="حالة العهدة"><Select value={form.status} onChange={(e:any)=>setForm({...form,status:e.target.value})} options={['سليم','ناقص','تالف','مفقود'].map(x=>({value:x,label:x}))}/></Field></div>
      <div className="mt-5 flex justify-end gap-2"><Btn variant="outline" onClick={()=>setOpen(false)}>إلغاء</Btn><Btn variant="primary" onClick={add}><PackageCheck className="h-4 w-4"/>حفظ المحضر</Btn></div>
    </Modal>
    {toast.node}
  </div>;
}
