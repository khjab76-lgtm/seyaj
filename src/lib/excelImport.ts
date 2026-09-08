// ============================================================
// منطق استيراد Excel — الموظفون والرواتب «سياج» (الجزء 1)
// أدوات نصية/رقمية عربية، قراءة ورقة Excel، تعريف الحقول،
// اقتراح مطابقة الأعمدة بالقيم (الملفات المرجعية مائلة الترويسة).
// ============================================================
import * as XLSX from 'xlsx';

export const IMPORT_PREFIX = 'imports';

// دوال منطقية مساعدة
export const and = function (...a: any[]) { return a.every(Boolean); };
export const or = function (...a: any[]) { return a.some(Boolean); };
export const not = function (v: any) { return !v; };

// ---------- أدوات نصية/رقمية عربية ----------
const AR_DIGITS: any = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};
export function toEnDigits(s: string): string {
  return s.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, function (d: string) { return AR_DIGITS[d] || d; });
}
export function normAr(s: any): string {
  return toEnDigits(String(s ?? ''))
    .replace(/[\u064B-\u0652\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
export function parseNum(v: any): any {
  if (v === '' || v === null || v === undefined) return { ok: true, value: 0 };
  if (typeof v === 'number') return { ok: isFinite(v), value: isFinite(v) ? v : 0 };
  const s = toEnDigits(String(v)).replace(/[,،\s]/g, '').replace(/[-–—]/, '');
  if (s === '') return { ok: true, value: 0 };
  if (/^-?\d+(\.\d+)?$/.test(s)) return { ok: true, value: parseFloat(s) };
  return { ok: false, value: 0 };
}
export function parseDate(v: any): string {
  if (v === '' || v == null) return '';
  if (and(typeof v === 'number', v > 20000, 80000 > v)) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }
  const s = toEnDigits(String(v)).trim();
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  return '';
}

// ---------- قراءة ورقة Excel ----------
export async function readSheet(file: File) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  const headers = (aoa[0] || []).map(function (h: any) { return String(h ?? '').trim(); });
  return { headers, rows: aoa.slice(1) };
}

// ---------- تعريفات الحقول ----------
export const EMP_FIELDS: any[] = [
  { key: 'name', label: 'اسم الموظف', kw: ['اسم الموظف', 'اسم'] },
  { key: 'employee_code', label: 'رقم الموظف', kw: ['رقم الموظف'] },
  { key: 'job_number', label: 'الرقم الوظيفي', kw: ['رقم وظيفي', 'وظيفي'] },
  { key: 'insurance_no', label: 'رقم التأمينات الاجتماعية', kw: ['تامين'] },
  { key: 'contract_no', label: 'رقم العقد', kw: ['عقد'] },
  { key: 'hire_date', label: 'تاريخ التوظيف', kw: ['توظيف'] },
  { key: 'nationality', label: 'الجنسية', kw: ['جنسيه'] },
  { key: 'gender', label: 'الجنس', kw: ['جنس'] },
  { key: 'job', label: 'الوظيفة', kw: ['وظيفه'] },
  { key: 'department', label: 'القسم', kw: ['قسم'] },
  { key: 'administration', label: 'الإدارة', kw: ['اداره'] },
  { key: 'qualification', label: 'المؤهل العلمي', kw: ['موهل', 'مؤهل'] },
];

export const PAY_FIELDS: any[] = [
  { key: 'employee_code', label: 'رقم الموظف', kw: ['رقم الموظف'] },
  { key: 'name', label: 'اسم الموظف', kw: ['اسم الموظف'] },
  { key: 'job', label: 'الوظيفة', kw: ['وظيفه'] },
  { key: 'branch', label: 'الفرع/المشروع', kw: ['فرع', 'مشروع'] },
  { key: 'basic', label: 'الأساسي', kw: ['اساسي'], numeric: true },
  { key: 'housing', label: 'بدل السكن', kw: ['سكن'], numeric: true },
  { key: 'transport', label: 'بدل النقل', kw: ['نقل'], numeric: true },
  { key: 'food', label: 'بدل الطعام', kw: ['طعام'], numeric: true },
  { key: 'mobile', label: 'بدل الجوال', kw: ['جوال'], numeric: true },
  { key: 'other_allow', label: 'بدل أخرى', kw: ['بدل اخري'], numeric: true },
  { key: 'overtime', label: 'الإضافي', kw: ['اضافي'], numeric: true },
  { key: 'bonuses', label: 'المكافآت', kw: ['مكاف'], numeric: true },
  { key: 'insurance', label: 'التأمينات', kw: ['تامين'], numeric: true },
  { key: 'advances', label: 'السلف', kw: ['سلف'], numeric: true },
  { key: 'delay', label: 'التأخير', kw: ['تخير'], numeric: true },
  { key: 'withdrawal', label: 'الانسحاب', kw: ['انسحاب'], numeric: true },
  { key: 'absence', label: 'الغياب', kw: ['غياب'], numeric: true },
  { key: 'gross', label: 'الإجمالي', kw: ['اجمالي'], numeric: true },
];

// ---------- إحصاءات عمود ----------
function colStats(rows: any[][], i: number) {
  let nonEmpty = 0, num = 0, int = 0, date = 0, ins = 0, gender = 0, nat = 0, qual = 0, nameAr = 0, jobKw = 0, deptKw = 0;
  const vals: any[] = [];
  for (const r of rows) {
    const v = r[i];
    if (v === '' || v === null || v === undefined) continue;
    nonEmpty++; vals.push(v);
    const s = toEnDigits(String(v)).trim();
    if (typeof v === 'number' || /^-?\d+(\.\d+)?$/.test(s.replace(/[,،]/g, ''))) num++;
    if (typeof v === 'number' ? Number.isInteger(v) : /^\d+(\.0+)?$/.test(s.replace(/[,،]/g, ''))) int++;
    if (parseDate(v)) date++;
    if (/^[23]\d{9}$/.test(s)) ins++;
    if (/^(ذكر|انثي|أنثى)$/i.test(normAr(v))) gender++;
    if (/سعودي|يمني|مصري|سوداني|اردني|سوري|فلسطيني|عراقي|مغربي|تونسي|جزائري|ليبي|باكستاني|هندي|بنجلاديشي|فلبيني|نيبالي|سريلانكي|اثيوبي|كيني|تركي/.test(normAr(v))) nat++;
    if (/جامعي|ثانوي|متوسط|ابتدائي|دبلوم|ماجستير|دكتوراه/.test(normAr(v))) qual++;
    const n = normAr(v);
    const arWords = (n.match(/[\u0600-\u06FF]+/g) || []).length;
    if (and(arWords >= 2, n.split(' ').filter(Boolean).length >= 2, n.length > 8)) nameAr++;
    if (/مدير|موظف|حارس|حراسه|امن|مشرف|رئيس|محاسب|سكرتير|اخصائي|عامل|سائق|فني|مراقب|مسئول|مسؤول/.test(n)) jobKw++;
    if (/اداره|قسم|قطاع|شعبه|دائره|مركز/.test(n)) deptKw++;
  }
  const uniq = vals.length ? new Set(vals.map(String)).size / vals.length : 0;
  let consecutive = false;
  if (vals.length > 3) {
    const nums = vals.map(function (v) { return Number(toEnDigits(String(v))); }).filter(function (x) { return Number.isFinite(x); });
    if (nums.length === vals.length) {
      const sorted = [...nums].sort(function (a, b) { return a - b; });
      consecutive = and(sorted[0] === 1, sorted[sorted.length - 1] === sorted.length, new Set(sorted).size === sorted.length);
    }
  }
  const mean = vals.length ? vals.reduce(function (s, v) { return s + (parseNum(v).ok ? parseNum(v).value : 0); }, 0) / vals.length : 0;
  return {
    nonEmpty, numRatio: nonEmpty ? num / nonEmpty : 0, intRatio: nonEmpty ? int / nonEmpty : 0,
    dateRatio: nonEmpty ? date / nonEmpty : 0, insRatio: nonEmpty ? ins / nonEmpty : 0,
    genderRatio: nonEmpty ? gender / nonEmpty : 0, natRatio: nonEmpty ? nat / nonEmpty : 0,
    qualRatio: nonEmpty ? qual / nonEmpty : 0, nameArRatio: nonEmpty ? nameAr / nonEmpty : 0,
    jobKwRatio: nonEmpty ? jobKw / nonEmpty : 0, deptKwRatio: nonEmpty ? deptKw / nonEmpty : 0,
    uniq, consecutive, mean,
  };
}

// ---------- اقتراح المطابقة التلقائي ----------
export function guessMapping(headers: string[], rows: any[][], fields: any[], kind: string): any {
  const nCols = Math.max(headers.length, 1, ...rows.map(function (r) { return r.length; }));
  const stats: any[] = [];
  for (let i = 0; nCols > i; i++) stats.push(colStats(rows.slice(0, 300), i));
  const pairs: any[] = [];
  for (let i = 0; nCols > i; i++) {
    const st = stats[i];
    const h = normAr(headers[i] || '');
    for (const f of fields) {
      let score = 0;
      const kwHit = f.kw.some(function (k: string) { return h.includes(normAr(k)); });
      if (kind === 'emp') {
        switch (f.key) {
          case 'name': score = (kwHit ? 3 : 0) + (st.nameArRatio > 0.6 ? 3 : 0) - (st.numRatio > 0.6 ? 5 : 0); break;
          case 'employee_code': score = (and(st.intRatio > 0.8, st.uniq > 0.9, not(st.consecutive)) ? 4 : 0) + (kwHit ? 1 : 0) - (st.nameArRatio > 0.5 ? 5 : 0); break;
          case 'job_number': score = (and(kwHit, st.intRatio > 0.5) ? 4 : 0) + (and(st.intRatio > 0.8, st.uniq > 0.5, not(st.consecutive)) ? 1 : 0); break;
          case 'insurance_no': score = (st.insRatio > 0.5 ? 5 : 0) + (kwHit ? 1 : 0); break;
          case 'contract_no': score = and(kwHit, st.numRatio > 0.5) ? 4 : 0; break;
          case 'hire_date': score = (st.dateRatio > 0.5 ? 5 : 0) + (kwHit ? 2 : 0); break;
          case 'nationality': score = (st.natRatio > 0.5 ? 5 : 0) + (kwHit ? 2 : 0); break;
          case 'gender': score = (st.genderRatio > 0.5 ? 5 : 0) + (kwHit ? 2 : 0); break;
          case 'job': score = (kwHit ? 3 : 0) + (st.jobKwRatio > 0.4 ? 3 : 0) - (st.numRatio > 0.6 ? 5 : 0); break;
          case 'department': score = (kwHit ? 4 : 0) + (st.deptKwRatio > 0.4 ? 1.5 : 0) - (st.numRatio > 0.6 ? 5 : 0); break;
          case 'administration': score = (and(kwHit, st.nonEmpty > rows.length * 0.15) ? 4 : 0) + (st.deptKwRatio > 0.4 ? 1 : 0) - (st.numRatio > 0.6 ? 5 : 0); break;
          case 'qualification': score = (st.qualRatio > 0.5 ? 5 : 0) + (kwHit ? 2 : 0); break;
        }
      } else if (f.key === 'employee_code') {
        score = (and(st.intRatio > 0.8, st.uniq > 0.9) ? 4 : 0) + (kwHit ? 1 : 0);
      } else if (f.key === 'name') {
        score = (st.nameArRatio > 0.5 ? 3 : 0) + (kwHit ? 2 : 0) - (st.numRatio > 0.6 ? 5 : 0);
      } else if (f.key === 'job') {
        score = (st.jobKwRatio > 0.4 ? 3 : 0) + (kwHit ? 2 : 0) - (st.numRatio > 0.6 ? 5 : 0);
      } else if (f.key === 'branch') {
        score = (st.deptKwRatio > 0.4 ? 2.5 : 0) + (kwHit ? 2 : 0) - (st.numRatio > 0.6 ? 5 : 0);
      } else if (f.numeric) {
        score = and(kwHit, st.numRatio > 0.5) ? 4 : 0;
        if (and(f.key === 'gross', kwHit)) score += Math.min(2, st.mean / 2000);
      }
      if (and(score > 0, st.nonEmpty > 0)) pairs.push({ score, col: i, field: f.key });
    }
  }
  pairs.sort(function (a, b) { return b.score - a.score; });
  const usedCol: any = new Set(); const usedField: any = new Set(); const out: any = {};
  for (const p of pairs) {
    if (usedCol.has(p.col) || usedField.has(p.field)) continue;
    usedCol.add(p.col); usedField.add(p.field); out[p.col] = p.field;
  }
  return out;
}
export function colOf(mapping: any, field: string): number | null {
  const e = Object.entries(mapping).find(function (x: any) { return x[1] === field; });
  return e ? Number(e[0]) : null;
}