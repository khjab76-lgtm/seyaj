// صفحة الموارد البشرية — الرواتب والبنوك ومسير الرواتب
// إنشاء مسير، اعتماده، وتوليد ملف البنك وفق النموذج:
// تاريخ الاستحقاق = اليوم التالي، التسلسل من 0001، رقم دفعة فريد، مرجع ملف، العملة SAR.
// الاستحقاق يُحتسب مباشرة من سجلات الحضور ودورة كل موقع عبر الإسنادات المتعددة،
// والخصومات تشمل مخالفات العمل المعتمدة والمخالفات المرورية المفعّلة.
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import {
  PageToolbar, StatCard, Table, Modal, Field, TextInput, Select, Btn,
  EmptyRow, StatusBadge, useToast,
} from '@/components/ui-kit';
import { Landmark, FileSpreadsheet, Plus, Check, Download, Building2, Send, ReceiptText } from 'lucide-react';
import {
  fetchPayrollRuns, fetchPayrollItems, createPayrollRun, approvePayrollRun,
  bankFileToCsv, downloadText, fetchBankAccounts, upsertBankAccount,
  nextDayISO, uniqueBatchNo, uniqueFileRef, FUTURE_INTEGRATIONS,
} from '@/lib/hr';
import { salaryOf, fmt } from '@/lib/seyaj';
import { fetchAssignments, fetchPayCycles, empAccrual, trafficDeductionOf, fetchTrafficViolations } from '@/lib/finance';
import { fetchAllAttendance } from '@/lib/backend';
import BankLetterView from '@/components/BankLetterView';

export default function Payroll() {
  const { employees, violations } = useStore();
  const toast = useToast();
  const [runs, setRuns] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [assigns, setAssigns] = useState<any[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [traffic, setTraffic] = useState<any[]>([]);
  const [slip, setSlip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [runOpen, setRunOpen] = useState(false);
  const [bankOpen, setBankOpen] = useState<any>(null);
  const [viewFile, setViewFile] = useState<any>(null);
  const [letter, setLetter] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [bankForm, setBankForm] = useState<any>({
    empId: '', bank_name: '', account_number: '', iban: '',
  });

  const reload = async () => {
    setLoading(true);
    const all = await Promise.all([
      fetchPayrollRuns(), fetchPayrollItems(), fetchBankAccounts(),
      fetchAssignments(), fetchPayCycles(), fetchAllAttendance(), fetchTrafficViolations(),
    ]);
    setRuns(all[0]); setItems(all[1]); setBanks(all[2]);
    setAssigns(all[3]); setCycles(all[4]); setLogs(all[5]); setTraffic(all[6]);
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  const bankOf = (code: string) => banks.find((b: any) => b.employee_code === code);
  const workDeductOf = (name: string) => violations
    .filter((v: any) => v.employeeName === name)
    .filter((v: any) => v.status === 'deducted')
    .reduce((s: number, v: any) => s + (v.amount || 0), 0);

  // الاستحقاق من كل إسنادات الموظف (أكثر من موقع/وردية براتب مختلف) محتسباً من الحضور ضمن دورة كل موقع
  const accrualOf = (e: any) => {
    const acc = empAccrual(e.no, assigns, logs, cycles);
    const gross = acc.lines.length ? acc.gross : salaryOf(e.job);
    return { ...acc, gross };
  };
  const totalDeductOf = (e: any) => workDeductOf(e.name) + trafficDeductionOf(e.no, traffic);

  // بنود المسير المقترحة: كل الموظفين النشطين، صافي = الاستحقاق من الحضور ناقص حسم المخالفات (عمل ومرور)
  const [picked, setPicked] = useState<string[]>([]);
  const activeEmps = useMemo(() => employees.filter((e: any) => e.status === 'نشط'), [employees]);
  const togglePick = (id: number) =>
    setPicked((p) => (p.includes(String(id)) ? p.filter((x) => x !== String(id)) : [...p, String(id)]));
  const pickAll = () => setPicked(activeEmps.map((e: any) => String(e.id)));

  const runRows = picked.map((id) => {
    const e = employees.find((x: any) => String(x.id) === id);
    if (!e) return null;
    const bank = bankOf(e.no);
    const gross = accrualOf(e).gross;
    const net = Math.max(0, gross - totalDeductOf(e));
    return {
      employee_code: e.no, employee_name: e.name,
      id_number: '1' + String(e.phone || '').replace(/\D/g, '').slice(1, 10),
      account_number: bank ? bank.account_number : '',
      amount: net,
    };
  }).filter(Boolean);

  const totalAmount = runRows.reduce((s: number, r: any) => s + (r.amount || 0), 0);
  const slipAcc = slip ? accrualOf(slip) : null;
  const slipDed = slip ? totalDeductOf(slip) : 0;

  const saveRun = async () => {
    if (!runRows.length) { toast.show('اختر موظفاً واحداً على الأقل'); return; }
    const missing = runRows.filter((r: any) => !r.account_number);
    if (missing.length) { toast.show(`لا يوجد حساب بنكي لـ ${missing.length} موظف — سجّل الحسابات أولاً`); return; }
    setBusy(true);
    const batch = uniqueBatchNo();
    await createPayrollRun({
      batch_no: batch, due_date: nextDayISO(), file_ref: uniqueFileRef(),
      currency: 'SAR', employees_count: runRows.length, total_amount: totalAmount,
      created_by: 'مدير النظام',
    }, runRows);
    setBusy(false); setRunOpen(false); setPicked([]);
    toast.show('تم إنشاء المسير (مسودة) — اعتمده لتوليد ملف البنك');
    reload();
  };

  const approve = async (run: any) => {
    setBusy(true);
    const file = await approvePayrollRun(run, 'مدير النظام');
    setBusy(false);
    toast.show('تم الاعتماد وتوليد ملف البنك');
    setViewFile(file);
    reload();
  };

  const saveBank = async () => {
    const e = employees.find((x: any) => String(x.id) === bankForm.empId);
    if (!e) { toast.show('اختر الموظف'); return; }
    if (!bankForm.bank_name || !bankForm.account_number) { toast.show('البنك ورقم الحساب إلزاميان'); return; }
    setBusy(true);
    await upsertBankAccount({
      employee_code: e.no, employee_name: e.name,
      bank_name: bankForm.bank_name, account_number: bankForm.account_number,
      iban: bankForm.iban,
    }, 'مدير النظام');
    setBusy(false); setBankOpen(null);
    toast.show('تم حفظ الحساب البنكي');
    reload();
  };

  const exportRunCsv = (run: any) => {
    const rows = items.filter((i: any) => i.batch_no === run.batch_no);
    downloadText(`payroll-${run.batch_no}.csv`, '\ufeff' + ['serial_no,employee_code,employee_name,id_number,account_number,amount,currency',
      ...rows.map((r: any) => `${r.serial_no},${r.employee_code},"${r.employee_name}",${r.id_number},${r.account_number},${r.amount},${r.currency}`)].join('\n'));
  };

  return (
    <div>
      {toast.node}
      <PageToolbar
        title="الرواتب والبنوك ومسير الرواتب"
        subtitle="الاستحقاق مرتبط مباشرة بالحضور ودورة كل موقع — مسير شهري معتمد يولّد ملف البنك وفق النموذج الرسمي (SAR، تسلسل من 0001، استحقاق اليوم التالي)"
        actions={
          <>
            <Btn variant="outline" size="sm" onClick={() => { setBankForm({ empId: '', bank_name: '', account_number: '', iban: '' }); setBankOpen({}); }}>
              <Landmark className="h-4 w-4" /> حساب بنكي
            </Btn>
            <Btn size="sm" onClick={() => { setPicked([]); setRunOpen(true); }}><Plus className="h-4 w-4" /> مسير جديد</Btn>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="مسيرات" value={runs.length} icon={<FileSpreadsheet className="h-5 w-5" />} tone="navy" />
        <StatCard title="معتمدة" value={runs.filter((r: any) => r.status === 'approved').length} icon={<Check className="h-5 w-5" />} tone="success" />
        <StatCard title="حسابات بنكية" value={banks.length} icon={<Landmark className="h-5 w-5" />} tone="info" />
        <StatCard title="إجمالي مصروف" value={fmt(runs.filter((r: any) => r.status === 'approved').reduce((s: number, r: any) => s + (r.total_amount || 0), 0))} hint="SAR" icon={<Building2 className="h-5 w-5" />} tone="gold" />
      </div>

      <h3 className="mb-2 font-cairo text-lg font-bold">مسيرات الرواتب</h3>
      <Table head={['رقم الدفعة', 'تاريخ الاستحقاق', 'مرجع الملف', 'الموظفون', 'الإجمالي (SAR)', 'الحالة', 'إجراءات']}>
        {loading ? <EmptyRow colSpan={7} text="جارٍ التحميل..." /> : runs.length === 0 ? <EmptyRow colSpan={7} text="لا توجد مسيرات — أنشئ مسيراً جديداً" /> :
          runs.map((r: any) => (
            <tr key={r.id}>
              <td className="px-4 py-2.5 font-mono text-xs font-bold">{r.batch_no}</td>
              <td className="px-4 py-2.5">{r.due_date}</td>
              <td className="px-4 py-2.5 font-mono text-xs">{r.file_ref}</td>
              <td className="px-4 py-2.5 num">{r.employees_count}</td>
              <td className="px-4 py-2.5 num font-bold">{fmt(r.total_amount)}</td>
              <td className="px-4 py-2.5"><StatusBadge value={r.status === 'approved' ? 'معتمد' : r.status === 'sent' ? 'مكتمل' : 'معلق'} /></td>
              <td className="px-4 py-2.5">
                <div className="flex gap-1">
                  {r.status === 'draft' ? (
                    <Btn size="sm" variant="success" disabled={busy} onClick={() => approve(r)}><Check className="h-3.5 w-3.5" /> اعتماد وملف بنك</Btn>
                  ) : null}
                  {r.bank_file_json ? (
                    <Btn size="sm" variant="outline" onClick={() => setViewFile(JSON.parse(r.bank_file_json))}><FileSpreadsheet className="h-3.5 w-3.5" /> الملف</Btn>
                  ) : (
                    <Btn size="sm" variant="outline" onClick={() => exportRunCsv(r)}><Download className="h-3.5 w-3.5" /> CSV</Btn>
                  )}
                </div>
              </td>
            </tr>
          ))}
      </Table>

      <h3 className="mb-2 mt-6 font-cairo text-lg font-bold">الحسابات البنكية للموظفين</h3>
      <Table head={['الموظف', 'الرقم الوظيفي', 'البنك', 'رقم الحساب', 'الآيبان', 'العملة', 'آخر تحديث', 'إجراء']}>
        {banks.length === 0 ? <EmptyRow colSpan={8} text="لم تُسجَّل حسابات بنكية بعد" /> : banks.map((b: any) => (
          <tr key={b.id}>
            <td className="px-4 py-2.5 font-bold text-navy-900">{b.employee_name}</td>
            <td className="px-4 py-2.5">{b.employee_code}</td>
            <td className="px-4 py-2.5">{b.bank_name}</td>
            <td className="px-4 py-2.5 font-mono text-xs">{b.account_number}</td>
            <td className="px-4 py-2.5 font-mono text-xs">{b.iban || '—'}</td>
            <td className="px-4 py-2.5">{b.currency || 'SAR'}</td>
            <td className="px-4 py-2.5 text-xs">{b.changed_at || '—'}</td>
            <td className="px-4 py-2.5">
              <Btn size="sm" variant="outline" onClick={() => setLetter(b)}><Send className="h-3.5 w-3.5" /> خطاب بنكي</Btn>
            </td>
          </tr>
        ))}
      </Table>

      <div className="mt-6 rounded-xl border bg-card p-4">
        <h3 className="mb-2 font-cairo text-base font-bold">التكامل المستقبلي</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {FUTURE_INTEGRATIONS.map((it) => (
            <div key={it.key} className="rounded-lg bg-slate-50 p-3 text-xs ring-1 ring-slate-200">
              <div className="font-bold text-navy-900">{it.label}</div>
              <div className="mt-0.5 text-muted-foreground">{it.desc}</div>
              <span className="mt-1 inline-block rounded bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-700 ring-1 ring-amber-200">{it.status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* إنشاء مسير */}
      <Modal open={runOpen} onClose={() => setRunOpen(false)} title="مسير رواتب جديد" wide>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">اختر الموظفين المشمولين بالمسير — الاستحقاق من الحضور حسب دورة كل موقع، والصافي = الاستحقاق ناقص حسم المخالفات (عمل ومرور).</p>
          <Btn size="sm" variant="outline" onClick={pickAll}>تحديد الكل ({activeEmps.length})</Btn>
        </div>
        <div className="max-h-72 overflow-y-auto rounded-lg ring-1 ring-slate-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted"><tr>
              <th className="w-10 p-2"></th><th className="p-2 text-right">الموظف</th><th className="p-2 text-right">الحساب</th><th className="p-2 text-right">الاستحقاق</th><th className="p-2 text-right">حسم</th><th className="p-2 text-right">الصافي</th><th className="p-2 text-right">كشف</th>
            </tr></thead>
            <tbody>
              {activeEmps.map((e: any) => {
                const bank = bankOf(e.no);
                const gross = accrualOf(e).gross;
                const ded = totalDeductOf(e);
                return (
                  <tr key={e.id} className="border-t">
                    <td className="p-2 text-center"><input type="checkbox" checked={picked.includes(String(e.id))} onChange={() => togglePick(e.id)} /></td>
                    <td className="p-2 font-bold">{e.name}<div className="text-[10px] font-normal text-muted-foreground">{e.no}</div></td>
                    <td className="p-2 font-mono text-xs">{bank ? bank.account_number : <span className="text-rose-600">غير مسجّل</span>}</td>
                    <td className="p-2 num">{fmt(gross)}</td>
                    <td className="p-2 num text-rose-600">{ded ? `-${fmt(ded)}` : '—'}</td>
                    <td className="p-2 num font-bold">{fmt(Math.max(0, gross - ded))}</td>
                    <td className="p-2"><Btn size="sm" variant="ghost" onClick={() => setSlip(e)}><ReceiptText className="h-3.5 w-3.5" /></Btn></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span>المحدد: <b className="num">{runRows.length}</b> — الإجمالي: <b className="num text-navy-900">{fmt(totalAmount)} SAR</b></span>
          <span className="text-xs text-muted-foreground">تاريخ الاستحقاق: {nextDayISO()} (اليوم التالي)</span>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setRunOpen(false)}>إلغاء</Btn>
          <Btn disabled={busy} onClick={saveRun}>{busy ? 'جارٍ الحفظ...' : 'حفظ كمسودة'}</Btn>
        </div>
      </Modal>

      {/* كشف راتب تفصيلي — لكل إسناد: موقع ووردية ودورة وأيام حضور ويومي وأساسي وإضافي */}
      <Modal open={!!slip} onClose={() => setSlip(null)} title={`كشف راتب — ${slip ? slip.name : ''}`} wide>
        {slipAcc ? (
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-3 text-xs ring-1 ring-slate-200">
              <span><b className="text-navy-900">{slip.name}</b> — {slip.no}</span>
              <span>المسمى: {slip.job}</span>
              <span>الاستحقاق: <b className="num">{fmt(slipAcc.gross)} SAR</b></span>
              <span className="text-rose-600">الحسم: <b className="num">{fmt(slipDed)} SAR</b></span>
              <span>الصافي: <b className="num text-navy-900">{fmt(Math.max(0, slipAcc.gross - slipDed))} SAR</b></span>
            </div>
            {slipAcc.lines.length === 0 ? (
              <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-amber-200">لا توجد إسنادات نشطة لهذا الموظف — يُعتمد الراتب الافتراضي حسب المسمى ({fmt(salaryOf(slip.job))} SAR).</p>
            ) : (
              <Table head={['الموقع', 'المشروع', 'الوظيفة', 'الوردية', 'نوع الأجر', 'دورة الاحتساب', 'أيام الحضور', 'يومي (SAR)', 'أساسي', 'إضافي', 'الإجمالي']}>
                {slipAcc.lines.map((l: any, i: number) => (
                  <tr key={i}>
                    <td className="px-3 py-2 font-bold text-navy-900">{l.site}</td>
                    <td className="px-3 py-2 text-xs">{l.project}</td>
                    <td className="px-3 py-2 text-xs">{l.role}</td>
                    <td className="px-3 py-2 text-xs">{l.shift}</td>
                    <td className="px-3 py-2 text-xs">{l.pay_basis === 'daily' ? 'يومي' : 'شهري'}</td>
                    <td className="px-3 py-2 font-mono text-[11px]">{l.range}</td>
                    <td className="px-3 py-2 num">{l.days}</td>
                    <td className="px-3 py-2 num">{fmt(l.daily)}</td>
                    <td className="px-3 py-2 num">{fmt(l.base)}</td>
                    <td className="px-3 py-2 num">{fmt(l.ot)}</td>
                    <td className="px-3 py-2 num font-bold">{fmt(l.total)}</td>
                  </tr>
                ))}
              </Table>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">الأيام محتسبة فعلياً من سجلات الحضور ضمن نطاق دورة كل موقع (حاضر أو متأخر أو منصرف = يوم عمل، غائب = صفر). الخصومات تشمل مخالفات العمل المعتمدة والمخالفات المرورية المفعّلة.</p>
          </div>
        ) : null}
      </Modal>

      {/* حساب بنكي */}
      <Modal open={!!bankOpen} onClose={() => setBankOpen(null)} title="تسجيل / تحديث حساب بنكي">
        <div className="grid grid-cols-1 gap-3">
          <Field label="الموظف">
            <Select value={bankForm.empId} onChange={(e: any) => setBankForm({ ...bankForm, empId: e.target.value })} options={[
              { value: '', label: '— اختر —' },
              ...employees.map((e: any) => ({ value: String(e.id), label: `${e.name} (${e.no})` })),
            ]} />
          </Field>
          <Field label="اسم البنك">
            <Select value={bankForm.bank_name} onChange={(e: any) => setBankForm({ ...bankForm, bank_name: e.target.value })} options={[
              { value: '', label: '— اختر —' },
              ...['البنك الأهلي السعودي', 'مصرف الراجحي', 'بنك الرياض', 'بنك البلاد', 'البنك العربي', 'مصرف الإنماء', 'بنك الجزيرة', 'أخرى'].map((b) => ({ value: b, label: b })),
            ]} />
          </Field>
          <Field label="رقم الحساب"><TextInput value={bankForm.account_number} onChange={(e: any) => setBankForm({ ...bankForm, account_number: e.target.value })} /></Field>
          <Field label="الآيبان IBAN (اختياري)"><TextInput value={bankForm.iban} onChange={(e: any) => setBankForm({ ...bankForm, iban: e.target.value })} placeholder="SA00 0000 ..." /></Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setBankOpen(null)}>إلغاء</Btn>
          <Btn disabled={busy} onClick={saveBank}>{busy ? 'جارٍ الحفظ...' : 'حفظ'}</Btn>
        </div>
      </Modal>

      {/* معاينة ملف البنك */}
      <Modal open={!!viewFile} onClose={() => setViewFile(null)} title="ملف البنك المعتمد" wide>
        {viewFile ? (
          <div>
            <div className="mb-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-xs ring-1 ring-slate-200 sm:grid-cols-4">
              <div><div className="text-slate-400">رقم الدفعة</div><div className="font-mono font-bold">{viewFile.paymentNo}</div></div>
              <div><div className="text-slate-400">مرجع الملف</div><div className="font-mono font-bold">{viewFile.fileRef}</div></div>
              <div><div className="text-slate-400">تاريخ الاستحقاق</div><div className="font-bold">{viewFile.dueDate}</div></div>
              <div><div className="text-slate-400">العملة</div><div className="font-bold">{viewFile.currency}</div></div>
            </div>
            <Table head={['التسلسل', 'الرقم الوظيفي', 'الموظف', 'الهوية', 'الحساب', 'المبلغ']}>
              {viewFile.rows.map((r: any) => (
                <tr key={r.serial_no}>
                  <td className="px-4 py-2 font-mono">{r.serial_no}</td>
                  <td className="px-4 py-2">{r.employee_code}</td>
                  <td className="px-4 py-2 font-bold">{r.employee_name}</td>
                  <td className="px-4 py-2 font-mono text-xs">{r.id_number}</td>
                  <td className="px-4 py-2 font-mono text-xs">{r.account_number}</td>
                  <td className="px-4 py-2 num font-bold">{fmt(r.amount)}</td>
                </tr>
              ))}
            </Table>
            <div className="mt-4 flex justify-end gap-2">
              <Btn variant="outline" onClick={() => downloadText(`bank-file-${viewFile.batchNo}.csv`, bankFileToCsv(viewFile))}><Download className="h-4 w-4" /> تنزيل ملف البنك</Btn>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">الرفع المباشر للبنك غير مفعّل — يُنزَّل الملف ويرفع عبر القناة المعتمدة حتى تزويد مفاتيح التكامل.</p>
          </div>
        ) : null}
      </Modal>

      {/* خطاب بنكي */}
      <Modal open={!!letter} onClose={() => setLetter(null)} title="خطاب بنكي" wide>
        {letter ? (
          <BankLetterView bank={letter} employees={employees} />
        ) : null}
      </Modal>
    </div>
  );
}