import { createContext, useContext, useState, useEffect, useCallback } from 'react';
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

const StoreCtx = createContext<any>(null);

export function useStore(): any {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

function nextId(list: any[]): number {
  return list && list.length ? Math.max(...list.map((x: any) => Number(x.id) || 0)) + 1 : 1;
}

function loadInitialDb() {
  try {
    const raw = localStorage.getItem(DB_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (err) {
    console.warn('Failed to load database from localStorage, using seeds:', err);
  }
  return null;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const initial = loadInitialDb();

  // Primary tables
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

  // Operations & HR tables
  const [allowances, setAllowances] = useState<AllowanceItem[]>(initial?.allowances ?? seedSettings);
  const [siteCapacity, setSiteCapacity] = useState<SiteCapacity[]>(initial?.siteCapacity ?? seedSiteCapacity);
  const [insurance, setInsurance] = useState<any[]>(initial?.insurance ?? seedInsurance);
  const [violations, setViolations] = useState<any[]>(initial?.violations ?? seedViolations);
  const [fieldVisits, setFieldVisits] = useState<any[]>(initial?.fieldVisits ?? seedFieldVisits);
  const [supportMovements, setSupportMovements] = useState<any[]>(initial?.supportMovements ?? seedSupportMovements);
  const [capacityReviews, setCapacityReviews] = useState<any[]>(initial?.capacityReviews ?? []);
  const [auditLogs, setAuditLogs] = useState<any[]>(initial?.auditLogs ?? INITIAL_AUDIT_LOGS);

  // Synchronize to localStorage whenever any state updates
  useEffect(() => {
    try {
      const dbDump = {
        version: '2.0',
        savedAt: new Date().toISOString(),
        zones, sites, projects, employees, attendance, requests, alerts, roles,
        users, currentUser, allowances, siteCapacity, insurance, violations,
        fieldVisits, supportMovements, capacityReviews, auditLogs,
      };
      localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(dbDump));
    } catch (e) {
      console.error('Failed to sync DB to localStorage:', e);
    }
  }, [
    zones, sites, projects, employees, attendance, requests, alerts, roles,
    users, currentUser, allowances, siteCapacity, insurance, violations,
    fieldVisits, supportMovements, capacityReviews, auditLogs,
  ]);

  // Audit logging function
  const addAuditLog = useCallback((data: { action: string; module: string; details: string; entityId?: string | number; actor?: string }) => {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const newLog = {
      id: Date.now(),
      timestamp,
      actor: data.actor || currentUser?.name || 'مستخدم النظام',
      role: currentUser?.roleName || 'مدير النظام',
      action: data.action,
      module: data.module,
      details: data.details,
      entityId: data.entityId != null ? String(data.entityId) : '—',
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  }, [currentUser]);

  // Permission checker
  const hasPerm = useCallback((moduleKey: string): boolean => {
    if (!currentUser) return false;
    // Super admin role (id 1 or name containing 'مدير النظام') has full access
    if (currentUser.roleId === 1 || currentUser.roleName === 'مدير النظام') return true;
    const userRole = roles.find((r: any) => r.id === currentUser.roleId || r.name === currentUser.roleName);
    if (!userRole) return false;
    if (userRole.perms?.includes('all')) return true;
    return Boolean(userRole.perms?.includes(moduleKey));
  }, [currentUser, roles]);

  const switchUser = (user: SystemUser) => {
    setCurrentUser(user);
    addAuditLog({
      action: 'تبديل المستخدم',
      module: 'auth',
      details: `تم تبديل المستخدم الحالي إلى ${user.name} (${user.roleName})`,
      actor: user.name,
    });
  };

  // CRUD helpers with audit logging
  const makeCrud = (setter: any, moduleName: string, entityTitle: string) => ({
    add: (item: any) => {
      const id = nextId(item.id ? [item] : []);
      setter((prev: any[]) => {
        const fullItem = { ...item, id: item.id || nextId(prev) };
        addAuditLog({
          action: `إضافة ${entityTitle}`,
          module: moduleName,
          details: `إضافة جديد: ${item.name || item.code || item.title || item.type || JSON.stringify(item).slice(0, 40)}`,
          entityId: fullItem.id,
        });
        return [fullItem, ...prev];
      });
    },
    update: (item: any) => {
      setter((prev: any[]) => {
        addAuditLog({
          action: `تعديل ${entityTitle}`,
          module: moduleName,
          details: `تحديث البيانات: ${item.name || item.code || item.title || item.id}`,
          entityId: item.id,
        });
        return prev.map((x: any) => (x.id === item.id ? { ...x, ...item } : x));
      });
    },
    remove: (id: number) => {
      setter((prev: any[]) => {
        const item = prev.find((x: any) => x.id === id);
        addAuditLog({
          action: `حذف ${entityTitle}`,
          module: moduleName,
          details: `تم حذف العنصر رقم #${id} (${item?.name || item?.code || '—'})`,
          entityId: id,
        });
        return prev.filter((x: any) => x.id !== id);
      });
    },
  });

  const empCrud = makeCrud(setEmployees, 'employees', 'موظف');
  const prjCrud = makeCrud(setProjects, 'projects', 'مشروع');
  const siteCrud = makeCrud(setSites, 'sites', 'موقع');
  const zoneCrud = makeCrud(setZones, 'zones', 'منطقة');
  const roleCrud = makeCrud(setRoles, 'roles', 'دور صلاحيات');
  const insuranceCrud = makeCrud(setInsurance, 'insurance', 'تأمين');
  const violationCrud = makeCrud(setViolations, 'violations', 'مخالفة');
  const visitCrud = makeCrud(setFieldVisits, 'visits', 'زيارة تفتيش');
  const supportCrud = makeCrud(setSupportMovements, 'support', 'حركة مساندة');

  // Attendance actions
  const approveAttendance = (id: number) => {
    setAttendance((prev: any[]) =>
      prev.map((x: any) => (x.id === id ? { ...x, approved: true } : x))
    );
    addAuditLog({
      action: 'اعتماد حضور',
      module: 'attendance',
      details: `تم اعتماد سجل الحضور رقم #${id}`,
      entityId: id,
    });
  };

  const checkOut = (id: number) => {
    const time = new Date().toTimeString().slice(0, 5);
    setAttendance((prev: any[]) =>
      prev.map((x: any) => (x.id === id ? { ...x, checkOut: time, status: 'منصرف' } : x))
    );
    addAuditLog({
      action: 'تسجيل انصراف',
      module: 'attendance',
      details: `تم تسجيل الانصراف للسجل #${id} في الوقت ${time}`,
      entityId: id,
    });
  };

  // Requests actions
  const decideRequest = (id: number, status: string, note = '') => {
    setRequests((prev: any[]) =>
      prev.map((x: any) => (x.id === id ? { ...x, status, decisionNote: note, decidedBy: currentUser?.name } : x))
    );
    addAuditLog({
      action: status === 'معتمد' ? 'اعتماد طلب' : 'رفض طلب',
      module: 'requests',
      details: `تم اتخاذ القرار (${status}) على الطلب رقم #${id}`,
      entityId: id,
    });
  };

  const addRequest = (r: any) => {
    setRequests((prev: any[]) => {
      const newR = { ...r, id: nextId(prev), createdAt: new Date().toISOString() };
      addAuditLog({
        action: 'تقديم طلب',
        module: 'requests',
        details: `طلب ${r.type} من الموظف ${r.employeeName || currentUser?.name}`,
        entityId: newR.id,
      });
      return [newR, ...prev];
    });
  };

  // Allowances
  const setAllowanceAmount = (key: string, amount: number) => {
    setAllowances((p) => p.map((a) => (a.key === key ? { ...a, amount } : a)));
    addAuditLog({
      action: 'تعديل قيمة البدل',
      module: 'settings',
      details: `تحديث البدل [${key}] إلى ${amount} ريال`,
    });
  };

  const addAllowance = (a: AllowanceItem) => {
    setAllowances((p) => [...p, { ...a, key: (a.key || 'custom_' + Date.now()) as any }]);
    addAuditLog({
      action: 'إضافة بند بدلات',
      module: 'settings',
      details: `إضافة بند جديد: ${a.label} بقيمة ${a.amount} ريال`,
    });
  };

  const removeAllowance = (key: string) => {
    setAllowances((p) => p.filter((a) => a.key !== key));
    addAuditLog({
      action: 'حذف بند بدلات',
      module: 'settings',
      details: `حذف البند: ${key}`,
    });
  };

  // Capacity
  const upsertSiteCapacity = (cap: SiteCapacity) => {
    setSiteCapacity((p) =>
      p.some((c) => c.siteId === cap.siteId)
        ? p.map((c) => (c.siteId === cap.siteId ? cap : c))
        : [...p, cap]
    );
    addAuditLog({
      action: 'تعديل سعة موقع',
      module: 'capacity',
      details: `تحديث الطاقة الاستيعابية للموقع #${cap.siteId} (أساسي: ${cap.base}، بديل: ${cap.relief})`,
      entityId: cap.siteId,
    });
  };

  // Violation workflow advance
  const advanceViolation = (id: number, patch: any) => {
    setViolations((p) => p.map((v) => (v.id === id ? { ...v, ...patch } : v)));
    addAuditLog({
      action: 'تحديث حالة مخالفة',
      module: 'violations',
      details: `تحديث مسار المخالفة #${id} (الحالة: ${patch.status || 'تحديث'})`,
      entityId: id,
    });
  };

  const addCapacityReview = (r: any) => {
    setCapacityReviews((p) => [
      { ...r, id: nextId(p), date: new Date().toISOString().slice(0, 10) },
      ...p,
    ]);
  };

  const closeCapacityReview = (id: number, justification: string, closer: string) => {
    setCapacityReviews((p) =>
      p.map((r) => (r.id === id ? { ...r, justification, closedBy: closer, closed: true } : r))
    );
    addAuditLog({
      action: 'إغلاق مراجعة سعة',
      module: 'capacity',
      details: `إغلاق تجاوز السعة #${id} بواسطة ${closer}`,
      entityId: id,
    });
  };

  // Database Management Tools
  const exportDatabaseJSON = () => {
    const fullDb = {
      app: 'Seyaj Security System',
      version: '2.0',
      exportedAt: new Date().toISOString(),
      exportedBy: currentUser?.name,
      data: {
        zones, sites, projects, employees, attendance, requests, alerts, roles,
        users, allowances, siteCapacity, insurance, violations, fieldVisits,
        supportMovements, capacityReviews, auditLogs,
      },
    };
    const jsonStr = JSON.stringify(fullDb, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seyaj_database_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addAuditLog({ action: 'تصدير نسخة احتياطية', module: 'settings', details: 'تم تنزيل نسخة احتياطية كاملة من قاعدة البيانات' });
  };

  const importDatabaseJSON = (jsonString: string): boolean => {
    try {
      const parsed = JSON.parse(jsonString);
      const data = parsed.data || parsed;
      if (data.employees) setEmployees(data.employees);
      if (data.sites) setSites(data.sites);
      if (data.projects) setProjects(data.projects);
      if (data.zones) setZones(data.zones);
      if (data.attendance) setAttendance(data.attendance);
      if (data.requests) setRequests(data.requests);
      if (data.alerts) setAlerts(data.alerts);
      if (data.roles) setRoles(data.roles);
      if (data.users) setUsers(data.users);
      if (data.allowances) setAllowances(data.allowances);
      if (data.siteCapacity) setSiteCapacity(data.siteCapacity);
      if (data.insurance) setInsurance(data.insurance);
      if (data.violations) setViolations(data.violations);
      if (data.fieldVisits) setFieldVisits(data.fieldVisits);
      if (data.supportMovements) setSupportMovements(data.supportMovements);
      if (data.capacityReviews) setCapacityReviews(data.capacityReviews);
      if (data.auditLogs) setAuditLogs(data.auditLogs);
      addAuditLog({ action: 'استعادة نسخة احتياطية', module: 'settings', details: 'تم استيراد واستعادة قاعدة البيانات بنجاح' });
      return true;
    } catch (err) {
      console.error('Failed to parse database backup:', err);
      return false;
    }
  };

  const resetDatabase = () => {
    localStorage.removeItem(DB_STORAGE_KEY);
    setZones(seedZones);
    setSites(seedSites);
    setProjects(seedProjects);
    setEmployees(seedEmployees);
    setAttendance(seedAttendance);
    setRequests(seedRequests);
    setAlerts(seedAlerts);
    setRoles(seedRoles);
    setUsers(INITIAL_USERS);
    setCurrentUser(INITIAL_USERS[0]);
    setAllowances(seedSettings);
    setSiteCapacity(seedSiteCapacity);
    setInsurance(seedInsurance);
    setViolations(seedViolations);
    setFieldVisits(seedFieldVisits);
    setSupportMovements(seedSupportMovements);
    setCapacityReviews([]);
    setAuditLogs(INITIAL_AUDIT_LOGS);
  };

  const exportCSV = (filename: string, rows: any[]) => {
    if (!rows || !rows.length) return;
    const headers = Object.keys(rows[0]);
    const esc = (v: any) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const csv = [headers.join(','), ...rows.map((r: any) => headers.map((h: string) => esc(r[h])).join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    addAuditLog({ action: 'تصدير جدول CSV', module: 'reports', details: `تصدير ملف ${filename} (${rows.length} سجل)` });
  };

  const value = {
    // Data State
    zones, sites, projects, employees, attendance, requests, alerts, roles,
    users, currentUser, allowances, siteCapacity, insurance, violations,
    fieldVisits, supportMovements, capacityReviews, auditLogs,
    // Setters
    setCurrentUser, setUsers, setRoles, setEmployees, setSites, setProjects, setAttendance,
    // Authentication & RBAC
    hasPerm, switchUser, addAuditLog,
    // CRUD Operations
    empCrud, prjCrud, siteCrud, zoneCrud, roleCrud, insuranceCrud, violationCrud, visitCrud, supportCrud,
    // Functional Handlers
    approveAttendance, checkOut, decideRequest, addRequest, exportCSV,
    setAllowanceAmount, addAllowance, removeAllowance, upsertSiteCapacity, advanceViolation,
    addCapacityReview, closeCapacityReview,
    // DB Utilities
    exportDatabaseJSON, importDatabaseJSON, resetDatabase,
  };

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}