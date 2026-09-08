// تقارير الموظفين «سياج» — جلب فعلي من Atoms Cloud عبر employee_code
// ملف الموظف الشامل، رواتب موظف، جزاءات موظف، زيارات المشرفين.
import { client } from './api';
import { fmt } from './seyaj';
import {
  fetchMasterByCode,
  fetchAssignmentsByCode,
  fetchAttendanceByCode,
  fetchQualificationsByCode,
  fetchWorkViolationsByCode,
  fetchTrafficViolationsByCode,
  fetchVisitsByCode,
  fetchSupportByCode,
  fetchLettersByCode,
  fetchAuditByCode,
} from './hr';
import { fetchPayrollByCode } from './excelImportData';

export interface EmpReport { title: string; columns: string[]; rows: any[][] }

function dash(v: any) { if (v === null || v === undefined || v === '') return '—'; return String(v); }
function day(v: any) { return dash(String(v || '').slice(0, 10)); }

function inWindow(iso: string, from: string, to: string) {
  const d = String(iso || '').slice(0, 10);
  if (!d) return false;
  if (from) { if (Math.sign(d.localeCompare(from)) === -1) return false; }
  if (to) { if (Math.sign(d.localeCompare(to)) === 1) return false; }
  return true;
}

async function listAllLocal(table: string, sort = '-id') {
  try {
    const res: any = await (client.entities as any)[table].queryAll({ sort: sort, limit: 2000 });
    return res?.data?.items || [];
  } catch {
    return [];
  }
}

function safeJson(s: any) {
  if (!s) return null;
  if (typeof s === 'object') return s;
  try { return JSON.parse(String(s)); } catch { return null; }
}

// ---------- 1) ملف الموظف الشامل — حركة مجمّعة من كل الأقسام ----------
export async function buildEmployeeProfile(code: string) {
  const [master, assigns, att, quals, vio, traf, visits, sup, letters, audit] = await Promise.all([
    fetchMasterByCode(code),
    fetchAssignmentsByCode(code),
    fetchAttendanceByCode(code),
    fetchQualificationsByCode(code),
    fetchWorkViolationsByCode(code),
    fetchTrafficViolationsByCode(code),
    fetchVisitsByCode(code),
    fetchSupportByCode(code),
    fetchLettersByCode(code),
    fetchAuditByCode(code),
  ]);
  const m = master[0] || {};
  const name = dash(m.name);
  const rows: any[][] = [];
  rows.push(['البيانات الأساسية', day(m.hire_date), 'الاسم: ' + name + ' — المسمى: ' + dash(m.job) + ' — القسم: ' + dash(m.department), dash(m.nationality), '']);
  for (const a of assigns) rows.push(['إسناد موقع', day(a.end_date || a.start_date), dash(a.site_name) + ' (' + dash(a.shift_period) + ') — راتب ' + fmt(a.salary || 0), a.active === false ? 'منتهي' : 'نشط', '']);
  for (const q of quals) rows.push(['مؤهل/خبرة', day(q.from_date), dash(q.qual_type) + ': ' + dash(q.title) + ' — ' + dash(q.institution), day(q.to_date), '']);
  for (const v of vio) rows.push(['مخالفة عمل', day(v.recorded_date), dash(v.violation_type) + ' — ' + dash(v.description), dash(v.status), fmt(v.amount || 0)]);
  for (const t of traf) rows.push(['مخالفة مرور', day(t.violation_date), dash(t.violation_type) + ' — لوحة ' + dash(t.plate_number), dash(t.status), fmt(t.amount || 0)]);
  for (const s of sup) rows.push(['حركة مساندة', day(s.movement_date), dash(s.home_site) + ' / ' + dash(s.covered_site) + ' (' + dash(s.movement_type) + ')', '', '']);
  for (const l of letters) rows.push(['خطاب', day(l.sent_date || l.created_at), dash(l.letter_type) + ': ' + dash(l.subject), dash(l.status), '']);
  for (const x of visits) rows.push(['زيارة مشرف', day(x.visit_date), dash(x.supervisor_name) + ' — ' + dash(x.site) + ' (' + dash(x.shift) + ')', dash(x.status), '']);
  for (const au of audit) rows.push(['سجل تدقيق', day(au.created_at), dash(au.action) + ' — ' + dash(au.details), dash(au.actor), '']);
  let present = 0;
  for (const a of att) { if (a.status === 'absent') continue; if (a.status === 'غائب') continue; present = present + 1; }
  rows.push(['ملخص الحضور', '', 'أيام حضور مسجّلة: ' + present + ' من ' + att.length, '', '']);
  return {
    title: 'ملف الموظف الشامل — ' + name + ' (' + code + ')',
    columns: ['القسم', 'التاريخ', 'التفصيل', 'الحالة', 'المبلغ'],
    rows: rows,
  };
}

// ---------- 2) رواتب موظف — كل المسيرات المستوردة ----------
export async function buildEmployeePayroll(code: string, from: string, to: string) {
  const all = await fetchPayrollByCode(code);
  const rows: any[][] = [];
  for (const r of all) {
    const period = r.pay_year + '-' + String(r.pay_month || '01').padStart(2, '0') + '-01';
    if (!inWindow(period, from, to)) continue;
    rows.push([
      r.pay_year + '/' + dash(r.pay_month), dash(r.run_no), dash(r.branch), dash(r.job),
      fmt(r.basic || 0), fmt(r.housing || 0), fmt(r.transport || 0), fmt(r.overtime || 0),
      fmt(r.gross || 0), fmt(r.deductions_total || 0), fmt(r.net || 0),
    ]);
  }
  return {
    title: 'رواتب الموظف ' + code,
    columns: ['الفترة', 'رقم المسير', 'الفرع', 'المسمى', 'أساسي', 'سكن', 'نقل', 'إضافي', 'إجمالي', 'خصومات', 'صافي'],
    rows: rows,
  };
}

// ---------- 3) جزاءات موظف — مخالفات العمل والمرور ----------
export async function buildEmployeeViolations(code: string, from: string, to: string) {
  const [vio, traf] = await Promise.all([fetchWorkViolationsByCode(code), fetchTrafficViolationsByCode(code)]);
  const rows: any[][] = [];
  for (const v of vio) {
    if (!inWindow(v.recorded_date, from, to)) continue;
    rows.push(['مخالفة عمل', day(v.recorded_date), dash(v.violation_type), dash(v.description), dash(v.site), dash(v.status), fmt(v.amount || 0)]);
  }
  for (const t of traf) {
    if (!inWindow(t.violation_date, from, to)) continue;
    rows.push(['مخالفة مرور', day(t.violation_date), dash(t.violation_type), 'لوحة ' + dash(t.plate_number) + ' — ' + dash(t.location), '', dash(t.status), fmt(t.amount || 0)]);
  }
  return {
    title: 'جزاءات الموظف ' + code,
    columns: ['المصدر', 'التاريخ', 'النوع', 'التفصيل', 'الموقع', 'الحالة', 'المبلغ'],
    rows: rows,
  };
}

// ---------- 4) زيارات المشرفين — لكل موظف أو كل الزيارات ----------
export async function buildSupervisorVisits(code: string, from: string, to: string) {
  let list: any[] = [];
  if (code) { list = await fetchVisitsByCode(code); } else { list = await listAllLocal('field_visits', '-id'); }
  const rows: any[][] = [];
  for (const v of list) {
    if (!inWindow(v.visit_date, from, to)) continue;
    const ev = safeJson(v.evaluation) || {};
    const keys = Object.keys(ev);
    let bad = 0;
    for (const k of keys) { if (!ev[k]) bad = bad + 1; }
    rows.push([
      day(v.visit_date), dash(v.supervisor_name), dash(v.project), dash(v.site) + ' (' + dash(v.site_code) + ')',
      dash(v.client_name), dash(v.shift), bad ? bad + ' بند ناقص' : 'مطابق', dash(v.status),
    ]);
  }
  return {
    title: code ? 'زيارات المشرفين للموظف ' + code : 'زيارات المشرفين الميدانية',
    columns: ['التاريخ', 'المشرف', 'المشروع', 'الموقع', 'العميل', 'الوردية', 'التشييك', 'الحالة'],
    rows: rows,
  };
}

export const EMP_REPORT_KEYS = ['emp_profile', 'emp_payroll', 'emp_violations', 'emp_visits'];

export function isEmpReport(key: string) {
  return EMP_REPORT_KEYS.indexOf(key) !== -1;
}

export async function runEmpReport(key: string, code: string, from: string, to: string) {
  if (key === 'emp_profile') return buildEmployeeProfile(code);
  if (key === 'emp_payroll') return buildEmployeePayroll(code, from, to);
  if (key === 'emp_violations') return buildEmployeeViolations(code, from, to);
  return buildSupervisorVisits(code, from, to);
}