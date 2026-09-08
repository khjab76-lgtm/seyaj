// ============================================================
// شاشة مستقلة: استيراد بيانات الموظفين من Excel — «سياج»
// رفع ← معاينة ← مطابقة ذكية ← تعديل يدوي ← تحقق ← تأكيد ← حفظ تاريخي
// + مرفق الملف الأصلي + سجل العمليات. لا تغيّر أي واجهة قائمة.
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowLeft, History, Download, Save } from 'lucide-react';
import { PageToolbar, StatCard, Table, Btn, Field, Select, EmptyRow, useToast } from '@/components/ui-kit';
import { EMP_FIELDS, readSheet, guessMapping, colOf } from '@/lib/excelImport';
import { fetchImportedEmployees, classifyEmployees, commitEmployeeImport, fetchImportBatches } from '@/lib/excelImportData';
import { getMe, downloadDoc } from '@/lib/backend';

const STATUS_LABEL: any = { new: 'جديد', update: 'تحديث', error: 'خطأ', dup: 'مكرر', missing: 'بلا رقم' };
const STATUS_CLS: any = {
  new: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  update: 'bg-sky-50 text-sky-700 ring-sky-200',
  error: 'bg-rose-50 text-rose-700 ring-rose-200',
  dup: 'bg-amber-50 text-amber-700 ring-amber-200',
  missing: 'bg-amber-50 text-amber-700 ring-amber-200',
};

export default function ImportEmployees() {
  const toast = useToast();
  const [file, setFile] = useState<any>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[][]>([]);
  const [mapping, setMapping] = useState<any>({});
  const [existing, setExisting] = useState<any[]>([]);
  const [mode, setMode] = useState('add');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [batches, setBatches] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [actor, setActor] = useState('مدير النظام');

  useEffect(function () {
    fetchImportedEmployees().then(setExisting);
    fetchImportBatches().then(setBatches);
    getMe().then(function (u: any) { if (u?.name) setActor(u.name); });
  }, []);

  const onFile = async function (f: any) {
    if (!f) return;
    setBusy(true);
    try {
      const res = await readSheet(f);
      setFile(f); setHeaders(res.headers); setRows(res.rows);
      setMapping(guessMapping(res.headers, res.rows, EMP_FIELDS, 'emp'));
      setDone(false); setAgreed(false);
      toast.show('تم قراءة الملف — راجع مطابقة الأعمدة');
    } catch {
      toast.show('تعذر قراءة الملف. تأكد أنه بصيغة Excel صالحة');
    }
    setBusy(false);
  };

  const existingMap = useMemo(function () {
    const m: any = new Map();
    for (const e of existing) m.set(String(e.employee_code), e);
    return m;
  }, [existing]);

  const result = useMemo(function () {
    if (!rows.length) return { records: [], counts: { total: 0, new: 0, update: 0, error: 0, dup: 0, missing: 0, warn: 0 } };
    return classifyEmployees(rows, mapping, existingMap);
  }, [rows, mapping, existingMap]);

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

  const save = async function () {
    if (!file) return;
    setBusy(true);
    try {
      await commitEmployeeImport(file, result.records, mode, actor);
      setDone(true);
      setBatches(await fetchImportBatches());
      setExisting(await fetchImportedEmployees());
      toast.show('تم الحفظ في السجل التاريخي بنجاح');
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
        title="استيراد بيانات الموظفين من Excel"
        subtitle="رفع ملف الموظفين (.xls/.xlsx) مع المطابقة الذكية والتحقق والحفظ التاريخي — رقم الموظف هو مفتاح الربط"
        actions={file ? <Btn variant="outline" onClick={reset}><ArrowLeft className="h-4 w-4" />ملف جديد</Btn> : null}
      />
      {toast.node}

      {!file ? (
        <label className="flex h-64 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-navy-900/30 bg-card text-sm text-muted-foreground shadow-sm transition hover:border-[#ED2024]/60 hover:bg-muted/40">
          <input type="file" accept=".xls,.xlsx" className="hidden" onChange={function (e: any) { onFile(e.target.files ? e.target.files[0] : null); }} />
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-900 text-gold-400"><Upload className="h-7 w-7" /></span>
          <span className="font-cairo text-base font-bold text-navy-900">اختر ملف Excel لاستيراد الموظفين</span>
          <span>يدعم .xls و .xlsx — سيُحفظ الملف الأصلي كمرفق مع عملية الاستيراد</span>
          {busy ? <span className="text-xs font-bold text-[#ED2024]">جارٍ القراءة...</span> : null}
        </label>
      ) : null}

      {file ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm shadow-sm">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            <span className="font-bold">{file.name}</span>
            <span className="text-muted-foreground">— {rows.length} صفاً — {headers.length} عموداً</span>
            <span className="mr-auto flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">نمط الحفظ:</span>
              <Select
                className="!h-8 !w-56"
                value={mode}
                onChange={function (e: any) { setMode(e.target.value); }}
                options={[
                  { value: 'add', label: 'إضافة فقط (تجاهل الموجود)' },
                  { value: 'update', label: 'تحديث الموجود وإضافة الجديد' },
                ]}
              />
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <StatCard title="جديد" value={result.counts.new} tone="success" icon={<CheckCircle2 className="h-5 w-5" />} />
            <StatCard title="تحديث" value={result.counts.update} tone="info" icon={<Save className="h-5 w-5" />} />
            <StatCard title="خطأ جوهري" value={result.counts.error} tone="danger" icon={<AlertTriangle className="h-5 w-5" />} />
            <StatCard title="مكرر بالملف" value={result.counts.dup} tone="warning" icon={<AlertTriangle className="h-5 w-5" />} />
            <StatCard title="بلا رقم موظف" value={result.counts.missing} tone="warning" icon={<AlertTriangle className="h-5 w-5" />} />
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h3 className="mb-3 font-cairo text-sm font-extrabold text-navy-900">مطابقة الأعمدة (اقتراح ذكي قابل للتعديل)</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {EMP_FIELDS.map(function (f: any) {
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

          {hasIssues ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm">
              <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600" />
              <span className="font-bold text-rose-700">يوجد {result.counts.error} سجل خاطئ و{result.counts.missing} بلا رقم موظف — لن تُحفظ هذه السجلات.</span>
              <label className="mr-auto flex items-center gap-2 text-xs font-bold text-rose-800">
                <input type="checkbox" checked={agreed} onChange={function (e: any) { setAgreed(e.target.checked); }} />
                أوافق على استبعاد السجلات الخاطئة والمتابعة
              </label>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {['all', 'new', 'update', 'error', 'dup', 'missing'].map(function (s: string) {
              const n = s === 'all' ? result.records.length : result.counts[s as any];
              return (
                <button key={s} onClick={function () { setStatusFilter(s); }}
                  className={'rounded-lg px-3 py-1.5 text-xs font-bold ring-1 transition ' + (statusFilter === s ? 'bg-navy-900 text-gold-400 ring-navy-900' : 'bg-card text-muted-foreground hover:bg-muted')}>
                  {s === 'all' ? 'الكل' : STATUS_LABEL[s]} ({n})
                </button>
              );
            })}
          </div>

          <Table head={['الصف', 'رقم الموظف', 'الاسم', 'الوظيفة', 'القسم', 'تاريخ التوظيف', 'الحالة', 'ملاحظات']}>
            {shown.length ? shown.map(function (r: any) {
              const d = r.data || {};
              return (
                <tr key={r.row} className={r.status === 'error' || r.status === 'missing' ? 'bg-rose-50/50' : ''}>
                  <td className="px-4 py-2 num text-muted-foreground">{r.row + 2}</td>
                  <td className="px-4 py-2 num font-bold">{d.employee_code || '—'}</td>
                  <td className="px-4 py-2">{d.name || '—'}</td>
                  <td className="px-4 py-2">{d.job || '—'}</td>
                  <td className="px-4 py-2">{d.department || '—'}</td>
                  <td className="px-4 py-2 num">{d.hire_date || '—'}</td>
                  <td className="px-4 py-2"><span className={'inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ' + STATUS_CLS[r.status]}>{STATUS_LABEL[r.status]}</span></td>
                  <td className="px-4 py-2 text-xs text-rose-600">{(r.errors || []).concat(r.warnings || []).join(' — ')}</td>
                </tr>
              );
            }) : <EmptyRow colSpan={8} />}
          </Table>

          {done ? (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
              <CheckCircle2 className="h-6 w-6" />
              تم الحفظ التاريخي للدفعة. الملف الأصلي مرفق بالسحابة، والنتيجة مسجلة في سجل العمليات بالأسفل.
            </div>
          ) : (
            <div className="flex justify-end">
              <Btn variant="gold" onClick={save} disabled={busy || (hasIssues && !agreed)}>
                <Save className="h-4 w-4" />
                {busy ? 'جارٍ الحفظ...' : 'تأكيد وحفظ تاريخيًا (' + (result.counts.new + (mode === 'update' ? result.counts.update : 0)) + ' سجل)'}
              </Btn>
            </div>
          )}
        </div>
      ) : null}

      <div className="mt-6 rounded-xl border bg-card p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 font-cairo text-sm font-extrabold text-navy-900"><History className="h-4 w-4" />سجل عمليات الاستيراد</h3>
        <Table head={['#', 'الملف (مرفق)', 'النوع', 'الصفوف', 'جديد', 'تحديث', 'خطأ', 'النتيجة', 'المستخدم', 'التاريخ', 'تنزيل']}>
          {batches.length ? batches.map(function (b: any) {
            return (
              <tr key={b.id}>
                <td className="px-4 py-2 num">{b.id}</td>
                <td className="px-4 py-2 font-bold">{b.file_name}</td>
                <td className="px-4 py-2">{b.data_type === 'employees' ? 'موظفون' : 'رواتب'}</td>
                <td className="px-4 py-2 num">{b.row_count}</td>
                <td className="px-4 py-2 num text-emerald-700">{b.new_count}</td>
                <td className="px-4 py-2 num text-sky-700">{b.updated_count}</td>
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
          }) : <EmptyRow colSpan={11} text="لا توجد عمليات استيراد بعد" />}
        </Table>
      </div>
    </div>
  );
}