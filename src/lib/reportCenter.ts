import { computeMonth, isoOf, daysInMonth, deriveDay } from './timesheetLogic';
import { salaryOf, computeNet, fmt } from './seyaj';
export interface ReportFilters { from: string; to: string; employeeId: string; projectId: string; siteId: string; zoneId: string; status: string; search: string }
export const EMPTY_FILTERS: ReportFilters = { from: '', to: '', employeeId: 'all', projectId: 'all', siteId: 'all', zoneId: 'all', status: 'all', search: '' }
export interface ReportResult { title: string; columns: string[]; rows: any[][] }
export const zoneOf = (store: any, e: any) => {
  const site = store.sites.find((s: any) => s.id === e.siteId);
  return site ? site.zoneId : 0;
};
export const inRange = (iso: string, f: ReportFilters) => {
  if (!iso) return false;
  if (f.from) { if (f.from > iso) return false; }
  if (f.to) { if (iso > f.to) return false; }
  return true;
};
export function filterEmployees(store: any, f: ReportFilters): any[] {
  const q = (f.search || '').trim();
  return store.employees.filter((e: any) => {
    if (f.employeeId !== 'all') { if (String(e.no) !== f.employeeId) return false; }
    if (f.projectId !== 'all') { if (String(e.projectId) !== f.projectId) return false; }
    if (f.siteId !== 'all') { if (String(e.siteId) !== f.siteId) return false; }
    if (f.zoneId !== 'all') { if (String(zoneOf(store, e)) !== f.zoneId) return false; }
    if (f.status !== 'all') { if (e.status !== f.status) return false; }
    if (q) { if (e.name.indexOf(q) === -1) { if (e.no.indexOf(q) === -1) return false; } }
    return true;
  });
}
export function dayStatusFor(store: any, e: any, iso: string): string {
  const a = store.attendance.find((x: any) => x.employeeId === e.id && x.date === iso);
  const r = store.requests.find((x: any) => x.employeeId === e.id && x.date === iso);
  if (r) {
    const t = String(r.type || '');
    if (t.indexOf('إجازة مرضية') > -1) return 'غياب بعذر';
    if (t.indexOf('إجازة') > -1) return 'إجازة';
    if (t.indexOf('استئذان') > -1) return 'استئذان';
    if (t.indexOf('مأمورية') > -1) return 'مأمورية';
    if (t.indexOf('ساعات إضافية') > -1) return 'ساعات إضافية';
  }
  if (a) {
    if (a.status === 'غائب') return 'غياب';
    if (a.status === 'متأخر') return 'تأخير';
    if (a.status === 'منصرف') return 'انصراف';
    if (a.status === 'حاضر') return 'حضور';
  }
  return '';
}
const pad2 = (n: number) => String(n).padStart(2, '0');
export function empById(store: any, id: number): any {
  const e = store.employees.find((x: any) => x.id === id);
  return e ? e : { no: '—', name: '—', job: '—', projectId: 0, siteId: 0, phone: '—', email: '—', status: '—', fingerprint: '—', joined: '—' };
}
export function siteNameOf(store: any, id: number): string { const s = store.sites.find((x: any) => x.id === id); return s ? s.name : '—'; }
export function projectNameOf(store: any, id: number): string { const p = store.projects.find((x: any) => x.id === id); return p ? p.name : '—'; }
export function zoneNameOf(store: any, id: number): string { const z = store.zones.find((x: any) => x.id === id); return z ? z.name : '—'; }
export function rangeDates(f: ReportFilters, year: number, month: number): string[] {
  let from = f.from;
  let to = f.to;
  if (!from) from = isoOf(year, month, 1);
  if (!to) to = isoOf(year, month, daysInMonth(year, month));
  const out: string[] = [];
  const fp = from.split('-');
  const ep = to.split('-');
  let cur = new Date(Number(fp[0]), Number(fp[1]) - 1, Number(fp[2]));
  const end = new Date(Number(ep[0]), Number(ep[1]) - 1, Number(ep[2]));
  let guard = 0;
  while (cur.getTime() <= end.getTime()) {
    out.push(cur.getFullYear() + '-' + pad2(cur.getMonth() + 1) + '-' + pad2(cur.getDate()));
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
    guard += 1;
    if (guard > 400) break;
  }
  return out;
}
export interface ReportDef { key: string; label: string; desc: string }
export const REPORT_CATALOG: ReportDef[] = [
  { key: 'attendance', label: 'الحضور والانصراف', desc: 'سجل دخول وخروج الموظفين ضمن الفترة مع البصمة والاعتماد' },
  { key: 'absent', label: 'الغياب', desc: 'الأيام التي لم يسجّل فيها حضور دون عذر معتمد' },
  { key: 'late', label: 'التأخير', desc: 'حالات التأخر عن بداية الوردية مع المدة بالدقائق' },
  { key: 'leave', label: 'الإجازات', desc: 'طلبات الإجازة بأنواعها ضمن الفترة مع حالة الاعتماد' },
  { key: 'permits', label: 'الاستئذانات', desc: 'طلبات الاستئذان ضمن الفترة مع السبب والحالة' },
  { key: 'workhours', label: 'ساعات العمل', desc: 'إجمالي ساعات العمل الفعلية والتأخير لكل موظف' },
  { key: 'overtime', label: 'الساعات الإضافية', desc: 'إجمالي الساعات الإضافية والتمديد بعد نهاية الوردية' },
  { key: 'monthly', label: 'التايم شيت الشهري', desc: 'ملخص الشهر لكل موظف: حضور وغياب وإجازة وراحة ونسبة الالتزام' },
  { key: 'employees', label: 'الموظفين', desc: 'قائمة الموظفين حسب الفلاتر المختارة مع بيانات الإسناد' },
  { key: 'byproject', label: 'حسب المشروع', desc: 'تجميع المؤشرات لكل مشروع' },
  { key: 'bysite', label: 'حسب الموقع', desc: 'تجميع المؤشرات لكل موقع مع منطقته' },
  { key: 'byzone', label: 'حسب المنطقة', desc: 'تجميع المؤشرات لكل منطقة إدارية' },
  { key: 'payroll', label: 'ملخص الرواتب وأيام العمل', desc: 'الأساسي والبدلات والتأمين والمخالفات والصافي وأيام العمل' },
  { key: 'emp_profile', label: 'ملف الموظف الشامل', desc: 'حركة الموظف الكاملة من الخادم حسب employee_code: بيانات وإسنادات ومؤهلات ومخالفات وخطابات وزيارات وتدقيق' },
  { key: 'emp_payroll', label: 'رواتب موظف', desc: 'كل المسيرات المستوردة للموظف من imported_payroll_records عبر employee_code' },
  { key: 'emp_violations', label: 'جزاءات موظف', desc: 'مخالفات العمل والمرور للموظف ضمن الفترة عبر employee_code' },
  { key: 'emp_visits', label: 'زيارات المشرفين', desc: 'زيارات المشرفين الميدانية لكل الموظفين أو لموظف محدد عبر employee_code' },
];
export function runReport(store: any, key: string, f: ReportFilters, year: number, month: number): ReportResult {
  const emps = filterEmployees(store, f);
  const dates = rangeDates(f, year, month);
  const input = { attendance: store.attendance, requests: store.requests };
  const dayOf = (e: any, iso: string) => deriveDay(e.id, Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), Number(iso.slice(8, 10)), input);
  const dedTotal = store.allowances.reduce((s: number, a: any) => { if (a.kind === 'deduction') { if (a.amount > 0) return s + a.amount; } return s; }, 0);
  const insOf = (e: any) => { const i = store.insurance.find((x: any) => x.employeeName === e.name); return i ? i.monthlyDeduction : 0; };
  const vioOf = (e: any) => store.violations.reduce((s: number, v: any) => { if (v.employeeName === e.name) { if (v.status === 'deducted') return s + v.amount; } return s; }, 0);
  if (key === 'attendance') {
    const rows = store.attendance.filter((a: any) => { if (!inRange(a.date, f)) return false; return emps.some((e: any) => e.id === a.employeeId); }).map((a: any) => {
      const e = empById(store, a.employeeId);
      return [e.no, e.name, projectNameOf(store, e.projectId), siteNameOf(store, e.siteId), a.date, a.checkIn || '—', a.checkOut || '—', a.status, a.fingerprint, a.location || '—', a.approved ? 'معتمد' : 'معلق'];
    });
    return { title: 'تقرير الحضور والانصراف', columns: ['الرقم الوظيفي', 'الاسم', 'المشروع', 'الموقع', 'التاريخ', 'دخول', 'خروج', 'الحالة', 'البصمة', 'الموقع الجغرافي', 'الاعتماد'], rows };
  }
  if (key === 'absent') {
    const rows: any[][] = [];
    for (const e of emps) { for (const iso of dates) { const st = dayOf(e, iso); if (st.status === 'غياب') rows.push([e.no, e.name, projectNameOf(store, e.projectId), siteNameOf(store, e.siteId), iso]); } }
    return { title: 'تقرير الغياب', columns: ['الرقم الوظيفي', 'الاسم', 'المشروع', 'الموقع', 'التاريخ'], rows };
  }
  if (key === 'late') {
    const rows: any[][] = [];
    for (const e of emps) { for (const iso of dates) { const st = dayOf(e, iso); if (st.status === 'تأخير') rows.push([e.no, e.name, projectNameOf(store, e.projectId), siteNameOf(store, e.siteId), iso, st.checkIn, String(st.lateMin) + ' د']); } }
    return { title: 'تقرير التأخير', columns: ['الرقم الوظيفي', 'الاسم', 'المشروع', 'الموقع', 'التاريخ', 'وقت الدخول', 'مدة التأخير'], rows };
  }
  if (key === 'leave') {
    const rows = store.requests.filter((r: any) => { if (String(r.type).indexOf('إجازة') === -1) return false; if (!inRange(r.date, f)) return false; return emps.some((e: any) => e.id === r.employeeId); }).map((r: any) => {
      const e = empById(store, r.employeeId);
      return [e.no, e.name, projectNameOf(store, e.projectId), siteNameOf(store, e.siteId), r.date, r.type, r.from || '—', r.to || '—', r.reason || '—', r.status];
    });
    return { title: 'تقرير الإجازات', columns: ['الرقم الوظيفي', 'الاسم', 'المشروع', 'الموقع', 'التاريخ', 'النوع', 'من', 'إلى', 'السبب', 'الحالة'], rows };
  }
  if (key === 'permits') {
    const rows = store.requests.filter((r: any) => { if (String(r.type).indexOf('استئذان') === -1) return false; if (!inRange(r.date, f)) return false; return emps.some((e: any) => e.id === r.employeeId); }).map((r: any) => {
      const e = empById(store, r.employeeId);
      return [e.no, e.name, projectNameOf(store, e.projectId), siteNameOf(store, e.siteId), r.date, r.from || '—', r.to || '—', r.reason || '—', r.status];
    });
    return { title: 'تقرير الاستئذانات', columns: ['الرقم الوظيفي', 'الاسم', 'المشروع', 'الموقع', 'التاريخ', 'من', 'إلى', 'السبب', 'الحالة'], rows };
  }
  if (key === 'workhours') {
    const rows = emps.map((e: any) => {
      let hours = 0; let late = 0;
      for (const iso of dates) { const st = dayOf(e, iso); hours += st.workHours; late += st.lateMin; }
      return [e.no, e.name, projectNameOf(store, e.projectId), siteNameOf(store, e.siteId), String(dates.length), String(Math.round(hours * 10) / 10), String(Math.round((late / 60) * 10) / 10)];
    });
    return { title: 'تقرير ساعات العمل', columns: ['الرقم الوظيفي', 'الاسم', 'المشروع', 'الموقع', 'عدد الأيام', 'ساعات فعلية', 'ساعات تأخير'], rows };
  }
  if (key === 'overtime') {
    const rows = emps.map((e: any) => {
      let ot = 0;
      for (const iso of dates) { ot += dayOf(e, iso).overtimeMin; }
      return [e.no, e.name, projectNameOf(store, e.projectId), siteNameOf(store, e.siteId), String(Math.round((ot / 60) * 10) / 10)];
    }).filter((r: any) => Number(r[4]) > 0);
    return { title: 'تقرير الساعات الإضافية', columns: ['الرقم الوظيفي', 'الاسم', 'المشروع', 'الموقع', 'ساعات إضافية'], rows };
  }
  if (key === 'monthly') {
    const rows = emps.map((e: any) => {
      const s = computeMonth(e.id, year, month, input, {}, f.from || '', f.to || '');
      return [e.no, e.name, projectNameOf(store, e.projectId), siteNameOf(store, e.siteId), String(s.present), String(s.absent), String(s.leave), String(s.rest), String(s.workHours), String(s.overtimeHours), String(s.rate) + '%'];
    });
    return { title: 'التايم شيت الشهري (ملخص)', columns: ['الرقم الوظيفي', 'الاسم', 'المشروع', 'الموقع', 'حضور', 'غياب', 'إجازة', 'راحة', 'ساعات', 'إضافي', 'الالتزام'], rows };
  }
  if (key === 'employees') {
    const rows = emps.map((e: any) => [e.no, e.name, e.job, projectNameOf(store, e.projectId), siteNameOf(store, e.siteId), zoneNameOf(store, zoneOf(store, e)), e.phone, e.status, e.fingerprint, e.joined]);
    return { title: 'قائمة الموظفين', columns: ['الرقم الوظيفي', 'الاسم', 'المسمى', 'المشروع', 'الموقع', 'المنطقة', 'الجوال', 'الحالة', 'البصمة', 'تاريخ التعيين'], rows };
  }
  if (key === 'byproject') {
    const ids = Array.from(new Set(emps.map((e: any) => e.projectId)));
    const rows = ids.map((pid: number) => {
      const list = emps.filter((e: any) => e.projectId === pid);
      let present = 0; let absent = 0; let hours = 0;
      for (const e of list) { for (const iso of dates) { const st = dayOf(e, iso); if (st.status === 'حضور') present += 1; if (st.status === 'غياب') absent += 1; hours += st.workHours; } }
      return [projectNameOf(store, pid), String(list.length), String(present), String(absent), String(Math.round(hours))];
    });
    return { title: 'التقرير حسب المشروع', columns: ['المشروع', 'عدد الموظفين', 'أيام حضور', 'أيام غياب', 'ساعات عمل'], rows };
  }
  if (key === 'bysite') {
    const ids = Array.from(new Set(emps.map((e: any) => e.siteId)));
    const rows = ids.map((sid: number) => {
      const list = emps.filter((e: any) => e.siteId === sid);
      let present = 0; let absent = 0; let hours = 0;
      for (const e of list) { for (const iso of dates) { const st = dayOf(e, iso); if (st.status === 'حضور') present += 1; if (st.status === 'غياب') absent += 1; hours += st.workHours; } }
      return [siteNameOf(store, sid), String(list.length), String(present), String(absent), String(Math.round(hours))];
    });
    return { title: 'التقرير حسب الموقع', columns: ['الموقع', 'عدد الموظفين', 'أيام حضور', 'أيام غياب', 'ساعات عمل'], rows };
  }
  if (key === 'byzone') {
    const ids = Array.from(new Set(emps.map((e: any) => zoneOf(store, e))));
    const rows = ids.map((zid: number) => {
      const list = emps.filter((e: any) => zoneOf(store, e) === zid);
      let present = 0; let absent = 0; let hours = 0;
      for (const e of list) { for (const iso of dates) { const st = dayOf(e, iso); if (st.status === 'حضور') present += 1; if (st.status === 'غياب') absent += 1; hours += st.workHours; } }
      return [zoneNameOf(store, zid), String(list.length), String(present), String(absent), String(Math.round(hours))];
    });
    return { title: 'التقرير حسب المنطقة', columns: ['المنطقة', 'عدد الموظفين', 'أيام حضور', 'أيام غياب', 'ساعات عمل'], rows };
  }
  const rows = emps.map((e: any) => {
    const s = computeMonth(e.id, year, month, input, {}, f.from || '', f.to || '');
    const base = salaryOf(e.job);
    const ins = insOf(e);
    const vio = vioOf(e);
    const net = computeNet({ baseSalary: base, allowances: 0, deductions: dedTotal, insurance: ins, violations: vio });
    return [e.no, e.name, e.job, projectNameOf(store, e.projectId), siteNameOf(store, e.siteId), fmt(base), fmt(dedTotal), fmt(ins), fmt(vio), fmt(net), String(s.actualDays), String(s.requiredDays), String(s.rate) + '%'];
  });
  return { title: 'ملخص الرواتب وأيام العمل', columns: ['الرقم الوظيفي', 'الاسم', 'المسمى', 'المشروع', 'الموقع', 'أساسي', 'بدلات/خصومات', 'تأمين', 'مخالفات', 'صافي', 'أيام فعلية', 'أيام مطلوبة', 'الالتزام'], rows };
}
