// ============================================================
// طبقة بيانات لوحة الموارد البشرية — استدعاءات خادمية فعلية فقط
// summary / attendance-details / leave-details / balances /
// employee-report / options + تصدير Excel وطباعة PDF رسمية RTL.
// لا توجد أرقام ثابتة أو بيانات وهمية في هذه الطبقة.
// ============================================================
import { client } from '@/lib/api';
import * as XLSX from 'xlsx';

const BASE = '/api/v1/seyaj/hr-dashboard';

async function invoke(path: string, params: Record<string, any>): Promise<any> {
  const data: Record<string, any> = {};
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') data[k] = v;
  });
  const res: any = await client.apiCall.invoke({ url: BASE + path, method: 'GET', data });
  if (res && res.data !== undefined) return res.data;
  if (res && res.error) throw new Error(String(res.error));
  return res;
}

export interface RangeInfo { from: string; to: string }
export interface AttStats {
  present: number; late: number; absent: number; excused: number; unexcused: number;
  checkin: number; checkout: number; permission: number; onleave: number;
}
export interface LeaveBucket { total: number; pending: number; approved: number; rejected: number; days: number }
export interface SummaryResult {
  range: RangeInfo; headcount: number; attendance: AttStats;
  leaves: { annual: LeaveBucket; sick: LeaveBucket; permission: LeaveBucket; other: LeaveBucket; all: LeaveBucket };
  permissions: LeaveBucket;
}
export interface AttRow {
  employee_code: string; name: string; date: string; department: string;
  project_name: string; site_name: string; status: string; note: string;
  check_in_time: string; check_out_time: string;
}
export interface LeaveRow {
  id: number; employee_code: string; name: string; leave_type: string;
  start_date: string; end_date: string; days_count: number; reason: string;
  overall_status: string; decision_note: string; department: string;
  site_name: string; project_name: string;
}
export interface BalanceRow {
  employee_code: string; name: string; department: string; site_name: string; project_name: string;
  annual_balance: number; annual_used: number; annual_remaining: number; annual_days_period: number;
  sick_balance: number; sick_used: number; sick_days_period: number; sick_times_period: number;
  unpaid_days: number;
}
export interface EmployeeReportResult {
  employee: { employee_code: string; name: string; department: string; job: string; project_name: string; site_name: string };
  totals: { present: number; late: number; absent: number; permissions: number; annual_days: number; sick_days: number; sick_times: number };
  balance: { annual_balance: number; annual_used: number; annual_remaining: number; sick_balance: number; sick_used: number };
  timeline: Array<{ kind: string; date: string; label: string; days: number | null; status: string; note: string }>;
}
export interface OptionsResult {
  departments: string[]; projects: string[]; sites: string[];
  employees: Array<{ value: string; label: string }>; years: number[];
}

export interface DashFilters {
  period?: string; date_from?: string; date_to?: string;
  department?: string; project_name?: string; site_name?: string; employee_code?: string;
}

export const fetchSummary = (f: DashFilters): Promise<SummaryResult> => invoke('/summary', f);
export const fetchAttendanceDetails = (category: string, f: DashFilters) =>
  invoke('/attendance-details', { category, ...f });
export const fetchLeaveDetails = (leaveType: string, status: string, f: DashFilters) =>
  invoke('/leave-details', { leave_type: leaveType, status, ...f });
export const fetchBalances = (f: DashFilters & { year?: number; leave_type?: string }) =>
  invoke('/balances', f);
export const fetchEmployeeReport = (code: string, year?: number): Promise<EmployeeReportResult> =>
  invoke('/employee-report', { code, year });
export const fetchDashboardOptions = (): Promise<OptionsResult> => invoke('/options', {});

// ---------- تصدير Excel ----------
function sheetFrom(rows: Record<string, any>[], cols: Array<{ key: string; label: string }>) {
  const aoa: (string | number)[][] = [cols.map((c) => c.label)];
  (rows || []).forEach((r) => {
    aoa.push(cols.map((c) => {
      const v = r[c.key];
      return v === null || v === undefined ? '' : (typeof v === 'number' ? v : String(v));
    }));
  });
  return XLSX.utils.aoa_to_sheet(aoa);
}

export function exportRowsExcel(filename: string, sheets: Array<{ name: string; cols: Array<{ key: string; label: string }>; rows: Record<string, any>[] }>) {
  const wb = XLSX.utils.book_new();
  sheets.forEach((s) => {
    const ws = sheetFrom(s.rows, s.cols);
    XLSX.utils.book_append_sheet(wb, ws, (s.name || 'sheet').slice(0, 30));
  });
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : filename + '.xlsx');
}

// ---------- طباعة / PDF رسمي ----------
// يعتمد على منطقة seyaj-print-area المعزولة في index.css (A4، RTL، تكرار رأس الجدول).
export function printDashboardArea(areaId = 'hr-dashboard-print') {
  const el = document.getElementById(areaId);
  if (!el) return;
  if (!el.getAttribute('dir')) el.setAttribute('dir', 'rtl');
  el.classList.add('seyaj-print-area');
  window.print();
}

export const ATT_STATUS_LABEL: Record<string, string> = {
  present: 'حاضر', late: 'متأخر', absent: 'غائب', unexcused: 'غياب بدون عذر',
  permission: 'إذن', sick: 'مرضية', annual: 'سنوية', leave: 'إجازة', rest: 'راحة',
  resigned: 'استقالة', newhire: 'مباشر', transfer: 'نقل',
};