import { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Plus, Printer, MapPin } from 'lucide-react';
import { useStore } from '@/lib/store';
import { PageToolbar, Table, Btn, Field, TextInput, Select, Modal, StatusBadge, useToast } from '@/components/ui-kit';
import OfficialPaper from '@/components/OfficialPaper';
import { CHECKLIST_ITEMS, clientOf, arDate } from '@/lib/seyaj';
import { fetchFieldVisits, saveFieldVisitBackend } from '@/lib/hr';

const ACTOR = 'مدير النظام';

function emptyRow(no: number) {
  return { no, name: '', site: '', arrival: '', departure: '', uniform: 'ملتزم', clean: 'جيدة', guardSign: '', note: '' };
}

// فك JSON المخزن في الخادم بأمان
function parseJson(text: string, fallback: any) {
  try { const v = JSON.parse(text); return v ?? fallback; } catch { return fallback; }
}
// تحويل سجل الخادم إلى نموذج الصفحة
function fromBackend(r: any) {
  const evaluation = parseJson(r.evaluation, Object.fromEntries(CHECKLIST_ITEMS.map((i) => [i, false])));
  const rows = parseJson(r.rows_data, []);
  return {
    id: r.id, employeeCode: r.employee_code || '', project: r.project || '', site: r.site || '', siteCode: r.site_code || '', clientName: r.client_name || '',
    supervisorName: r.supervisor_name || '', visitDate: r.visit_date || '', shift: r.shift || '',
    rows: rows.length ? rows : [emptyRow(1)], evaluation,
    correctiveAction: r.corrective_action || '', notes: r.notes || '', branchManagerSign: r.branch_manager_sign || '',
    branchStamp: r.branch_stamp || '', status: r.status || 'مسودة',
  };
}

export default function FieldVisits() {
  const { sites, projects, employees } = useStore();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [form, setForm] = useState<any>(null);
  const [visits, setVisits] = useState<any[]>([]);

  const reload = () => fetchFieldVisits().then((rows) => setVisits(rows.map(fromBackend)));
  useEffect(() => { reload(); }, []);

  const newForm = () => {
    setForm({
      id: 0, employeeCode: '', project: '', site: '', siteCode: '', clientName: '', supervisorName: '', visitDate: '2026-09-01', shift: 'صباحية',
      rows: [emptyRow(1)],
      evaluation: Object.fromEntries(CHECKLIST_ITEMS.map((i) => [i, false])),
      correctiveAction: '', notes: '', branchManagerSign: '', branchStamp: '', status: 'مسودة',
    });
    setOpen(true);
  };

  const setSite = (siteName: string) => {
    const s = sites.find((x: any) => x.name === siteName);
    const p = projects.find((x: any) => x.siteId === s?.id);
    setForm((f: any) => ({ ...f, site: siteName, siteCode: s ? s.code : '', project: p ? p.name : f.project, clientName: p ? clientOf(p.id) : f.clientName }));
  };

  const save = async () => {
    if (!form.site || !form.supervisorName) { toast.show('حدد الموقع واسم المشرف'); return; }
    await saveFieldVisitBackend({
      employee_code: form.employeeCode || '', project: form.project || '', site: form.site || '', site_code: form.siteCode || '',
      client_name: form.clientName || '', supervisor_name: form.supervisorName, visit_date: form.visitDate || '',
      shift: form.shift || '', rows_data: JSON.stringify(form.rows), evaluation: JSON.stringify(form.evaluation),
      corrective_action: form.correctiveAction || '', notes: form.notes || '', branch_manager_sign: form.branchManagerSign || '',
      branch_stamp: form.branchStamp || '', status: form.status || 'مسودة',
    }, ACTOR);
    setOpen(false);
    toast.show('حُفظ نموذج المرور الميداني في الخادم');
    reload();
  };

  const updateRow = (i: number, patch: any) => setForm((f: any) => ({ ...f, rows: f.rows.map((r: any, j: number) => (j === i ? { ...r, ...patch } : r)) }));
  const addRow = () => setForm((f: any) => ({ ...f, rows: [...f.rows, emptyRow(f.rows.length + 1)] }));
  const delRow = (i: number) => setForm((f: any) => ({ ...f, rows: f.rows.filter((_: any, j: number) => j !== i).map((r: any, j: number) => ({ ...r, no: j + 1 })) }));
  const toggleEval = (item: string) => setForm((f: any) => ({ ...f, evaluation: { ...f.evaluation, [item]: !f.evaluation[item] } }));

  const meta = preview ? [
    { k: 'المشروع', v: preview.project }, { k: 'الموقع', v: preview.site + (preview.siteCode ? ' (' + preview.siteCode + ')' : '') },
    { k: 'الرقم الوظيفي', v: preview.employeeCode || '—' },
    { k: 'العميل', v: preview.clientName }, { k: 'المشرف', v: preview.supervisorName },
    { k: 'التاريخ', v: arDate(preview.visitDate) }, { k: 'الوردية', v: preview.shift },
  ] : [];

  const toolbarActions = (
    <Btn size="sm" onClick={newForm}><Plus className="h-4 w-4" /> نموذج مرور جديد</Btn>
  );

  return (
    <div>
      <PageToolbar title="المرور الميداني ونماذج التشييك" subtitle="التعرف التلقائي على الموقع، بنود قابلة للإضافة والتعديل، خلو سوابق وشهادة تدريب وخطاب تثبيت، توقيع مدير الفرع وختمه" actions={toolbarActions} />

      <Table head={['#', 'المشروع', 'الموقع', 'العميل', 'المشرف', 'التاريخ', 'الوردية', 'بنود غير مطابقة', 'توقيع مدير الفرع', 'الحالة', '']}>
        {visits.length ? visits.map((v: any, i: number) => {
          const bad = CHECKLIST_ITEMS.filter((c) => !v.evaluation[c]).length;
          return (
            <tr key={v.id} className="hover:bg-muted/40">
              <td className="px-4 py-2.5 num">{i + 1}</td>
              <td className="px-4 py-2.5 font-bold">{v.project}</td>
              <td className="px-4 py-2.5 text-xs">{v.site} <span className="text-muted-foreground num">({v.siteCode})</span>{v.employeeCode ? <div className="text-[10px] text-muted-foreground num">الموظف: {v.employeeCode}</div> : null}</td>
              <td className="px-4 py-2.5 text-xs">{v.clientName}</td>
              <td className="px-4 py-2.5">{v.supervisorName}</td>
              <td className="px-4 py-2.5 num">{v.visitDate}</td>
              <td className="px-4 py-2.5">{v.shift}</td>
              <td className="px-4 py-2.5">
                <StatusBadge value={bad ? bad + ' بنود ناقصة' : 'مطابق بالكامل'} />
              </td>
              <td className="px-4 py-2.5 text-xs">{v.branchManagerSign || '—'}</td>
              <td className="px-4 py-2.5"><StatusBadge value={v.status} /></td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-1">
                  <Btn size="sm" variant="outline" onClick={() => setPreview(v)}><Printer className="h-3.5 w-3.5" /> تقرير</Btn>
                </div>
              </td>
            </tr>
          );
        }) : <tr><td colSpan={11} className="py-10 text-center text-sm text-muted-foreground">لا توجد نماذج مرور — ابدأ نموذجاً جديداً من الزر أعلاه.</td></tr>}
      </Table>
      {toast.node}

      <Modal open={open} onClose={() => setOpen(false)} title="نموذج المرور الميداني والتشييك" wide>
        {form ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Field label="الموظف (يرتبط بالرقم الوظيفي)">
                <Select value={form.employeeCode} onChange={(e: any) => setForm({ ...form, employeeCode: e.target.value })} options={[{ value: '', label: 'اختر الموظف...' }, ...employees.map((x: any) => ({ value: x.no, label: `${x.name} (${x.no})` }))]} />
              </Field>
              <Field label="الموقع (يحدد المشروع والعميل تلقائياً)">
                <Select value={form.site} onChange={(e: any) => setSite(e.target.value)} options={[{ value: '', label: 'اختر الموقع...' }, ...sites.map((s: any) => ({ value: s.name, label: s.name }))]} />
              </Field>
              <Field label="اسم العميل"><TextInput value={form.clientName} onChange={(e: any) => setForm({ ...form, clientName: e.target.value })} /></Field>
              <Field label="اسم المشرف الزائر"><TextInput value={form.supervisorName} onChange={(e: any) => setForm({ ...form, supervisorName: e.target.value })} /></Field>
              <Field label="تاريخ الزيارة"><TextInput type="date" value={form.visitDate} onChange={(e: any) => setForm({ ...form, visitDate: e.target.value })} /></Field>
              <Field label="الوردية"><Select value={form.shift} onChange={(e: any) => setForm({ ...form, shift: e.target.value })} options={['صباحية', 'مسائية', 'ليلية'].map((v) => ({ value: v, label: v }))} /></Field>
              <Field label="الحالة"><Select value={form.status} onChange={(e: any) => setForm({ ...form, status: e.target.value })} options={['مسودة', 'مكتمل'].map((v) => ({ value: v, label: v }))} /></Field>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-bold text-muted-foreground">بنود الحراس (قابلة للإضافة والتعديل)</div>
                <Btn size="sm" variant="outline" onClick={addRow}><Plus className="h-3.5 w-3.5" /> بند</Btn>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-[11px]">
                  <thead className="bg-muted/50">
                    <tr>{['م', 'اسم الحارس', 'الموقع', 'الوصول', 'المغادرة', 'الزي', 'النظافة', 'توقيع الحارس', 'ملاحظات', ''].map((h) => (<th key={h} className="whitespace-nowrap px-2 py-1.5 text-right font-bold">{h}</th>))}</tr>
                  </thead>
                  <tbody className="divide-y">
                    {form.rows.map((r: any, i: number) => (
                      <tr key={i}>
                        <td className="px-2 py-1 num">{r.no}</td>
                        <td className="px-1 py-1"><TextInput className="h-7 min-w-28" value={r.name} onChange={(e: any) => updateRow(i, { name: e.target.value })} /></td>
                        <td className="px-1 py-1"><TextInput className="h-7 min-w-28" value={r.site || form.site} onChange={(e: any) => updateRow(i, { site: e.target.value })} /></td>
                        <td className="px-1 py-1"><TextInput type="time" className="h-7 w-24" value={r.arrival} onChange={(e: any) => updateRow(i, { arrival: e.target.value })} /></td>
                        <td className="px-1 py-1"><TextInput type="time" className="h-7 w-24" value={r.departure} onChange={(e: any) => updateRow(i, { departure: e.target.value })} /></td>
                        <td className="px-1 py-1"><Select className="h-7 w-24" value={r.uniform} onChange={(e: any) => updateRow(i, { uniform: e.target.value })} options={['ملتزم', 'غير ملتزم'].map((v) => ({ value: v, label: v }))} /></td>
                        <td className="px-1 py-1"><Select className="h-7 w-24" value={r.clean} onChange={(e: any) => updateRow(i, { clean: e.target.value })} options={['جيدة', 'متوسطة', 'سيئة'].map((v) => ({ value: v, label: v }))} /></td>
                        <td className="px-1 py-1"><TextInput className="h-7 w-16" value={r.guardSign} onChange={(e: any) => updateRow(i, { guardSign: e.target.value })} /></td>
                        <td className="px-1 py-1"><TextInput className="h-7 min-w-24" value={r.note} onChange={(e: any) => updateRow(i, { note: e.target.value })} /></td>
                        <td className="px-1 py-1"><button onClick={() => delRow(i)} className="text-rose-500 hover:text-rose-700">حذف</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-bold text-muted-foreground">بنود التقييم (تشييك)</div>
              <div className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-2">
                {CHECKLIST_ITEMS.map((item) => (
                  <label key={item} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!form.evaluation[item]} onChange={() => toggleEval(item)} className="h-4 w-4 accent-navy-900" />
                    <span>{item}</span>
                    <span className={'mr-auto rounded px-1.5 py-0.5 text-[10px] font-bold ' + (form.evaluation[item] ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600')}>
                      {form.evaluation[item] ? 'متوفر' : 'غير متوفر'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="الإجراء التصحيحي"><TextInput value={form.correctiveAction} onChange={(e: any) => setForm({ ...form, correctiveAction: e.target.value })} placeholder="مثال: طلب خطاب تثبيت عاجل" /></Field>
              <Field label="ملاحظات"><TextInput value={form.notes} onChange={(e: any) => setForm({ ...form, notes: e.target.value })} /></Field>
              <Field label="توقيع مدير الفرع"><TextInput value={form.branchManagerSign} onChange={(e: any) => setForm({ ...form, branchManagerSign: e.target.value })} /></Field>
              <Field label="ختم الفرع"><TextInput value={form.branchStamp} onChange={(e: any) => setForm({ ...form, branchStamp: e.target.value })} placeholder="مثال: الأهلي SNB - 1734" /></Field>
            </div>
          </div>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Btn variant="outline" onClick={() => setOpen(false)}>إلغاء</Btn>
          <Btn onClick={save}><ClipboardCheck className="h-4 w-4" /> حفظ النموذج</Btn>
        </div>
      </Modal>

      <Modal open={!!preview} onClose={() => setPreview(null)} title="تقرير المرور الميداني — رسمي" wide>
        {preview ? (
          <OfficialPaper title="نموذج المرور الميداني والتشييك" subtitle={'زيارة ' + arDate(preview.visitDate)} meta={meta}>
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr>{['م', 'اسم الحارس', 'الموقع', 'الوصول', 'المغادرة', 'الزي', 'النظافة', 'توقيع الحارس', 'ملاحظات'].map((h) => (<th key={h} className="border border-slate-300 bg-navy-900 px-2 py-1.5 text-white">{h}</th>))}</tr>
              </thead>
              <tbody>
                {preview.rows.map((r: any, i: number) => (
                  <tr key={i} className={i % 2 ? 'bg-slate-50' : ''}>
                    <td className="border border-slate-300 px-2 py-1.5 text-center num">{r.no}</td>
                    <td className="border border-slate-300 px-2 py-1.5">{r.name}</td>
                    <td className="border border-slate-300 px-2 py-1.5">{r.site}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-center num">{r.arrival}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-center num">{r.departure}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-center">{r.uniform}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-center">{r.clean}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-center">{r.guardSign}</td>
                    <td className="border border-slate-300 px-2 py-1.5">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4">
              <div className="mb-1 text-xs font-bold text-navy-900">نتيجة التشييك</div>
              <table className="w-full border-collapse text-[11px]">
                <tbody>
                  {CHECKLIST_ITEMS.map((item, i) => (
                    <tr key={item} className={i % 2 ? 'bg-slate-50' : ''}>
                      <td className="border border-slate-300 px-2 py-1">{item}</td>
                      <td className={'w-28 border border-slate-300 px-2 py-1 text-center font-bold ' + (preview.evaluation[item] ? 'text-emerald-700' : 'text-rose-600')}>
                        {preview.evaluation[item] ? 'متوفر' : 'غير متوفر'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded border border-slate-300 p-2"><span className="font-bold">الإجراء التصحيحي: </span>{preview.correctiveAction || '—'}</div>
              <div className="rounded border border-slate-300 p-2"><span className="font-bold">ملاحظات: </span>{preview.notes || '—'}</div>
            </div>

            <div className="mt-6 flex items-end justify-between gap-6 text-[11px]">
              <div className="flex-1 border-t border-slate-400 pt-1 text-center">توقيع مدير الفرع: {preview.branchManagerSign || '—'}</div>
              <div className="flex h-24 w-32 flex-col items-center justify-center gap-1 rounded-full border-2 border-dashed border-slate-400 text-center text-[9px] text-slate-500">
                <MapPin className="h-3 w-3" />
                <span>ختم الفرع</span>
                <span className="font-bold text-slate-600">{preview.branchStamp || '—'}</span>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-slate-500">يُرفق هذا النموذج بالتقرير الشهري للعميل بعد اعتماد مدير العمليات.</div>
          </OfficialPaper>
        ) : null}
      </Modal>
    </div>
  );
}