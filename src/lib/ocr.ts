// OCR module - part 1
import { client } from './api';
import { uploadDoc, todayISO, getFileUrl } from './backend';
import { saveHrDoc, addEvent, hrAudit } from './hr';

export const OCR_DOC_TYPES = [
  { value: 'هوية', label: 'الهوية الوطنية' },
  { value: 'إقامة', label: 'تصريح الإقامة' },
  { value: 'جواز', label: 'جواز السفر' },
  { value: 'رخصة', label: 'رخصة القيادة' },
  { value: 'شهادة', label: 'شهادة او مؤهل علمي' },
  { value: 'سيرة ذاتية', label: 'السيرة الذاتية' },
  { value: 'عقد', label: 'عقد العمل' },
  { value: 'مرفق آخر', label: 'مستند آخر PDF او صورة' },
];

export const OCR_FIELD_LABELS: any = {
  name: 'الاسم',
  name_en: 'الاسم انجليزي',
  id_number: 'رقم الهوية او الاقامة',
  nationality: 'الجنسية',
  gender: 'الجنس',
  birth_date: 'تاريخ الميلاد',
  issue_date: 'تاريخ الاصدار',
  expiry_date: 'تاريخ الانتهاء',
  document_number: 'رقم الوثيقة',
  issuing_authority: 'جهة الاصدار',
  passport_number: 'رقم الجواز',
  license_number: 'رقم الرخصة',
  license_classes: 'فئات الرخصة',
  qualification_title: 'المؤهل',
  institution: 'الجامعة او المعهد',
  major: 'التخصص',
  graduation_date: 'تاريخ التخرج',
  contract_no: 'رقم العقد',
  start_date: 'تاريخ بداية العقد',
  end_date: 'تاريخ نهاية العقد',
  salary: 'الراتب',
  insurance_no: 'رقم التأمينات',
  job: 'المسمى الوظيفي',
  phone: 'الجوال',
  email: 'البريد الالكتروني',
  address: 'العنوان',
};

export const MASTER_FIELD_MAP: any = {
  name: 'name',
  nationality: 'nationality',
  gender: 'gender',
  job: 'job',
  qualification_title: 'qualification',
  insurance_no: 'insurance_no',
  contract_no: 'contract_no',
  start_date: 'hire_date',
};

// تحميل وثيقة محفوظة في Object Storage وتحويلها إلى File لتشغيل القراءة الآلية عليها مباشرة
export async function fetchStoredFile(objectKey: string, fileName: string): Promise<File> {
  const url = await getFileUrl(objectKey);
  if (!url) throw new Error('تعذر الوصول إلى ملف الوثيقة المحفوظ — أعد رفعها أولًا.');
  const res = await fetch(url);
  if (!res.ok) throw new Error('تعذر تنزيل ملف الوثيقة من التخزين.');
  const blob = await res.blob();
  return new File([blob], fileName || 'document.pdf', { type: blob.type || 'application/octet-stream' });
}

export function fileToDataUri(file: File) {
  return new Promise(function (resolve, reject) {
    const r = new FileReader();
    r.onload = function () { resolve(String(r.result)); };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function buildPrompt(docType: string): string {
  const labels = Object.entries(OCR_FIELD_LABELS).map(function (e) { return '"' + e[0] + '": "' + e[1] + '"'; }).join(', ');
  const lines = [
    'أنت محرك OCR احترافي لقراءة الوثائق الرسمية السعودية والعربية والإنجليزية.',
    'نوع الوثيقة المتوقع: ' + docType + '.',
    'اقرأ الوثيقة واستخرج الحقول المتاحة فقط.',
    'أجب بصيغة JSON واحدة فقط دون أي نص إضافي.',
    'البنية: doc_type و quality و fields، وكل حقل فيه value و confidence.',
    'الحقول الممكنة: ' + labels + '.',
    'confidence بين 0 و 1. لا تدرج حقلًا لم تُقرأ قيمته. التواريخ بصيغة YYYY-MM-DD. لا تخترع قيمًا. إذا كانت الصورة غير واضحة اجعل quality blurry أو low.',
  ];
  return lines.join('\n');
}

function extractJsonBlock(text: string): string {
  const t = text.trim();
  const s = t.indexOf('{');
  const e = t.lastIndexOf('}');
  if (s === -1) return t;
  if (e === -1) return t.slice(s);
  if (e === s) return t.slice(s);
  return t.slice(s, e + 1);
}

function normalizeResult(parsed: any): any {
  const fields: any = {};
  let raw: any = {};
  if (parsed) {
    if (parsed.fields) {
      if (typeof parsed.fields === 'object') raw = parsed.fields;
    }
  }
  const entries = Object.entries(raw);
  for (let i = 0; i !== entries.length; i = i + 1) {
    const key = entries[i][0];
    const val: any = entries[i][1];
    if (val) {
      if (typeof val === 'object') {
        if ('value' in val) {
          if (val.value !== null) {
            if (val.value !== undefined) {
              if (String(val.value).trim() !== '') {
                let conf = Number(val.confidence);
                if (isNaN(conf)) conf = 0.7;
                conf = Math.max(0, Math.min(1, conf));
                fields[key] = { value: String(val.value).trim(), confidence: conf };
              }
            }
          }
          continue;
        }
      }
    }
    if (typeof val === 'string') {
      if (String(val).trim() !== '') fields[key] = { value: String(val).trim(), confidence: 0.7 };
    }
    if (typeof val === 'number') {
      fields[key] = { value: String(val).trim(), confidence: 0.7 };
    }
  }
  let q = 'good';
  if (parsed) { if (parsed.quality) q = String(parsed.quality).toLowerCase(); }
  const bad = ['blurry', 'low'].includes(q);
  let dt = '';
  if (parsed) { if (parsed.doc_type) dt = String(parsed.doc_type).trim(); }
  return { doc_type: dt, quality: bad ? q : 'good', fields: fields };
}

async function parseOcrPayload(text: string) {
  const block = extractJsonBlock(text);
  try {
    return normalizeResult(JSON.parse(block));
  } catch (err) {
    const repair: any = await client.ai.gentxt({
      messages: [
        { role: 'system', content: 'أعد كتابة المحتوى التالي كـ JSON صالح واحد فقط دون أي نص آخر.' },
        { role: 'user', content: block.slice(0, 4000) },
      ],
      model: 'deepseek-v4-flash',
      stream: false,
    });
    try {
      let rt = '';
      if (repair) { if (repair.data) { if (repair.data.content) rt = String(repair.data.content); } }
      if (rt === '') { if (repair) { if (repair.content) rt = String(repair.content); } }
      return normalizeResult(JSON.parse(extractJsonBlock(rt)));
    } catch (err2) {
      throw new Error('تعذر تحليل نتيجة القراءة الآلية، يرجى إعادة المحاولة أو إدخال البيانات يدويًا.');
    }
  }
}

export async function readDocument(file: File, docType: string) {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const dataUri = await fileToDataUri(file);
  const prompt = buildPrompt(docType);
  if (isPdf) {
    const res: any = await client.apiCall.invoke({
      url: '/api/v1/aihub/analyzepdf',
      method: 'POST',
      data: { pdf: dataUri, instruction: prompt + ' وأخرج JSON فقط.', mode: 'extract' },
      options: { timeout: 600000 },
    });
    let resultText = '';
    if (res) { if (res.data) { if (res.data.result) resultText = String(res.data.result); } }
    if (resultText === '') { if (res) { if (res.result) resultText = String(res.result); } }
    if (resultText.trim() === '') throw new Error('لم يُرجع تحليل PDF أي نتيجة.');
    return parseOcrPayload(resultText);
  }
  const res: any = await client.ai.gentxt({
    messages: [
      { role: 'system', content: 'أنت محرك OCR دقيق. أخرج JSON فقط.' },
      { role: 'user', content: [ { type: 'text', text: prompt }, { type: 'image_url', image_url: { url: dataUri } } ] },
    ],
    model: 'gemini-3.1-pro-preview',
    stream: false,
  });
  let text = '';
  if (res) { if (res.data) { if (res.data.content) text = String(res.data.content); } }
  if (text === '') { if (res) { if (res.content) text = String(res.content); } }
  if (text.trim() === '') throw new Error('لم تُرجع القراءة الآلية أي نتيجة.');
  return parseOcrPayload(text);
}

export async function applyOcrToEmployee(params: any) {
  const employee = params.employee;
  const result = params.result;
  const docType = params.docType;
  const file = params.file;
  const actor = params.actor;
  const f = result.fields || {};
  function val(k: string): string {
    if (f[k]) { if (f[k].value) return String(f[k].value).trim(); }
    return '';
  }
  // عند الفتح من مرفق محفوظ نعيد استخدام نفس مفتاح التخزين بدل رفع نسخة مزدوجة
  let objectKey = '';
  if (params.existingKey) {
    objectKey = String(params.existingKey);
  } else {
    const up = await uploadDoc(file, 'hr-ocr/' + (employee.employee_code || 'unknown'));
    objectKey = up.object_key;
  }
  const patch: any = {};
  const mapEntries = Object.entries(MASTER_FIELD_MAP);
  for (let i = 0; i !== mapEntries.length; i = i + 1) {
    const v = val(mapEntries[i][0]);
    if (v !== '') patch[String(mapEntries[i][1])] = v;
  }
  if (employee.id) {
    if (Object.keys(patch).length) {
      try {
        await (client.entities as any).imported_employees.update({ id: employee.id, data: patch });
      } catch (err) {
        // تجاهل أعمدة غير قابلة للتحديث
      }
    }
  }
  const contentJson = JSON.stringify({
    file_name: file.name,
    file_key: objectKey,
    ocr_doc_type: result.doc_type || docType,
    ocr_quality: result.quality,
    ocr_fields: f,
    applied_to_master: patch,
  });
  const doc = await saveHrDoc(
    {
      employee_code: employee.employee_code,
      employee_name: employee.name,
      doc_type: docType,
      doc_date: val('expiry_date') || todayISO(),
      content_json: contentJson,
      status: 'issued',
      verified: true,
    },
    actor,
  );
  await addEvent(
    {
      employee_code: employee.employee_code,
      employee_name: employee.name,
      event_type: 'مرفق',
      event_date: todayISO(),
      details: 'قراءة آلية (' + docType + '): ' + file.name,
      attachment_key: objectKey,
    },
    actor,
  );
  await hrAudit(
    actor,
    'اعتماد قراءة OCR',
    'hr_documents',
    (doc ? doc.id : '') || '',
    employee.name + ' - ' + docType + ' (جودة: ' + result.quality + ')',
    employee.employee_code,
  );
  return { docId: (doc ? doc.id : '') || null };
}