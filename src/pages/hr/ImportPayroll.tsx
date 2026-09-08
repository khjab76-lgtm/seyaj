// ============================================================
// شاشة مستقلة: استيراد الرواتب من Excel — «سياج»
// يدعم البنية الكتلية الفعلية (تواريخ/مسيرات/فروع متعددة داخل نفس الملف).
// رفع ← معاينة ← مطابقة ← تحقق ← تأكيد ← سجل تاريخي مستقل لكل مسير.
// لا يستبدل ولا يحذف أي رواتب سابقة.
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowLeft, History, Download, Save, CalendarRange } from 'lucide-react';
import { PageToolbar, StatCard, Table, Btn, Field, Select, TextInput, EmptyRow, useToast } from '@/components/ui-kit';
import { PAY_FIELDS, readSheet, guessMapping, colOf, and, not, toEnDigits } from '@/lib/excelImport';
import {
  fetchImportedEmployees, fetchImportBatches, classifyPayroll, commitPayrollImport,
} from '@/lib/excelImportData';
import { getMe, downloadDoc } from '@/lib/backend';

const MONTHS = [
  { value: '1', label: 'يناير' }, { value: '2', label: 'فبراير' }, { value: '3', label: 'مارس' },
  { value: '4', label: 'أبريل' }, { value: '5', label: 'مايو' }, { value: '6', label: 'يونيو' },
  { value: '7', label: 'يوليو' }, { value: '8', label: 'أغسطس' }, { value: '9', label: 'سبتمبر' },
  { value: '10', label: 'أكتوبر' }, { value: '11', label: 'نوفمبر' }, { value: '12', label: 'ديسمبر' },
];
const STATUS_LABEL: any = { new: 'سجل جديد', error: 'خطأ', dup: 'مكرر', missing: 'بلا رقم' };
const STATUS_CLS: any = {
  new: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  error: 'bg-rose-50 text-rose-700 ring-rose-200',
  dup: 'bg-amber-50 text-amber-700 ring-amber-200',
  missing: 'bg-amber-50 text-amber-700 ring-amber-200',
};

function yearOptions(): any[] {
  const y = new Date().getFullYear();
  const out: any[] = [];
  for (let i = y + 1; i > y - 15; i--) out.push({ value: String(i), label: String(i) });
  return out;
}

export default function ImportPayroll() {
  const toast = useToast();
  const [file, setFile] = useState<any>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[][]>([]);
  const [mapping, setMapping] = useState<any>({});
  const [employees, setEmployees] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [actor, setActor] = useState('مدير النظام');

  const now = new Date();
  const [meta, setMeta] = useState<any>({
    pay_month: String(now.getMonth() + 1),
    pay_year: String(now.getFullYear()),
    run_date: '',
    run_no: '',
    branch: '',
  });

  useEffect(function () {
    fetchImportedEmployees().then(setEmployees);
    fetchImportBatches().then(setBatches);
    getMe().then(function (u: any) { if (u?.name) setActor(u.name); });
  }, []);

  const onFile = async function (f: any) {
    if (!f) return;
    setBusy(true);
    try {
      const res = await readSheet(f);
      setFile(f); setHeaders(res.headers); setRows(res.rows);
      setMapping(guessMapping(res.headers, res.rows, PAY_FIELDS, 'pay'));
      setDone(false);
      toast.show('تم قراءة الملف — راجع الفترة والمطابقة');
    } catch {
      toast.show('تعذر قراءة الملف. تأكد أنه بصيغة Excel صالحة');
    }
    setBusy(false);
  };

  const known = useMemo(function () {
    const codes: any = new Set();
    const names: any = new Map();
    for (const e of employees) { codes.add(String(e.employee_code)); names.set(String(e.employee_code), e.name); }
    return { codes, names };
  }, [employees]);

  const result = useMemo(function () {
    if (!rows.length) return { records: [], counts: { total: 0, new: 0, update: 0, error: 0, dup: 0, missing: 0, warn: 0 }, detected: {} };
    return classifyPayroll(rows, mapping, {
      pay_month: MONTHS.find(function (m: any) { return m.value === meta.pay_month; })?.label || meta.pay_month,
      pay_year: Number(meta.pay_year),
      run_date: meta.run_date, run_no: meta.run_no,
    }, known.codes, known.names);
  }, [rows, mapping, meta, known]);

  const detected = result.detected || {};
  const effRunNo = detected.run_no || meta.run_no;
  const effBranch = detected.branch || meta.branch;

  const setColField = function (col: number, field: string) {
    const next: any = { ...mapping };
    if (field) next[col] = field; else delete next[col];
    setMapping(next);
  };

  const colOptions = [{ value: '', label: '— تجاهل العمود —' }].concat(
    headers.map(function (h: string, i: number) { return { value: String(i), label: (i + 1) + '. ' + (h || 'عمود ' + i) }; }),
  );

  const shown = result.records
    .filter(function (r: any) { return statusFilter === 'all' ? true : r.status === statusFilter; })
    .slice(0, 60);

  const hasIssues = result.counts.error > 0 || result.counts.missing > 0;
  const canSave = and(file, result.counts.new > 0, not(hasIssues));

  const save = async function () {
    if (!file) return;
    setBusy(true);
    try {
      await commitPayrollImport(file, result.records, actor);
      setDone(true);
      setBatches(await fetchImportBatches());
      toast.show('تم حفظ السجل التاريخي للرواتب بنجاح');
    } catch {
      toast.show('فشل الحفظ، حاول مجددًا');
    }
    setBusy(false);
  };

  const reset = function () {
    setFile(null); setHeaders([]); setRows([]); setMapping({}); setDone(false); setStatusFilter('all');
  };

  return (
    <div>
      <PageToolbar
        title="استيراد الرواتب من Excel"
        subtitle="رفع مسيرات الرواتب (.xls/.xlsx) ببنيتها الكتلية — سجل تاريخي مستقل لكل شهر ومسير دون استبدال أو حذف الرواتب السابقة"
        actions={file ? <Btn variant="outline" onClick={reset}><ArrowLeft className="h-4 w-4" />ملف جديد</Btn> : null}
      />
      {toast.node}

      {!file ? (
        <label className="flex h-64 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-navy-900/30 bg-card text-sm text-muted-foreground shadow-sm transition hover:border-[#ED2024]/60 hover:bg-muted/40">
          <input type="file" accept=".xls,.xlsx" className="hidden" onChange={function (e: any) { onFile(e.target.files ? e.target.files[0] : null); }} />
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-900 text-gold-400"><Upload className="h-7 w-7" /></span>
          <span className="font-cairo text-base font-bold text-navy-900">اختر ملف مسيرات الرواتب</span>
          <span>يدعم الملفات الكتلية متعددة المسيرات — كل مسير يُحفظ كسجل تاريخي مستقل</span>
          {busy ? <span className="text-xs font-bold text-[#ED2024]">جارٍ القراءة...</span> : null}
        </label>
      ) : null}

      {file ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm shadow-sm">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            <span className="font-bold">{file.name}</span>
            <span className="text-muted-foreground">— {rows.length} صفاً — {headers.length} عموداً</span>
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 font-cairo text-sm font-extrabold text-navy-900"><CalendarRange className="h-4 w-4" />فترة المسير</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Field label="الشهر">
                <Select value={meta.pay_month} onChange={function (e: any) { setMeta({ ...meta, pay_month: e.target.value }); }} options={MONTHS} />
              </Field>
              <Field label="السنة">
                <Select value={meta.pay_year} onChange={function (e: any) { setMeta({ ...meta, pay_year: e.target.value }); }} options={yearOptions()} />
              </Field>
              <Field label="تاريخ الصرف">
                <TextInput type="date" value={meta.run_date} onChange={function (e: any) { setMeta({ ...meta, run_date: e.target.value }); }} />
              </Field>
              <Field label="رقم المسير">
                <TextInput value={meta.run_no} onChange={function (e: any) { setMeta({ ...meta, run_no: toEnDigits(e.target.value) }); }} placeholder="مثال: 12" />
              </Field>
              <Field label="الفرع / المشروع">
                <TextInput value={meta.branch} onChange={function (e: any) { setMeta({ ...meta, branch: e.target.value }); }} placeholder="اختياري" />
              </Field>
            </div>
            {and(detected.run_date, detected.run_no, detected.branch) ? (
              <p className="mt-2 text-xs text-emerald-700">
                اكتُشف تلقائيًا من الملف: تاريخ {detected.run_date} — مسير رقم {detected.run_no} — {detected.branch}. يُستخدم إن تُركت الحقول أعلاه فارغة.
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCard title="سجلات صالحة" value={result.counts.new} tone="success" icon={<CheckCircle2 className="h-5 w-5" />} />
            <StatCard title="خطأ جوهري" value={result.counts.error} tone="danger" icon={<AlertTriangle className="h-5 w-5" />} />
            <StatCard title="مكرر بالمسير" value={result.counts.dup} tone="warning" icon={<AlertTriangle className="h-5 w-5" />} />
            <StatCard title="بلا رقم موظف" value={result.counts.missing} tone="warning" icon={<AlertTriangle className="h-5 w-5" />} />
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h3 className="mb-3 font-cairo text-sm font-extrabold text-navy-900">مطابقة الأعمدة (اقتراح ذكي قابل للتعديل)</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {PAY_FIELDS.map(function (f: any) {
                const c = colOf(mapping, f.key);
                return (
                  <Field key={f.key} label={f.label}>
                    <Select
                      value={c == null ? '' : String(c)}
                      onChange={function (e: any) { if (e.target.value) setColField(Number(e.target.value), f.key); else setColField(-1, ''); }}
                      options={colOptions}
                    />
                  </Field>
                );
              })}
            </div>
          </div>

          {result.counts.warn > 0 ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
              <span className="font-bold text-amber-800">{result.counts.warn} سجل يحتوي تنبيهات (رقم غير موجود في قاعدة الموظفين أو اسم مختلف) — يمكن حفظها كمسار تاريخي.</span>
            </div>
          ) : null}

          {hasIssues ? (
            <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm">
              <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600" />
              <span className="font-bold text-rose-700">يوجد {result.counts.error} سجل بمبالغ غير رقمية و{result.counts.missing} بلا رقم موظف — لن تُحفظ هذه السجلات.</span>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {['all', 'new', 'error', 'dup', 'missing'].map(function (s: string) {
              const n = s === 'all' ? result.records.length : result.counts[s as any];
              return (
                <button key={s} onClick={function () { setStatusFilter(s); }}
                  className={'rounded-lg px-3 py-1.5 text-xs font-bold ring-1 transition ' + (statusFilter === s ? 'bg-navy-900 text-gold-400 ring-navy-900' : 'bg-card text-muted-foreground hover:bg-muted')}>
                  {s === 'all' ? 'الكل' : STATUS_LABEL[s]} ({n})
                </button>
              );
            })}
          </div>

          <Table head={['الصف', 'رقم الموظف', 'الاسم', 'الفرع/المشروع', 'الإجمالي', 'الخصومات', 'الصافي', 'الحالة', 'ملاحظات']}>
            {shown.length ? shown.map(function (r: any) {
              const d = r.data || {};
              return (
                <tr key={r.row} className={r.status === 'error' || r.status === 'missing' ? 'bg-rose-50/50' : ''}>
                  <td className="px-4 py-2 num text-muted-foreground">{r.row + 2}</td>
                  <td className="px-4 py-2 num font-bold">{d.employee_code || '—'}</td>
                  <td className="px-4 py-2">{d.employee_name || '—'}</td>
                  <td className="px-4 py-2">{d.branch || effBranch || '—'}</td>
                  <td className="px-4 py-2 num">{d.gross != null ? d.gross : '—'}</td>
                  <td className="px-4 py-2 num">{d.deductions_total != null ? d.deductions_total : '—'}</td>
                  <td className="px-4 py-2 num font-extrabold text-navy-900">{d.net != null ? d.net : '—'}</td>
                  <td className="px-4 py-2"><span className={'inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ' + (STATUS_CLS[r.status] || 'bg-muted text-muted-foreground ring-border')}>{STATUS_LABEL[r.status] || r.status}</span></td>
                  <td className="px-4 py-2 text-xs text-rose-600">{(r.errors || []).concat(r.warnings || []).join(' — ')}</td>
                </tr>
              );
            }) : <EmptyRow colSpan={9} />}
          </Table>

          {done ? (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
              <CheckCircle2 className="h-6 w-6" />
              تم حفظ سجل رواتب تاريخي جديد للفترة {meta.pay_month} {meta.pay_year} — لم تُستبدل أي رواتب سابقة.
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                سيُنشأ سجل تاريخي مستقل لكل موظف في هذه المسيرة، مرتبطة بالفرع {effBranch || 'غير محدد'} والمسير رقم {effRunNo || 'غير محدد'}.
              </p>
              <Btn variant="gold" onClick={save} disabled={busy || not(canSave)}>
                <Save className="h-4 w-4" />
                {busy ? 'جارٍ الحفظ...' : 'تأكيد وحفظ سجل تاريخي (' + result.counts.new + ' سجل)'}
              </Btn>
            </div>
          )}
        </div>
      ) : null}

      <div className="mt-6 rounded-xl border bg-card p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 font-cairo text-sm font-extrabold text-navy-900"><History className="h-4 w-4" />سجل عمليات الاستيراد</h3>
        <Table head={['#', 'الملف (مرفق)', 'النوع', 'الصفوف', 'جديد', 'خطأ', 'النتيجة', 'المستخدم', 'التاريخ', 'تنزيل']}>
          {batches.length ? batches.map(function (b: any) {
            return (
              <tr key={b.id}>
                <td className="px-4 py-2 num">{b.id}</td>
                <td className="px-4 py-2 font-bold">{b.file_name}</td>
                <td className="px-4 py-2">{b.data_type === 'employees' ? 'موظفون' : 'رواتب'}</td>
                <td className="px-4 py-2 num">{b.row_count}</td>
                <td className="px-4 py-2 num text-emerald-700">{b.new_count}</td>
                <td className="px-4 py-2 num text-rose-600">{b.error_count}</td>
                <td className="px-4 py-2 text-xs">{b.result}</td>
                <td className="px-4 py-2 text-xs">{b.uploaded_by}</td>
                <td className="px-4 py-2 text-xs num">{String(b.created_at || '').slice(0, 16).replace('T', ' ')}</td>
                <td className="px-4 py-2">
                  <button onClick={function () { downloadDoc(b.object_key); }} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-navy-900" title="تنزيل الملف الأصلي">
                    <Download className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            );
          }) : <EmptyRow colSpan={10} text="لا توجد عمليات استيراد بعد" />}
        </Table>
      </div>
    </div>
  );
}