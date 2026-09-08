// شاشة مراجعة واعتماد القراءة الآلية (OCR) للمرفقات — وحدة الموارد البشرية «سياج»
// ترفع وثيقة (PDF / JPG / PNG عربي أو إنجليزي)، أو تُفتح مباشرة على مرفق محفوظ
// عبر existing (file_key)، فتعرض الأصل أسفل نتيجة القراءة مع جودة الصورة ودرجات
// الثقة لكل حقل، وتسمح بالتعديل اليدوي، ولا تلمس ملف الموظف إطلاقًا إلا بعد
// ضغط المستخدم على «اعتماد وربط بملف الموظف».
import { useEffect, useState } from 'react';
import { Modal, Field, Select, TextInput, Btn, useToast } from '@/components/ui-kit';
import { ScanText, Check, Plus, RefreshCw, AlertTriangle, Loader2, ImageOff, FileText, ExternalLink } from 'lucide-react';
import { readDocument, applyOcrToEmployee, fetchStoredFile, OCR_DOC_TYPES, OCR_FIELD_LABELS } from '@/lib/ocr';
import { getFileUrl } from '@/lib/backend';

type Props = {
  open: boolean;
  onClose: () => void;
  employee: any;
  actor: string;
  onDone: () => void;
  existing?: { file_key?: string; file_name?: string; doc_type?: string } | null;
};

const ACCEPTED = /\.(pdf|jpe?g|png)$/i;

export default function OcrReviewModal({ open, onClose, employee, actor, onDone, existing }: Props) {
  const toast = useToast();
  const exKey = existing ? (existing.file_key || '') : '';
  const exName = existing ? (existing.file_name || '') : '';
  const exType = existing ? (existing.doc_type || '') : '';
  const existingMode = Boolean(exKey);
  const [docType, setDocType] = useState('هوية');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [addKey, setAddKey] = useState('');
  // الأصل المحفوظ (من existing)
  const [origUrl, setOrigUrl] = useState('');
  const [origIsPdf, setOrigIsPdf] = useState(false);
  const [origLoading, setOrigLoading] = useState(false);
  const [origError, setOrigError] = useState('');

  const isImageFile = file ? file.type.startsWith('image/') : false;
  const showOrig = origUrl ? !origLoading : false;

  const reset = () => {
    setFile(null);
    setPreview('');
    setResult(null);
    setError('');
    setLoading(false);
    setBusy(false);
    setAddKey('');
    setOrigUrl('');
    setOrigIsPdf(false);
    setOrigLoading(false);
    setOrigError('');
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  // عند الفتح من مرفق محفوظ: نجلب الأصل ونجهزه للقراءة مباشرة
  useEffect(() => {
    if (!open) return;
    reset();
    if (!exKey) return;
    const name = exName || 'document';
    const isPdf = /\.pdf$/i.test(name) || /\.pdf$/i.test(exKey);
    if (exType) setDocType(exType);
    setOrigLoading(true);
    (async () => {
      try {
        const url = await getFileUrl(exKey);
        if (!url) throw new Error('no-url');
        setOrigUrl(url);
        setOrigIsPdf(isPdf);
        const f = await fetchStoredFile(exKey, name);
        setFile(f);
        if (f.type.startsWith('image/')) setPreview(URL.createObjectURL(f));
      } catch (e: any) {
        setOrigError('تعذر تحميل الأصل المحفوظ من التخزين — أعد رفع الملف يدويًا من الحقل أعلاه.');
      } finally {
        setOrigLoading(false);
      }
    })();
  }, [open, existing]);

  const pickFile = (f: File | null | undefined) => {
    if (!f) return;
    if (!ACCEPTED.test(f.name)) {
      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(f.type)) {
        toast.show('صيغة غير مدعومة — PDF أو JPG أو PNG فقط');
        return;
      }
    }
    setFile(f);
    setResult(null);
    setError('');
    setOrigError('');
    if (f.type.startsWith('image/')) setPreview(URL.createObjectURL(f));
    else setPreview('');
  };

  const runOcr = async () => {
    if (!file) {
      toast.show('اختر ملف الوثيقة أولًا');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const r = await readDocument(file, docType);
      setResult(r);
      if (!Object.keys(r.fields || {}).length) {
        setError('لم تُستخرج أي حقول — يمكنك إدخالها يدويًا من زر «إضافة حقل» ثم الاعتماد.');
      }
    } catch (e: any) {
      setError(e?.message || 'تعذرت القراءة الآلية، حاول مرة أخرى أو أدخل البيانات يدويًا.');
    } finally {
      setLoading(false);
    }
  };

  const setFieldValue = (key: string, value: string) => {
    setResult((p: any) => {
      const prev = p.fields[key] || { value: '', confidence: 0 };
      return { ...p, fields: { ...p.fields, [key]: { ...prev, value, edited: true } } };
    });
  };

  const addManualField = () => {
    if (!addKey || !result) return;
    if (result.fields[addKey]) {
      toast.show('الحقل موجود بالفعل');
      return;
    }
    setResult((p: any) => ({
      ...p,
      fields: { ...p.fields, [addKey]: { value: '', confidence: 0, edited: true } },
    }));
    setAddKey('');
  };

  const approve = async () => {
    if (!file || !result || !employee) return;
    setBusy(true);
    setError('');
    try {
      await applyOcrToEmployee({
        employee: { employee_code: employee.no, name: employee.name, id: employee.id },
        result,
        docType,
        file,
        actor,
        existingKey: exKey,
      });
      toast.show('تم اعتماد القراءة الآلية وربطها بملف الموظف');
      onDone();
      reset();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'تعذر الحفظ، حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  };

  const confBadge = (c: number, edited: boolean) => {
    if (edited) return <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700">مُعدّل يدويًا</span>;
    const pct = Math.round((Number(c) || 0) * 100);
    const cls = pct >= 85 ? 'bg-emerald-100 text-emerald-700' : pct >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
    return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>ثقة {pct}%</span>;
  };

  const quality = result?.quality || '';
  const qualityInfo =
    quality === 'good'
      ? { label: 'جودة الوثيقة: جيدة', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
      : quality === 'blurry'
        ? { label: 'تنبيه: الصورة غير واضحة — راجع القيم يدويًا قبل الاعتماد', cls: 'bg-red-50 text-red-700 border-red-200' }
        : { label: 'تنبيه: جودة منخفضة — راجع القيم يدويًا قبل الاعتماد', cls: 'bg-amber-50 text-amber-700 border-amber-200' };

  const fieldKeys = result ? Object.keys(result.fields || {}) : [];
  const missingKeys = Object.keys(OCR_FIELD_LABELS).filter((k) => !fieldKeys.includes(k));

  return (
    <Modal open={open} onClose={close} title="مراجعة واعتماد القراءة الآلية (OCR)" wide>
      {/* خطوة 1: الرفع أو الأصل المحفوظ */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="نوع الوثيقة">
          <Select
            value={docType}
            onChange={(e: any) => {
              setDocType(e.target.value);
              setResult(null);
              setError('');
            }}
            options={OCR_DOC_TYPES.map((t) => ({ value: t.value, label: t.label }))}
          />
        </Field>
        <Field label={existingMode ? 'ملف بديل (اختياري — الأصل المحفوظ جاهز للقراءة)' : 'ملف الوثيقة (PDF / JPG / PNG)'}>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            onChange={(e: any) => pickFile(e.target.files?.[0])}
            className="block w-full text-sm file:ml-3 file:rounded-lg file:border-0 file:bg-[#202359] file:px-4 file:py-2 file:text-sm file:font-bold file:text-white"
          />
        </Field>
      </div>

      {existingMode ? (
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-600">
          <b>المرفق المحفوظ:</b> {exName || 'وثيقة'} — تم تجهيزه للقراءة الآلية تلقائيًا. اضغط «بدء القراءة الآلية» مباشرة.
        </div>
      ) : null}

      {origLoading ? (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 p-2.5 text-xs font-bold text-sky-700">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> جارٍ تحميل الأصل المحفوظ من التخزين...
        </div>
      ) : null}
      {origError ? (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{origError}</span>
        </div>
      ) : null}

      {file ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className="rounded bg-slate-100 px-2 py-1 font-bold">{file.name}</span>
          <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
          <Btn variant="ghost" disabled={loading || busy || origLoading} onClick={runOcr} className="!h-8 gap-1 text-xs">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanText className="h-3.5 w-3.5" />}
            {loading ? 'جارٍ القراءة...' : result ? 'إعادة القراءة' : 'بدء القراءة الآلية'}
          </Btn>
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* خطوة 2: نتيجة القراءة */}
      {result ? (
        <div className="mt-4 rounded-xl border border-slate-200">
          <div className={`flex flex-wrap items-center justify-between gap-2 rounded-t-xl border-b p-3 text-sm font-bold ${qualityInfo.cls}`}>
            <span>{qualityInfo.label}</span>
            {isImageFile ? null : <span className="text-xs font-normal opacity-80">نوع الملف: PDF — لا تتوفر معاينة صورة مدمجة</span>}
          </div>
          <div className="grid grid-cols-1 gap-0 lg:grid-cols-3">
            <div className="border-b border-slate-200 p-3 lg:col-span-1 lg:border-b-0 lg:border-l">
              {preview ? (
                <img src={preview} alt="معاينة الوثيقة" className="max-h-72 w-full rounded-lg border border-slate-200 object-contain" />
              ) : (
                <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 text-slate-400">
                  <ImageOff className="h-8 w-8" />
                  <span className="text-xs">معاينة غير متاحة لهذا الملف</span>
                </div>
              )}
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                راجع القيم المستخرجة مقابل الأصل، وعدّل ما يلزم يدويًا. لن يُحدَّث ملف الموظف إلا بعد اعتمادك.
              </p>
            </div>
            <div className="max-h-80 overflow-y-auto p-3 lg:col-span-2">
              {fieldKeys.length === 0 ? (
                <p className="text-sm text-slate-500">لم تُستخرج حقول — أضف الحقول يدويًا من الأسفل.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {fieldKeys.map((k) => (
                    <div key={k} className="rounded-lg border border-slate-200 p-2">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-700">{OCR_FIELD_LABELS[k] || k}</span>
                        {confBadge(result.fields[k].confidence, !!result.fields[k].edited)}
                      </div>
                      <TextInput
                        value={result.fields[k].value || ''}
                        onChange={(e: any) => setFieldValue(k, e.target.value)}
                        className="!h-8 text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                <span className="text-xs font-bold text-slate-600">إضافة حقل يدوي:</span>
                <Select
                  value={addKey}
                  onChange={(e: any) => setAddKey(e.target.value)}
                  options={[{ value: '', label: '— اختر حقلًا —' }, ...missingKeys.map((k) => ({ value: k, label: OCR_FIELD_LABELS[k] || k }))]}
                  className="!h-8 w-44 text-xs"
                />
                <Btn variant="ghost" disabled={!addKey} onClick={addManualField} className="!h-8 gap-1 text-xs">
                  <Plus className="h-3.5 w-3.5" /> إضافة
                </Btn>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* الأصل المحفوظ — يُعرض أسفل نتيجة القراءة */}
      {showOrig ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-700">الأصل المحفوظ (المرفق)</span>
            <a
              href={origUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-bold text-[#202359] underline hover:text-[#ED2024]"
            >
              <ExternalLink className="h-3.5 w-3.5" /> فتح في تبويب جديد
            </a>
          </div>
          {origIsPdf ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white text-slate-500">
              <FileText className="h-8 w-8 text-[#ED2024]" />
              <span className="text-xs">ملف PDF — استخدم «فتح في تبويب جديد» للمعاينة الكاملة</span>
            </div>
          ) : (
            <img
              src={origUrl}
              alt="الأصل المحفوظ"
              className="max-h-80 w-full rounded-lg border border-slate-200 bg-white object-contain"
              onError={() => setOrigError('تعذر عرض الأصل — قد يكون الملف محذوفًا من التخزين.')}
            />
          )}
        </div>
      ) : null}

      {/* خطوة 3: الاعتماد */}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <Btn variant="ghost" onClick={close} disabled={busy}>
          إلغاء
        </Btn>
        {result ? (
          <Btn variant="ghost" disabled={loading || busy} onClick={runOcr} className="gap-1">
            <RefreshCw className="h-4 w-4" /> إعادة القراءة
          </Btn>
        ) : null}
        <Btn disabled={!result || loading || busy || !employee} onClick={approve} className="gap-1 bg-emerald-600 hover:bg-emerald-700">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {busy ? 'جارٍ الحفظ...' : 'اعتماد وربط بملف الموظف'}
        </Btn>
      </div>
      {employee ? (
        <p className="mt-2 text-left text-[11px] text-slate-500">
          المستهدف: {employee.name} ({employee.no}) — سيتم حفظ الأصل ونتيجة القراءة وربطهما بالموظف ونوع الوثيقة وسجل التدقيق.
        </p>
      ) : null}
    </Modal>
  );
}