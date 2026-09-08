import { createContext, useContext, useState } from 'react';
import { seedZones, seedSites, seedProjects, seedEmployees, seedAttendance, seedRequests, seedAlerts, seedRoles } from '@/data/mock';
import {
  seedSettings, seedSiteCapacity, seedInsurance, seedViolations, seedFieldVisits, seedSupportMovements,
  type AllowanceItem, type SiteCapacity,
} from '@/lib/seyaj';

const StoreCtx = createContext({});

export function useStore(): any {
  return useContext(StoreCtx);
}

function nextId(list: any[]): number {
  return list.length ? Math.max(...list.map((x: any) => x.id)) + 1 : 1;
}

function makeCrud(setter: any) {
  return {
    add: (e: any) => setter((p: any[]) => [{ ...e, id: p.length ? Math.max(...p.map((x: any) => x.id)) + 1 : 1 }, ...p]),
    update: (e: any) => setter((p: any[]) => p.map((x: any) => (x.id === e.id ? e : x))),
    remove: (id: number) => setter((p: any[]) => p.filter((x: any) => x.id !== id)),
  };
}

export function StoreProvider({ children }: any) {
  const [zones, setZones] = useState(seedZones);
  const [sites, setSites] = useState(seedSites);
  const [projects, setProjects] = useState(seedProjects);
  const [employees, setEmployees] = useState(seedEmployees);
  const [attendance, setAttendance] = useState(seedAttendance);
  const [requests, setRequests] = useState(seedRequests);
  const [alerts] = useState(seedAlerts);
  const [roles, setRoles] = useState(seedRoles);

  // ---- بيانات التوسعة ----
  const [allowances, setAllowances] = useState<AllowanceItem[]>(seedSettings);
  const [siteCapacity, setSiteCapacity] = useState<SiteCapacity[]>(seedSiteCapacity);
  const [insurance, setInsurance] = useState(seedInsurance);
  const [violations, setViolations] = useState(seedViolations);
  const [fieldVisits, setFieldVisits] = useState(seedFieldVisits);
  const [supportMovements, setSupportMovements] = useState(seedSupportMovements);
  // مراجعات سعة المواقع (تبرير + إغلاق)
  const [capacityReviews, setCapacityReviews] = useState<any[]>([]);

  const empCrud = makeCrud(setEmployees);
  const prjCrud = makeCrud(setProjects);
  const siteCrud = makeCrud(setSites);
  const zoneCrud = makeCrud(setZones);
  const roleCrud = makeCrud(setRoles);
  const insuranceCrud = makeCrud(setInsurance);
  const violationCrud = makeCrud(setViolations);
  const visitCrud = makeCrud(setFieldVisits);
  const supportCrud = makeCrud(setSupportMovements);

  const approveAttendance = (id: number) => setAttendance((p: any[]) => p.map((x: any) => (x.id === id ? { ...x, approved: true } : x)));
  const checkOut = (id: number) => setAttendance((p: any[]) => p.map((x: any) => (x.id === id ? { ...x, checkOut: new Date().toTimeString().slice(0, 5), status: 'منصرف' } : x)));
  const decideRequest = (id: number, status: string) => setRequests((p: any[]) => p.map((x: any) => (x.id === id ? { ...x, status } : x)));
  const addRequest = (r: any) => setRequests((p: any[]) => [{ ...r, id: nextId(p) }, ...p]);

  // ---- إعدادات البدلات/الخصومات ----
  const setAllowanceAmount = (key: string, amount: number) =>
    setAllowances((p) => p.map((a) => (a.key === key ? { ...a, amount } : a)));
  const addAllowance = (a: AllowanceItem) => setAllowances((p) => [...p, { ...a, key: (a.key || 'custom_' + Date.now()) as any }]);
  const removeAllowance = (key: string) => setAllowances((p) => p.filter((a) => a.key !== key));

  // ---- سعة المواقع ----
  const upsertSiteCapacity = (cap: SiteCapacity) =>
    setSiteCapacity((p) => (p.some((c) => c.siteId === cap.siteId)
      ? p.map((c) => (c.siteId === cap.siteId ? cap : c))
      : [...p, cap]));

  // ---- مسار المخالفة ----
  const advanceViolation = (id: number, patch: any) =>
    setViolations((p) => p.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  // ---- مراجعة سعة الموقع ----
  const addCapacityReview = (r: any) =>
    setCapacityReviews((p) => [{ ...r, id: nextId(p), date: new Date().toISOString().slice(0, 10) }, ...p]);
  const closeCapacityReview = (id: number, justification: string, closer: string) =>
    setCapacityReviews((p) => p.map((r) => (r.id === id ? { ...r, justification, closedBy: closer, closed: true } : r)));

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
  };

  const value = {
    zones, sites, projects, employees, attendance, requests, alerts, roles,
    allowances, siteCapacity, insurance, violations, fieldVisits, supportMovements, capacityReviews,
    empCrud, prjCrud, siteCrud, zoneCrud, roleCrud, insuranceCrud, violationCrud, visitCrud, supportCrud,
    approveAttendance, checkOut, decideRequest, addRequest, exportCSV,
    setAllowanceAmount, addAllowance, removeAllowance, upsertSiteCapacity, advanceViolation,
    addCapacityReview, closeCapacityReview,
  };

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}