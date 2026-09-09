import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { cloudSelect } from '@/lib/seyajCloud';
import { supabaseConfigured } from '@/lib/supabaseClient';
import { seedZones, seedSites, seedProjects, seedEmployees, seedAttendance, seedRequests, seedAlerts, seedRoles } from '@/data/mock';
import {
  seedSettings, seedSiteCapacity, seedInsurance, seedViolations, seedFieldVisits, seedSupportMovements,
  type AllowanceItem, type SiteCapacity,
} from '@/lib/seyaj';

const DB_STORAGE_KEY = 'seyaj_master_db_v2';

export interface SystemUser {
  id: number;
  name: string;
  email: string;
  roleId: number;
  roleName: string;
  phone?: string;
  jobTitle?: string;
  avatar?: string;
  employeeNo?: string;
}

export const INITIAL_USERS: SystemUser[] = [
  { id: 1, name: 'سلطان بن علي العتيبي', email: 'admin@seyaj.sa', roleId: 1, roleName: 'مدير النظام', phone: '0551234567', jobTitle: 'المدير العام / مدير النظام', employeeNo: 'EMP-1002' },
  { id: 2, name: 'خالد بن عمر الحربي', email: 'ops@seyaj.sa', roleId: 2, roleName: 'مدير عمليات', phone: '0596677889', jobTitle: 'مدير العمليات المركزية', employeeNo: 'EMP-1009' },
  { id: 3, name: 'ماجد بن سعد الدوسري', email: 'supervisor@seyaj.sa', roleId: 3, roleName: 'مشرف موقع', phone: '0553344556', jobTitle: 'مشرف موقع مالي', employeeNo: 'EMP-1003' },
  { id: 4, name: 'منى بنت عبدالله الفهيد', email: 'hr@seyaj.sa', roleId: 4, roleName: 'موظف موارد بشرية', phone: '0551100223', jobTitle: 'أخصائي الموارد البشرية', employeeNo: 'EMP-2001' },
  { id: 5, name: 'فهد بن محمد العتيبي', email: 'guard@seyaj.sa', roleId: 5, roleName: 'قارئ تقارير', phone: '0551234567', jobTitle: 'رجل أمن أول', employeeNo: 'EMP-1001' },
];

export const INITIAL_AUDIT_LOGS = [
  { id: 1, timestamp: '2026-09-08 07:05:12', actor: 'سلطان العتيبي', role: 'مدير النظام', action: 'تسجيل دخول', module: 'auth', details: 'تسجيل دخول ناجح إلى لوحة التحكم', entityId: '1' },
  { id: 2, timestamp: '2026-09-08 07:12:44', actor: 'ماجد الدوسري', role: 'مشرف موقع', action: 'اعتماد حضور', module: 'attendance', details: 'اعتماد حضور الوردية الصباحية - موقع الرياض الشمالي', entityId: 'ATT-101' },
  { id: 3, timestamp: '2026-09-08 08:30:10', actor: 'خالد الحربي', role: 'مدير عمليات', action: 'رصد جولة تفتيش', module: 'visits', details: 'توثيق زيارة فرع البنك الأهلي - جدة كورنيش', entityId: 'VISIT-1' },
  { id: 4, timestamp: '2026-09-08 09:15:20', actor: 'منى الفهيد', role: 'موظف موارد بشرية', action: 'إصدار إنذار', module: 'violations', details: 'إصدار إشعار مخالفة زي رسمي للموظف بدر المطيري', entityId: 'VIO-1' },
];

export const DEFAULT_CUSTODY_TEMPLATE = {
  companyName: 'شركة سياج للحراسات الأمنية المدنية',
  subTitle: 'المملكة العربية السعودية',
  crNumber: '1010000000',
  securityLicense: '2026/04',
  department: 'OPERATIONS',
  title: 'نموذج محضر استلام وتسليم عهدة وتجهيزات أمنية',
  termsPreamble: 'بنود وشروط النموذج الإداري المعتمد:',
  clauses: [
    { id: '1', key: 'uniformItems', label: 'الزي الأمني الرسمي', defaultValue: 'طقم زي أمني كامل (بدلة + كاب + حزام عسكري + حذاء)', isRequired: true },
    { id: '2', key: 'radioDevice', label: 'جهاز اللاسلكي والاتصالات', defaultValue: 'جهاز لاسلكي رقمي (الرقم التسلسلي)', isRequired: true },
    { id: '3', key: 'flashlight', label: 'كشاف ومصباح التفتيش الليلي', defaultValue: 'مصباح تفتيش ليلي عالي السطوع LED قابل للشحن', isRequired: true },
    { id: '4', key: 'badge', label: 'البطاقة الأمنية والتصريح', defaultValue: 'بطاقة هوية أمنية معتمدة', isRequired: true },
    { id: '5', key: 'condition', label: 'حالة العهدة والتجهيزات', defaultValue: 'ممتازة وجديدة بالكامل', isRequired: true },
  ],
  termsText: 'يقر الطرف الثاني (الموظف) باستلامه العهد والتجهيزات الأمنية الموضحة أعلاه بحالة ممتازة وصالحة للعمل، ويتعهد بالمحافظة التامة عليها واستخدامها فقط لأغراض العمل الأمني الرسمي، وإعادتها فور طلب الإدارة أو عند انتهاء فترة تكليفه، ويتحمل كامل المسؤولية النظامية والمالية عن أي فقدان أو تلف ينتج عن الإهمال أو سوء الاستخدام وفقاً للائحة الجزاءات ونظام العمل السعودي.',
  signatories: {
    employeeTitle: 'توقيع الموظف',
    hrTitle: 'الموارد البشرية',
    hrName: 'الموارد البشرية (سياج)',
    opsTitle: 'إدارة العمليات',
    opsName: 'إدارة العمليات',
    gmTitle: 'المدير العام / المالك',
    gmName: 'المدير العام',
    gmStampText: 'ختم سياج المعتمد',
  },
};

export const seedDailySupervisorSheets = [
  { id: 1, date: '2026-09-08', supervisorName: 'ماجد بن سعد الدوسري', supervisorId: 3, supervisorPhone: '0553344556', totalSites: 3, startTime: '08:00', endTime: '15:30', status: 'معتمدة', refCode: 'SUP-VISIT-2026-001', managerSign: 'سلطان العتيبي', managerSignDate: '2026-09-08 16:30', supervisorSign: 'ماجد الدوسري', supervisorSignDate: '2026-09-08 15:35', notes: 'تمت الجولة التفقدية اليومية لكافة فروع ومواقع قطاع الرياض وتأمين جميع البوابات واستبدال أفراد الأمن المتأخرين.', sitesVisited: [] },
];

export const seedCustodyRecords = [
  { id: 'DOC-OPS-2026-0205', refCode: 'DOC-OPS-2026-0205', date: '2026-09-08', department: 'OPERATIONS', employeeId: 4, employeeName: 'عبدالله بن سعد الشهري', nationalId: '1067890123', jobTitle: 'حارس أمن ميداني', siteOrProject: 'مشروع الحراسة', status: 'سليم' },
];

const StoreCtx = createContext<any>(null);
export function useStore(): any { const ctx = useContext(StoreCtx); if (!ctx) throw new Error('useStore must be used within StoreProvider'); return ctx; }
function nextId(list: any[]): number { return list && list.length ? Math.max(...list.map((x: any) => Number(x.id) || 0)) + 1 : 1; }
function loadInitialDb() { try { const raw = localStorage.getItem(DB_STORAGE_KEY); if (raw) { const parsed = JSON.parse(raw); if (parsed && typeof parsed === 'object') return parsed; } } catch (err) { console.warn('Failed to load database from localStorage, using seeds:', err); } return null; }

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const initial = loadInitialDb();
  const [zones, setZones] = useState<any[]>(initial?.zones ?? seedZones);
  const [sites, setSites] = useState<any[]>(initial?.sites ?? seedSites);
  const [projects, setProjects] = useState<any[]>(initial?.projects ?? seedProjects);
  const [employees, setEmployees] = useState<any[]>(initial?.employees ?? seedEmployees);
  const [attendance, setAttendance] = useState<any[]>(initial?.attendance ?? seedAttendance);
  const [requests, setRequests] = useState<any[]>(initial?.requests ?? seedRequests);
  const [alerts, setAlerts] = useState<any[]>(initial?.alerts ?? seedAlerts);
  const [roles, setRoles] = useState<any[]>(initial?.roles ?? seedRoles);
  const [users, setUsers] = useState<SystemUser[]>(initial?.users ?? INITIAL_USERS);
  const [currentUser, setCurrentUser] = useState<SystemUser>(initial?.currentUser ?? INITIAL_USERS[0]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(initial?.isAuthenticated ?? false);
  const [allowances, setAllowances] = useState<AllowanceItem[]>(initial?.allowances ?? seedSettings);
  const [siteCapacity, setSiteCapacity] = useState<SiteCapacity[]>(initial?.siteCapacity ?? seedSiteCapacity);
  const [insurance, setInsurance] = useState<any[]>(initial?.insurance ?? seedInsurance);
  const [violations, setViolations] = useState<any[]>(initial?.violations ?? seedViolations);
  const [fieldVisits, setFieldVisits] = useState<any[]>(initial?.fieldVisits ?? seedFieldVisits);
  const [dailySupervisorSheets, setDailySupervisorSheets] = useState<any[]>(initial?.dailySupervisorSheets ?? seedDailySupervisorSheets);
  const [supportMovements, setSupportMovements] = useState<any[]>(initial?.supportMovements ?? seedSupportMovements);
  const [capacityReviews, setCapacityReviews] = useState<any[]>(initial?.capacityReviews ?? []);
  const [auditLogs, setAuditLogs] = useState<any[]>(initial?.auditLogs ?? INITIAL_AUDIT_LOGS);
  const [custodyRecords, setCustodyRecords] = useState<any[]>(initial?.custodyRecords ?? seedCustodyRecords);
  const [custodyTemplate, setCustodyTemplate] = useState<any>(initial?.custodyTemplate ?? DEFAULT_CUSTODY_TEMPLATE);

  // Production cloud hydration: Supabase is the primary read source when configured.
  useEffect(() => {
    if (!supabaseConfigured || !isAuthenticated) return;
    let cancelled = false;
    const hydrate = async () => {
      const results = await Promise.allSettled([
        cloudSelect('employees', 'id,employee_number,full_name,mobile,email,job_title,hire_date,termination_date,status'),
        cloudSelect('sites', 'id,site_code,name,address,latitude,longitude,status,zone_id'),
        cloudSelect('projects', 'id,project_code,name,status,start_date,end_date,client_id'),
        cloudSelect('attendance', 'id,employee_number,attendance_date,check_in,check_out,attendance_status,site_id,project_id,notes'),
        cloudSelect('field_visits', 'id,employee_code,project,site,site_code,client_name,supervisor_name,visit_date,shift,rows_data,evaluation,corrective_action,notes,branch_manager_sign,branch_stamp,status,created_by,created_at,updated_at'),
        cloudSelect('siyaj_regions', 'id,code,name,manager_name'),
      ]);
      if (cancelled) return;
      const rows = (x: PromiseSettledResult<any[]>) => x.status === 'fulfilled' ? x.value : [];
      const [er, sr, pr, ar, vr, zr] = results.map(rows);
      if (er.length) setEmployees(er.map((e: any) => ({ id: e.id, name: e.full_name, no: e.employee_number, job: e.job_title || 'رجل أمن', phone: e.mobile || '', email: e.email || '', status: e.status || 'نشط', fingerprint: '—', joined: e.hire_date || '' })));
      if (sr.length) setSites(sr.map((s: any) => ({ id: s.id, code: s.site_code || s.id, name: s.name, zoneId: s.zone_id, address: s.address || '', lat: s.latitude, lng: s.longitude, status: s.status || 'تشغيل' })));
      if (pr.length) setProjects(pr.map((p: any) => ({ id: p.id, code: p.project_code || p.id, name: p.name, status: p.status || 'نشط', start: p.start_date || '', end: p.end_date || '', clientId: p.client_id })));
      if (ar.length) setAttendance(ar.map((a: any) => ({ id: a.id, employeeId: a.employee_number, date: a.attendance_date, checkIn: a.check_in || '', checkOut: a.check_out || '', status: a.attendance_status || 'حاضر', siteId: a.site_id, projectId: a.project_id, approved: true, fingerprint: '—' })));
      if (vr.length) setFieldVisits(vr);
      if (zr.length) setZones(zr.map((z: any) => ({ id: z.id, code: z.code, name: z.name, manager: z.manager_name || '' })));
    };
    void hydrate();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  useEffect(() => { try { localStorage.setItem(DB_STORAGE_KEY, JSON.stringify({ version: '2.5', savedAt: new Date().toISOString(), zones, sites, projects, employees, attendance, requests, alerts, roles, users, currentUser, isAuthenticated, allowances, siteCapacity, insurance, violations, fieldVisits, dailySupervisorSheets, supportMovements, capacityReviews, auditLogs, custodyRecords, custodyTemplate })); } catch (e) { console.error('Failed to sync DB to localStorage:', e); } }, [zones, sites, projects, employees, attendance, requests, alerts, roles, users, currentUser, isAuthenticated, allowances, siteCapacity, insurance, violations, fieldVisits, dailySupervisorSheets, supportMovements, capacityReviews, auditLogs, custodyRecords, custodyTemplate]);

  const addAuditLog = useCallback((data: { action: string; module: string; details: string; entityId?: string | number; actor?: string }) => { const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19); setAuditLogs((prev) => [{ id: Date.now(), timestamp, actor: data.actor || currentUser?.name || 'مستخدم النظام', role: currentUser?.roleName || 'مدير النظام', action: data.action, module: data.module, details: data.details, entityId: data.entityId != null ? String(data.entityId) : '—' }, ...prev]); }, [currentUser]);
  const hasPerm = useCallback((moduleKey: string): boolean => { if (!currentUser) return false; if (currentUser.roleId === 1 || currentUser.roleName === 'مدير النظام') return true; const userRole = roles.find((r: any) => r.id === currentUser.roleId || r.name === currentUser.roleName); if (!userRole) return false; if (userRole.perms?.includes('all')) return true; return Boolean(userRole.perms?.includes(moduleKey)); }, [currentUser, roles]);
  const switchUser = (user: SystemUser) => { setCurrentUser(user); setIsAuthenticated(true); addAuditLog({ action: 'تبديل المستخدم', module: 'auth', details: `تم تبديل المستخدم الحالي إلى ${user.name} (${user.roleName})`, actor: user.name }); };
  const makeCrud = (setter: any, moduleName: string, entityTitle: string) => ({ add: (item: any) => { setter((prev: any[]) => { const fullItem = { ...item, id: item.id || nextId(prev) }; addAuditLog({ action: `إضافة ${entityTitle}`, module: moduleName, details: `إضافة جديد: ${item.name || item.code || item.title || item.type || JSON.stringify(item).slice(0, 40)}`, entityId: fullItem.id }); return [fullItem, ...prev]; }); }, update: (item: any) => { setter((prev: any[]) => { addAuditLog({ action: `تعديل ${entityTitle}`, module: moduleName, details: `تحديث البيانات: ${item.name || item.code || item.title || item.id}`, entityId: item.id }); return prev.map((x: any) => (x.id === item.id ? { ...x, ...item } : x)); }); }, remove: (id: number) => { setter((prev: any[]) => { const item = prev.find((x: any) => x.id === id); addAuditLog({ action: `حذف ${entityTitle}`, module: moduleName, details: `تم حذف العنصر رقم #${id} (${item?.name || item?.code || '—'})`, entityId: id }); return prev.filter((x: any) => x.id !== id); }); } });
  const empCrud = makeCrud(setEmployees, 'employees', 'موظف');
  const prjCrud = makeCrud(setProjects, 'projects', 'مشروع');
  const siteCrud = makeCrud(setSites, 'sites', 'موقع');
  const zoneCrud = makeCrud(setZones, 'zones', 'منطقة');
  const roleCrud = makeCrud(setRoles, 'roles', 'دور صلاحيات');
  const insuranceCrud = makeCrud(setInsurance, 'insurance', 'تأمين');
  const violationCrud = makeCrud(setViolations, 'violations', 'مخالفة');
  const visitCrud = makeCrud(setFieldVisits, 'visits', 'زيارة تفتيش');
  const supportCrud = makeCrud(setSupportMovements, 'support', 'حركة مساندة');
  const approveAttendance = (id: number) => { setAttendance((prev: any[]) => prev.map((x: any) => (x.id === id ? { ...x, approved: true } : x))); addAuditLog({ action: 'اعتماد حضور', module: 'attendance', details: `تم اعتماد سجل الحضور رقم #${id}`, entityId: id }); };
  const checkOut = (id: number) => { const time = new Date().toTimeString().slice(0, 5); setAttendance((prev: any[]) => prev.map((x: any) => (x.id === id ? { ...x, checkOut: time, status: 'منصرف' } : x))); addAuditLog({ action: 'تسجيل انصراف', module: 'attendance', details: `تم تسجيل الانصراف للسجل #${id} في الوقت ${time}`, entityId: id }); };
  const decideRequest = (id: number, status: string, note = '') => { setRequests((prev: any[]) => prev.map((x: any) => (x.id === id ? { ...x, status, decisionNote: note, decidedBy: currentUser?.name } : x))); addAuditLog({ action: status === 'معتمد' ? 'اعتماد طلب' : 'رفض طلب', module: 'requests', details: `تم اتخاذ القرار (${status}) على الطلب رقم #${id}`, entityId: id }); };
  const addRequest = (r: any) => { setRequests((prev: any[]) => { const newR = { ...r, id: nextId(prev), createdAt: new Date().toISOString() }; addAuditLog({ action: 'تقديم طلب', module: 'requests', details: `طلب ${r.type} من الموظف ${r.employeeName || currentUser?.name}`, entityId: newR.id }); return [newR, ...prev]; }); };
  const setAllowanceAmount = (key: string, amount: number) => { setAllowances((p) => p.map((a) => (a.key === key ? { ...a, amount } : a))); addAuditLog({ action: 'تعديل قيمة البدل', module: 'settings', details: `تحديث البدل [${key}] إلى ${amount} ريال` }); };
  const addAllowance = (a: AllowanceItem) => { setAllowances((p) => [...p, { ...a, key: (a.key || 'custom_' + Date.now()) as any }]); addAuditLog({ action: 'إضافة بند بدلات', module: 'settings', details: `إضافة بند جديد: ${a.label} بقيمة ${a.amount} ريال` }); };
  const removeAllowance = (key: string) => { setAllowances((p) => p.filter((a) => a.key !== key)); addAuditLog({ action: 'حذف بند بدلات', module: 'settings', details: `حذف البند: ${key}` }); };
  const upsertSiteCapacity = (cap: SiteCapacity) => { setSiteCapacity((p) => p.some((c) => c.siteId === cap.siteId) ? p.map((c) => c.siteId === cap.siteId ? cap : c) : [...p, cap]); addAuditLog({ action: 'تعديل سعة موقع', module: 'capacity', details: `تحديث الطاقة الاستيعابية للموقع #${cap.siteId}`, entityId: cap.siteId }); };
  const advanceViolation = (id: number, patch: any) => { setViolations((p) => p.map((v) => (v.id === id ? { ...v, ...patch } : v))); addAuditLog({ action: 'تحديث حالة مخالفة', module: 'violations', details: `تحديث مسار المخالفة #${id}`, entityId: id }); };
  const addCapacityReview = (r: any) => setCapacityReviews((p) => [{ ...r, id: nextId(p), date: new Date().toISOString().slice(0, 10) }, ...p]);
  const closeCapacityReview = (id: number, justification: string, closer: string) => { setCapacityReviews((p) => p.map((r) => (r.id === id ? { ...r, justification, closedBy: closer, closed: true } : r))); addAuditLog({ action: 'إغلاق مراجعة سعة', module: 'capacity', details: `إغلاق تجاوز السعة #${id} بواسطة ${closer}`, entityId: id }); };
  const exportDatabaseJSON = () => { const fullDb = { app: 'Seyaj Security System', version: '2.5', exportedAt: new Date().toISOString(), exportedBy: currentUser?.name, data: { zones, sites, projects, employees, attendance, requests, alerts, roles, users, allowances, siteCapacity, insurance, violations, fieldVisits, dailySupervisorSheets, supportMovements, capacityReviews, auditLogs, custodyRecords, custodyTemplate } }; const jsonStr = JSON.stringify(fullDb, null, 2); const blob = new Blob([jsonStr], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `seyaj_database_backup_${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url); addAuditLog({ action: 'تصدير نسخة احتياطية', module: 'settings', details: 'تم تنزيل نسخة احتياطية كاملة من قاعدة البيانات' }); };
  const importDatabaseJSON = (jsonString: string): boolean => { try { const parsed = JSON.parse(jsonString); const data = parsed.data || parsed; if (data.employees) setEmployees(data.employees); if (data.sites) setSites(data.sites); if (data.projects) setProjects(data.projects); if (data.zones) setZones(data.zones); if (data.attendance) setAttendance(data.attendance); if (data.requests) setRequests(data.requests); if (data.alerts) setAlerts(data.alerts); if (data.roles) setRoles(data.roles); if (data.users) setUsers(data.users); if (data.allowances) setAllowances(data.allowances); if (data.siteCapacity) setSiteCapacity(data.siteCapacity); if (data.insurance) setInsurance(data.insurance); if (data.violations) setViolations(data.violations); if (data.fieldVisits) setFieldVisits(data.fieldVisits); if (data.supportMovements) setSupportMovements(data.supportMovements); if (data.capacityReviews) setCapacityReviews(data.capacityReviews); if (data.auditLogs) setAuditLogs(data.auditLogs); if (data.custodyRecords) setCustodyRecords(data.custodyRecords); if (data.custodyTemplate) setCustodyTemplate(data.custodyTemplate); addAuditLog({ action: 'استعادة نسخة احتياطية', module: 'settings', details: 'تم استيراد واستعادة قاعدة البيانات بنجاح' }); return true; } catch (err) { console.error('Failed to parse database backup:', err); return false; } };
  const resetDatabase = () => { localStorage.removeItem(DB_STORAGE_KEY); setZones(seedZones); setSites(seedSites); setProjects(seedProjects); setEmployees(seedEmployees); setAttendance(seedAttendance); setRequests(seedRequests); setAlerts(seedAlerts); setRoles(seedRoles); setUsers(INITIAL_USERS); setCurrentUser(INITIAL_USERS[0]); setIsAuthenticated(false); setAllowances(seedSettings); setSiteCapacity(seedSiteCapacity); setInsurance(seedInsurance); setViolations(seedViolations); setFieldVisits(seedFieldVisits); setDailySupervisorSheets(seedDailySupervisorSheets); setSupportMovements(seedSupportMovements); setCapacityReviews([]); setAuditLogs(INITIAL_AUDIT_LOGS); setCustodyRecords(seedCustodyRecords); setCustodyTemplate(DEFAULT_CUSTODY_TEMPLATE); };
  const exportCSV = (filename: string, rows: any[]) => { if (!rows || !rows.length) return; const headers = Object.keys(rows[0]); const esc = (v: any) => '"' + String(v ?? '').replace(/"/g, '""') + '"'; const csv = [headers.join(','), ...rows.map((r: any) => headers.map((h: string) => esc(r[h])).join(','))].join('\n'); const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); addAuditLog({ action: 'تصدير جدول CSV', module: 'reports', details: `تصدير ملف ${filename} (${rows.length} سجل)` }); };

  const value = { zones, sites, projects, employees, attendance, requests, alerts, roles, users, currentUser, isAuthenticated, allowances, siteCapacity, insurance, violations, fieldVisits, dailySupervisorSheets, supportMovements, capacityReviews, auditLogs, custodyRecords, custodyTemplate, setCurrentUser, setUsers, setRoles, setEmployees, setSites, setProjects, setAttendance, setIsAuthenticated, setCustodyRecords, setCustodyTemplate, hasPerm, switchUser, addAuditLog, empCrud, prjCrud, siteCrud, zoneCrud, roleCrud, insuranceCrud, violationCrud, visitCrud, supportCrud, approveAttendance, checkOut, decideRequest, addRequest, exportCSV, setAllowanceAmount, addAllowance, removeAllowance, upsertSiteCapacity, advanceViolation, addCapacityReview, closeCapacityReview, exportDatabaseJSON, importDatabaseJSON, resetDatabase };
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
