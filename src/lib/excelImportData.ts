// ============================================================
// منطق استيراد Excel — الجزء 2: التصنيف والتحقق والحفظ التاريخي
// لا يحذف ولا يستبدل أي بيانات موجودة؛ رقم الموظف مفتاح المطابقة.
// ============================================================
import { client } from './api';
import { uploadDoc, hrAudit } from './hr';
import {
  IMPORT_PREFIX, and, or, not, toEnDigits, normAr, parseNum, parseDate, colOf,
} from './excelImport';

// ---------- تصنيف سجلات الموظفين ----------
export function classifyEmployees(rows: any[][], mapping: any, existing: any) {
  const g = function (r: any[], f: string) { const i = colOf(mapping, f); return i == null ? '' : r[i]; };
  const seen: any = new Set();
  const records: any[] = [];
  const counts = { total: 0, new: 0, update: 0, error: 0, dup: 0, missing: 0, warn: 0 };
  for (let ri = 0; rows.length > ri; ri++) {
    const r = rows[ri];
    if (!r || r.every(function (c: any) { return c === '' || c === null || c === undefined; })) continue;
    counts.total++;
    const code = toEnDigits(String(g(r, 'employee_code') ?? '')).trim().replace(/\.0+$/, '');
    const name = String(g(r, 'name') ?? '').trim();
    const errors: string[] = []; const warnings: string[] = [];
    if (!code) { counts.missing++; records.push({ row: ri, status: 'missing', errors: ['بلا رقم موظف'], warnings, data: { name } }); continue; }
    if (!name) errors.push('اسم ناقص');
    let hireDate = '';
    const hd = g(r, 'hire_date');
    if (String(hd ?? '').trim() !== '') { hireDate = parseDate(hd); if (!hireDate) errors.push('خطأ في تاريخ التوظيف'); }
    const data = {
      employee_code: code, name,
      job_number: toEnDigits(String(g(r, 'job_number') ?? '')).trim().replace(/\.0+$/, ''),
      insurance_no: toEnDigits(String(g(r, 'insurance_no') ?? '')).trim().replace(/\.0+$/, ''),
      contract_no: toEnDigits(String(g(r, 'contract_no') ?? '')).trim().replace(/\.0+$/, ''),
      hire_date: hireDate, nationality: String(g(r, 'nationality') ?? '').trim(),
      gender: String(g(r, 'gender') ?? '').trim(), job: String(g(r, 'job') ?? '').trim(),
      department: String(g(r, 'department') ?? '').trim(), administration: String(g(r, 'administration') ?? '').trim(),
      qualification: String(g(r, 'qualification') ?? '').trim(),
    };
    if (seen.has(code)) { counts.dup++; records.push({ row: ri, status: 'dup', errors: ['رقم موظف مكرر داخل الملف'], warnings, data }); continue; }
    seen.add(code);
    if (errors.length) { counts.error++; records.push({ row: ri, status: 'error', errors, warnings, data }); continue; }
    const ex = existing.get(code);
    if (ex) { counts.update++; records.push({ row: ri, status: 'update', errors, warnings, data, existingId: ex.id }); }
    else { counts.new++; records.push({ row: ri, status: 'new', errors, warnings, data }); }
  }
  return { records, counts };
}

// ---------- تصنيف سجلات الرواتب (بنية كتلية) ----------
export function classifyPayroll(
  rows: any[][], mapping: any,
  meta: any,
  knownCodes: any, nameByCode: any,
) {
  const g = function (r: any[], f: string) { const i = colOf(mapping, f); return i == null ? '' : r[i]; };
  const seen: any = new Set();
  const records: any[] = [];
  const counts = { total: 0, new: 0, update: 0, error: 0, dup: 0, missing: 0, warn: 0 };
  let branch = ''; let runDate = meta.run_date || ''; let runNo = meta.run_no || '';
  const NUM_FIELDS = ['basic', 'housing', 'transport', 'food', 'mobile', 'other_allow', 'overtime', 'bonuses', 'insurance', 'advances', 'delay', 'withdrawal', 'absence', 'gross'];
  for (let ri = 0; rows.length > ri; ri++) {
    const r = rows[ri];
    if (!r || r.every(function (c: any) { return c === '' || c === null || c === undefined; })) continue;
    const cells = r.map(function (c: any) { return String(c ?? ''); });
    const joined = normAr(cells.join(' '));
    if (joined.includes('اجمالي الوريه') || joined.includes('اجمالي الوردي')) continue;
    const iProj = cells.findIndex(function (c: string) { return normAr(c).includes('مشروع'); });
    if (iProj > 0) { const v = String(r[iProj - 1] ?? '').trim(); if (v) branch = v; continue; }
    const iDate = cells.findIndex(function (c: string) { return normAr(c).startsWith('التاريخ'); });
    if (iDate > 0) { const d = parseDate(r[iDate - 1]); if (d) runDate = d; continue; }
    const iRun = cells.findIndex(function (c: string) { return normAr(c).includes('مسير رقم'); });
    if (iRun > 0) { const v = toEnDigits(String(r[iRun - 1] ?? '')).trim().replace(/\.0+$/, ''); if (v) runNo = v; continue; }
    if (joined.includes('الوريه')) continue;
    const code = toEnDigits(String(g(r, 'employee_code') ?? '')).trim().replace(/\.0+$/, '');
    const name = String(g(r, 'name') ?? '').trim();
    if (and(not(code), not(name))) continue;
    counts.total++;
    const errors: string[] = []; const warnings: string[] = [];
    if (!code) { counts.missing++; records.push({ row: ri, status: 'missing', errors: ['بلا رقم موظف'], warnings, data: { name } }); continue; }
    const vals: any = {};
    for (const f of NUM_FIELDS) {
      const p = parseNum(g(r, f));
      if (not(p.ok)) errors.push('مبلغ غير رقمي: ' + f);
      vals[f] = p.value;
    }
    if (!name) errors.push('اسم ناقص');
    const gross = colOf(mapping, 'gross') != null ? vals.gross : (vals.basic + vals.housing + vals.transport + vals.food + vals.mobile + vals.other_allow + vals.overtime + vals.bonuses);
    const deductions = vals.insurance + vals.advances + vals.delay + vals.withdrawal + vals.absence;
    const net = Math.round((gross - deductions) * 100) / 100;
    if (seen.has(code)) { counts.dup++; records.push({ row: ri, status: 'dup', errors: ['رقم موظف مكرر داخل المسير'], warnings, data: { employee_code: code, name } }); continue; }
    seen.add(code);
    if (not(knownCodes.has(code))) warnings.push('رقم موظف غير موجود في قاعدة الموظفين');
    const masterName = nameByCode.get(code);
    if (and(masterName, name, normAr(masterName).slice(0, 10) !== normAr(name).slice(0, 10))) warnings.push('اسم مختلف عن الموظف المرتبط بالرقم');
    if (warnings.length) counts.warn++;
    if (errors.length) { counts.error++; records.push({ row: ri, status: 'error', errors, warnings, data: { employee_code: code, name } }); continue; }
    const data = {
      employee_code: code, employee_name: name, job: String(g(r, 'job') ?? '').trim(),
      branch: String(g(r, 'branch') ?? '').trim() || branch,
      basic: vals.basic, housing: vals.housing, transport: vals.transport, food: vals.food,
      mobile: vals.mobile, other_allow: vals.other_allow, overtime: vals.overtime, bonuses: vals.bonuses,
      insurance_ded: vals.insurance, advances: vals.advances, delay_ded: vals.delay,
      withdrawal_ded: vals.withdrawal, absence_ded: vals.absence,
      gross: Math.round(gross * 100) / 100, deductions_total: Math.round(deductions * 100) / 100, net,
      pay_month: meta.pay_month, pay_year: meta.pay_year,
      run_date: runDate || meta.run_date, run_no: runNo || meta.run_no,
    };
    records.push({ row: ri, status: 'new', errors, warnings, data });
  }
  return { records, counts, detected: { run_date: runDate, run_no: runNo, branch } };
}

// ---------- كيانات الباك-إند ----------
// حد الباك-إند 2000 سجل لكل طلب؛ نجلب على شكل صفحات عبر skip لتفادي خطأ 422
async function fetchAllPaged(entity: any, opts: any = {}) {
  const PAGE = 2000;
  const items: any[] = [];
  let skip = 0;
  for (;;) {
    const res: any = await entity.queryAll({ ...opts, limit: PAGE, skip });
    const batch = res?.data?.items ?? [];
    for (const b of batch) items.push(b);
    if (batch.length < PAGE) break;
    skip += PAGE;
    if (skip > 200000) break; // حماية من دور لا نهائي
  }
  return items;
}
export async function fetchImportedEmployees() {
  try {
    return await fetchAllPaged((client.entities as any).imported_employees, { sort: 'id' });
  } catch { return []; }
}
export async function fetchImportBatches() {
  try {
    const res: any = await (client.entities as any).import_batches.queryAll({ sort: '-id', limit: 200 });
    return res?.data?.items ?? [];
  } catch { return []; }
}
export async function fetchPayrollByCode(code: string) {
  // ترشيح employee_code من الخادم بدل تحميل كل السجلات ثم التصفية في الواجهة
  try {
    return await fetchAllPaged((client.entities as any).imported_payroll_records, { query: { employee_code: code }, sort: '-pay_year,-id' });
  } catch { return []; }
}

// ---------- الحفظ ----------
export async function commitEmployeeImport(file: File, records: any[], mode: string, actor: string) {
  const up = await uploadDoc(file, IMPORT_PREFIX);
  const saveable = records.filter(function (r: any) { return or(r.status === 'new', and(r.status === 'update', mode === 'update')); });
  const batch: any = await (client.entities as any).import_batches.create({
    data: {
      file_name: file.name, object_key: up.object_key, data_type: 'employees',
      row_count: records.length, new_count: saveable.filter(function (r: any) { return r.status === 'new'; }).length,
      updated_count: saveable.filter(function (r: any) { return r.status === 'update'; }).length,
      error_count: records.filter(function (r: any) { return r.status === 'error'; }).length,
      dup_count: records.filter(function (r: any) { return r.status === 'dup'; }).length,
      missing_code_count: records.filter(function (r: any) { return r.status === 'missing'; }).length,
      result: 'قيد الحفظ', mode, uploaded_by: actor,
    },
  });
  const batchId = batch?.id;
  let created = 0; let updated = 0;
  for (const r of saveable) {
    try {
      if (and(r.status === 'update', r.existingId)) {
        await (client.entities as any).imported_employees.update({ id: r.existingId, data: { ...r.data, source_batch: batchId, created_by: actor } });
        updated++;
      } else {
        await (client.entities as any).imported_employees.create({ data: { ...r.data, source_batch: batchId, created_by: actor } });
        created++;
      }
    } catch { /* سجل فردي فاشل لا يوقف الدفعة */ }
  }
  await (client.entities as any).import_batches.update({ id: batchId, data: { result: 'مكتمل — ' + created + ' جديد، ' + updated + ' تحديث', new_count: created, updated_count: updated } });
  await hrAudit(actor, 'استيراد موظفين من Excel', 'import_batches', batchId, file.name + ' — ' + created + ' جديد / ' + updated + ' تحديث / ' + (records.length - created - updated) + ' مستبعد');
  return batchId;
}

export async function commitPayrollImport(file: File, records: any[], actor: string) {
  const up = await uploadDoc(file, IMPORT_PREFIX);
  const saveable = records.filter(function (r: any) { return r.status === 'new'; });
  const batch: any = await (client.entities as any).import_batches.create({
    data: {
      file_name: file.name, object_key: up.object_key, data_type: 'payroll',
      row_count: records.length, new_count: saveable.length, updated_count: 0,
      error_count: records.filter(function (r: any) { return r.status === 'error'; }).length,
      dup_count: records.filter(function (r: any) { return r.status === 'dup'; }).length,
      missing_code_count: records.filter(function (r: any) { return r.status === 'missing'; }).length,
      result: 'قيد الحفظ', mode: 'سجل تاريخي جديد لكل مسير', uploaded_by: actor,
    },
  });
  const batchId = batch?.id;
  let created = 0;
  for (const r of saveable) {
    try {
      await (client.entities as any).imported_payroll_records.create({ data: { ...r.data, batch_id: batchId, created_by: actor } });
      created++;
    } catch { /* لا يوقف الدفعة */ }
  }
  await (client.entities as any).import_batches.update({ id: batchId, data: { result: 'مكتمل — ' + created + ' سجل راتب تاريخي', new_count: created } });
  await hrAudit(actor, 'استيراد رواتب من Excel', 'import_batches', batchId, file.name + ' — ' + created + ' سجل');
  return batchId;
}