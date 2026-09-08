import { client } from './api';

// ---------- constants ----------
export const BUCKET = 'seyaj-docs';

export const STATUS_AR: Record<string, string> = {
  present: 'حاضر',
  late: 'متأخر',
  checked_out: 'منصرف',
};

export const REQ_STATUS_AR: Record<string, string> = {
  pending: 'معلق',
  approved: 'معتمد',
  rejected: 'مرفوض',
};

export const REQ_STATUS_CODE: Record<string, string> = {
  'معلق': 'pending',
  'معتمد': 'approved',
  'مرفوض': 'rejected',
};

export const REQ_TYPES = [
  'طلب إذن',
  'طلب إجازة سنوية',
  'طلب نقل من فترة إلى أخرى',
  'طلب نقل إلى موقع أو مشروع آخر',
  'رفع إجازة مرضية',
  'طلب تعريف راتب',
  'طلب تغيير حساب بنكي',
  'أخرى',
];

// الأنواع التي تتطلب مرفقاً إلزامياً
export const REQ_TYPES_NEED_ATTACH = ['رفع إجازة مرضية', 'طلب تغيير حساب بنكي'];

export const SHIFT_PERIODS = ['صباحية', 'مسائية', 'ليلية'];

export function defaultShiftPeriod(): string {
  const h = new Date().getHours();
  if (h >= 6 && h < 14) return 'صباحية';
  if (h >= 14 && h < 22) return 'مسائية';
  return 'ليلية';
}

// ---------- validators ----------
// رقم الهوية السعودية: يبدأ بـ1 ولا يتجاوز 10 أرقام
export function validateSaId(v: string): boolean {
  return /^1\d{9}$/.test(v.trim());
}

// رقم الجوال: يبدأ بـ05 ولا يتجاوز 10 أرقام
export function validateSaPhone(v: string): boolean {
  return /^05\d{8}$/.test(v.trim());
}

// ---------- time helpers ----------
export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function getPosition(): Promise<{ lat: number; lng: number; accuracy: number | null } | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) { resolve(null); return; }
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; resolve(null); } }, 8000);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        if (!done) {
          done = true; clearTimeout(t);
          resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy ?? null });
        }
      },
      () => { if (!done) { done = true; clearTimeout(t); resolve(null); } },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  });
}

// ---------- auth ----------
export async function getMe(): Promise<any | null> {
  try {
    const res = await client.auth.me();
    return res?.data ?? null;
  } catch {
    return null;
  }
}

export function startLogin(returnTo: string) {
  try { sessionStorage.setItem('seyaj_return_to', returnTo); } catch { /* ignore */ }
  client.auth.toLogin();
}

export function logout() {
  return client.auth.logout();
}

// ---------- attendance ----------
export async function fetchAllAttendance(): Promise<any[]> {
  const res = await client.entities.attendance_logs.queryAll({ sort: '-work_date,-id', limit: 500 });
  return res?.data?.items ?? [];
}

export async function fetchMyAttendance(): Promise<any[]> {
  const res = await client.entities.attendance_logs.query({ sort: '-work_date,-id', limit: 200 });
  return res?.data?.items ?? [];
}

export async function checkInRecord(data: {
  employee_name: string;
  employee_code: string;
  site_name: string;
  work_date: string;
  check_in_time: string;
  check_in_lat: number | null;
  check_in_lng: number | null;
  status: string;
}) {
  const res = await client.entities.attendance_logs.create({ data });
  return res?.data;
}

export async function checkOutOwn(id: number, time: string, lat: number | null, lng: number | null) {
  const data: any = { check_out_time: time, status: 'checked_out' };
  if (lat != null) data.check_out_lat = lat;
  if (lng != null) data.check_out_lng = lng;
  const res = await client.entities.attendance_logs.update({ id, data });
  return res?.data;
}

export async function adminCheckout(id: number, time: string) {
  const res = await client.apiCall.invoke({
    url: `/api/v1/seyaj/attendance/${id}/checkout`,
    method: 'PUT',
    data: { check_out_time: time, status: 'checked_out' },
  });
  return res?.data;
}

// ---------- server-side attendance with geofence ----------
// التسجيل يمر عبر نقاط خادمية تفرض التحقق الجغرافي (Geofence) ولا يمكن تجاوزه
// من المتصفح. عند الرفض يعيد الخادم رسالة عربية في حقل detail نستخرجها ونعرضها.

export function extractApiError(err: any): string {
  const detail = err?.response?.data?.detail ?? err?.data?.detail ?? err?.detail ?? err?.message ?? '';
  const msg = String(detail || '');
  if (!msg) return 'تعذّر إتمام العملية، حاول مجدداً';
  return msg;
}

export async function serverCheckIn(data: {
  employee_code: string;
  employee_name?: string;
  site_name?: string;
  project_name?: string;
  work_date: string;
  check_in_time: string;
  lat?: number | null;
  lng?: number | null;
  accuracy?: number | null;
  site_id?: number | null;
}): Promise<any> {
  const res = await client.apiCall.invoke({
    url: '/api/v1/seyaj/attendance/check-in',
    method: 'POST',
    data,
  });
  return res?.data;
}

export async function serverCheckOut(data: {
  record_id: number;
  check_out_time: string;
  lat?: number | null;
  lng?: number | null;
  accuracy?: number | null;
  site_id?: number | null;
}): Promise<any> {
  const res = await client.apiCall.invoke({
    url: '/api/v1/seyaj/attendance/check-out',
    method: 'POST',
    data,
  });
  return res?.data;
}

export async function fetchMapLogs(params?: { work_date?: string; site_name?: string }): Promise<any[]> {
  const res = await client.apiCall.invoke({
    url: '/api/v1/seyaj/attendance/map-logs',
    method: 'GET',
    data: params || {},
  });
  return res?.data?.rows ?? [];
}

// ---------- storage (attachments & patrol report images) ----------
// طبقة تخزين مزدوجة المصدر: توجّه العمليات إلى Backblaze B2 عبر مسار خادومي
// آمن يقرأ المفاتيح من متغيرات البيئة فقط، مع تراجع تلقائي إلى تخزين Atoms
// Cloud القديم حتى تستمر المرفقات السابقة بالعمل دون أي تغيير في الواجهة.

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function buildObjectKey(file: File, prefix: string): string {
  const safe = file.name.replace(/[^\w.\u0600-\u06FF-]/g, '_');
  return `${prefix}/${Date.now()}-${safe}`;
}

// يميّز رفض الصلاحيات (403) عن أعطال البنية التحتية (B2 غير مهيأ/فشل رفع)، حتى لا
// يتجاوز العميل حارس الخادم بالتراجع الصامت إلى Atoms Cloud عند منع الموظف العادي.
function isPermissionError(err: any): boolean {
  const status = err?.status ?? err?.statusCode ?? err?.response?.status ?? err?.data?.status;
  if (status === 403) return true;
  const msg = String(err?.message ?? err?.detail ?? err?.response?.data?.detail ?? err?.data?.detail ?? '');
  return msg.includes('403') || msg.toLowerCase().includes('forbidden') || msg.includes('القراءة فقط');
}

export async function uploadDoc(file: File, prefix: string): Promise<{ object_key: string; file_name: string }> {
  const object_key = buildObjectKey(file, prefix);
  // 1) جرّب Backblaze B2 عبر الخادم
  try {
    const data_base64 = await fileToBase64(file);
    const res: any = await client.apiCall.invoke({
      url: '/api/v1/seyaj/storage/upload',
      method: 'POST',
      data: { object_key, file_name: file.name, content_type: file.type || 'application/octet-stream', data_base64 },
    });
    const key = res?.data?.object_key;
    if (key) return { object_key: key, file_name: file.name };
  } catch (err) {
    // لا تتجاوز حارس الخادم: رفض الصلاحيات (403) يعني منع الكتابة فعلياً، يُعاد كما هو.
    if (isPermissionError(err)) throw err;
    /* تراجع آمن إلى Atoms Cloud فقط عند أعطال البنية (B2 غير مهيأ/فشل رفع) */
  }
  // 2) تراجع: تخزين Atoms Cloud القديم
  const res: any = await client.storage.upload({ bucket_name: BUCKET, object_key, file });
  return { object_key: res?.object_key ?? object_key, file_name: file.name };
}

export async function getFileUrl(object_key?: string | null): Promise<string> {
  if (!object_key) return '';
  // 1) جرّب الخادم (B2 أولاً ثم تراجع Atoms داخل نفس المسار)
  try {
    const res: any = await client.apiCall.invoke({
      url: '/api/v1/seyaj/storage/download-url',
      method: 'GET',
      data: { object_key },
    });
    const url = res?.data?.download_url ?? '';
    if (url) return url;
  } catch { /* تراجع */ }
  // 2) تراجع مباشر إلى Atoms Cloud
  try {
    const res: any = await client.storage.getDownloadUrl({ bucket_name: BUCKET, object_key });
    return res?.data?.download_url ?? '';
  } catch {
    return '';
  }
}

export async function downloadDoc(object_key?: string | null) {
  if (!object_key) return;
  const url = await getFileUrl(object_key);
  if (url) {
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = object_key.split('/').pop() || 'file';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    } catch { /* تراجع */ }
  }
  try { await client.storage.download({ bucket_name: BUCKET, object_key }); } catch { /* ignore */ }
}

export async function deleteDoc(object_key?: string | null): Promise<boolean> {
  if (!object_key) return false;
  // 1) الخادم يحذف من B2 ومن Atoms Cloud معاً
  try {
    const res: any = await client.apiCall.invoke({
      url: '/api/v1/seyaj/storage/object',
      method: 'DELETE',
      data: { object_key },
    });
    if (res?.data?.success) return true;
  } catch (err) {
    // لا تتجاوز حارس الخادم: رفض الصلاحيات (403) يمنع الحذف فعلياً.
    if (isPermissionError(err)) throw err;
    /* تراجع عند أعطال البنية فقط */
  }
  // 2) تراجع: حذف من Atoms Cloud إن توفرت الواجهة
  try {
    const anyStorage: any = client.storage;
    if (typeof anyStorage?.deleteObject === 'function') {
      await anyStorage.deleteObject({ bucket_name: BUCKET, object_key });
      return true;
    }
  } catch { /* ignore */ }
  return false;
}

// ---------- requests ----------
export async function fetchAllRequests(): Promise<any[]> {
  const res = await client.entities.requests.queryAll({ sort: '-id', limit: 500 });
  return res?.data?.items ?? [];
}

export async function fetchMyRequests(): Promise<any[]> {
  const res = await client.entities.requests.query({ sort: '-id', limit: 200 });
  return res?.data?.items ?? [];
}

export async function createRequestRecord(data: {
  employee_name: string;
  employee_code: string;
  request_type: string;
  reason: string;
  start_date: string;
  end_date: string;
  status: string;
  attachment_key?: string;
  attachment_name?: string;
}) {
  const res = await client.entities.requests.create({ data });
  return res?.data;
}

export async function adminDecide(id: number, status: string, managerNote?: string) {
  const res = await client.apiCall.invoke({
    url: `/api/v1/seyaj/requests/${id}/decide`,
    method: 'PUT',
    data: { status, manager_note: managerNote ?? '' },
  });
  return res?.data;
}

// ---------- patrols ----------
export async function fetchMyPatrols(): Promise<any[]> {
  const res = await client.entities.patrols.query({ sort: '-id', limit: 100 });
  return res?.data?.items ?? [];
}

export async function fetchAllPatrols(): Promise<any[]> {
  const res = await client.entities.patrols.queryAll({ sort: '-id', limit: 500 });
  return res?.data?.items ?? [];
}

export async function createPatrol(data: {
  employee_name: string;
  employee_code: string;
  site_name: string;
  project_name: string;
  shift_period: string;
  patrol_date: string;
  start_time: string;
  status: string;
}) {
  const res = await client.entities.patrols.create({ data });
  return res?.data;
}

export async function updatePatrol(id: number, data: {
  end_time?: string;
  status?: string;
  note?: string;
  report_image_key?: string;
  report_image_name?: string;
}) {
  const res = await client.entities.patrols.update({ id, data });
  return res?.data;
}

// ---------- handovers ----------
export async function fetchMyHandovers(): Promise<any[]> {
  const res = await client.entities.handovers.query({ sort: '-id', limit: 100 });
  return res?.data?.items ?? [];
}

export async function fetchAllHandovers(): Promise<any[]> {
  const res = await client.entities.handovers.queryAll({ sort: '-id', limit: 500 });
  return res?.data?.items ?? [];
}

export async function createHandover(data: {
  site_name: string;
  project_name: string;
  shift_period: string;
  handover_date: string;
  handover_time: string;
  giver_name: string;
  giver_id_number: string;
  giver_phone: string;
  receiver_name: string;
  receiver_id_number: string;
  receiver_phone: string;
  note?: string;
  report_image_key?: string;
  report_image_name?: string;
  status: string;
}) {
  const res = await client.entities.handovers.create({ data });
  return res?.data;
}

// ---------- map / site-locations ----------
export async function fetchSiteLocations(kind?: string): Promise<any[]> {
  const res = await client.apiCall.invoke({
    url: '/api/v1/seyaj/site-locations',
    method: 'GET',
    data: kind ? { kind } : {},
  });
  return res?.data?.items ?? [];
}

export async function fetchSiteDetail(id: number): Promise<any> {
  const res = await client.apiCall.invoke({
    url: '/api/v1/seyaj/site-locations/' + id + '/detail',
    method: 'GET',
  });
  return res?.data ?? null;
}
