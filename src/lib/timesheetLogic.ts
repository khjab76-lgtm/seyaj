export interface DayStatusDef { code: string; label: string; cls: string }
export const DAY_STATUSES: DayStatusDef[] = [
  { code: 'حض', label: 'حضور', cls: 'bg-emerald-500 text-white' },
  { code: 'ان', label: 'انصراف', cls: 'bg-teal-500 text-white' },
  { code: 'غب', label: 'غياب', cls: 'bg-rose-600 text-white' },
  { code: 'تأ', label: 'تأخير', cls: 'bg-amber-500 text-white' },
  { code: 'إج', label: 'إجازة', cls: 'bg-blue-500 text-white' },
  { code: 'راح', label: 'راحة أسبوعية', cls: 'bg-slate-300 text-slate-700' },
  { code: 'مأ', label: 'مأمورية', cls: 'bg-violet-500 text-white' },
  { code: 'است', label: 'استئذان', cls: 'bg-cyan-500 text-white' },
  { code: 'غ.ع', label: 'غياب بعذر', cls: 'bg-orange-400 text-white' },
  { code: 'إ.ر', label: 'إجازة رسمية', cls: 'bg-indigo-500 text-white' },
  { code: 'عط', label: 'يوم عطلة', cls: 'bg-pink-500 text-white' },
  { code: 'إض', label: 'ساعات إضافية', cls: 'bg-fuchsia-500 text-white' }
]
export const STATUS_BY_CODE: { [k: string]: DayStatusDef } = Object.fromEntries(DAY_STATUSES.map((s) => [s.label, s]))
export const OFFICIAL_HOLIDAYS: { [k: string]: string } = { '2026-09-23': 'اليوم الوطني', '2026-02-20': 'يوم التأسيس' }
const pad = (n: number) => String(n).padStart(2, '0')
export const isoOf = (y: number, m: number, d: number) => y + '-' + pad(m) + '-' + pad(d)
export const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate()
export const isWeekend = (date: Date) => [5, 6].includes(date.getDay())
export const SHIFT_START = 420
export const SHIFT_END = 1140
export function tmin(t: any): number | null {
  if (!t) return null
  const p = String(t).split(':')
  const h = Number(p[0])
  const m = Number(p[1] || 0)
  if (Number.isNaN(h)) return null
  return h * 60 + (Number.isNaN(m) ? 0 : m)
}
export interface DayDetail { date: string; status: string; checkIn: string; checkOut: string; fingerprint: string; location: string; workHours: number; lateMin: number; overtimeMin: number; note: string; manual: boolean }
export interface DayInput { attendance: any[]; requests: any[] }
export const findDay = (rows: any[], eid: number, iso: string) => {
  for (const r of rows) { if (r.employeeId === eid) { if (r.date === iso) return r } }
  return null
}
export function deriveDay(eid: number, y: number, m: number, d: number, input: DayInput, manualStatus?: string): DayDetail {
  const iso = isoOf(y, m, d)
  const date = new Date(y, m - 1, d)
  const att = findDay(input.attendance, eid, iso)
  const req = findDay(input.requests, eid, iso)
  let status = ''
  let note = ''
  if (manualStatus) { status = manualStatus }
  else if (req) {
    const t = String(req.type || '')
    if (t.includes('إجازة مرضية')) { status = 'غياب بعذر'; note = req.reason || '' }
    else if (t.includes('إجازة')) { status = 'إجازة'; note = req.reason || '' }
    else if (t.includes('استئذان')) { status = 'استئذان'; note = req.reason || '' }
    else if (t.includes('مأمورية')) { status = 'مأمورية'; note = req.reason || '' }
    else if (t.includes('ساعات إضافية')) { status = 'ساعات إضافية'; note = req.reason || '' }
  }
  if (!status) {
    if (att) {
      if (att.status === 'غائب') status = 'غياب'
      else if (att.status === 'متأخر') status = 'تأخير'
      else if (att.status === 'منصرف') status = 'انصراف'
      else status = 'حضور'
    } else if (OFFICIAL_HOLIDAYS[iso]) status = 'إجازة رسمية'
    else if (isWeekend(date)) status = 'راحة أسبوعية'
    else status = 'غياب'
  }
  const ci = tmin(att ? att.checkIn : '')
  const co = tmin(att ? att.checkOut : '')
  const workHours = ci !== null ? (co !== null ? Math.max(0, (co - ci) / 60) : 0) : 0
  const lateMin = status === 'تأخير' ? (ci !== null ? Math.max(0, ci - SHIFT_START) : 0) : 0
  let overtimeMin = 0
  if (status === 'ساعات إضافية') { if (req) overtimeMin = Math.max(0, (tmin(req.to) || 0) - (tmin(req.from) || 0)) }
  if (co !== null) { if (co > SHIFT_END) overtimeMin += co - SHIFT_END }
  return {
    date: iso, status,
    checkIn: att ? (att.checkIn || '-') : '-',
    checkOut: att ? (att.checkOut || '-') : '-',
    fingerprint: att ? (att.fingerprint || '-') : '-',
    location: att ? (att.location || '-') : '-',
    workHours: Math.round(workHours * 10) / 10, lateMin, overtimeMin, note,
    manual: Boolean(manualStatus)
  }
}
export interface MonthStats { present: number; absent: number; leave: number; rest: number; workHours: number; lateHours: number; overtimeHours: number; requiredDays: number; actualDays: number; rate: number; days: DayDetail[] }
export function computeMonth(eid: number, year: number, month: number, input: DayInput, manual: { [k: string]: string }, from?: string, to?: string): MonthStats {
  const dim = daysInMonth(year, month)
  const days: DayDetail[] = []
  let present = 0, absent = 0, leave = 0, rest = 0, workHours = 0, lateMin = 0, overtimeMin = 0, required = 0
  const dayList = Array.from({ length: dim }, (_, i) => i + 1)
  for (const d of dayList) {
    const iso = isoOf(year, month, d)
    const st = deriveDay(eid, year, month, d, input, manual[eid + '-' + iso])
    days.push(st)
    const date = new Date(year, month - 1, d)
    let inRange = true
    if (from) { if (from > iso) inRange = false }
    if (to) { if (iso > to) inRange = false }
    if (!inRange) continue
    if (st.status === 'حضور') present += 1
    else if (st.status === 'انصراف') present += 1
    else if (st.status === 'تأخير') present += 1
    else if (st.status === 'ساعات إضافية') present += 1
    else if (st.status === 'غياب') absent += 1
    else if (st.status === 'إجازة') leave += 1
    else if (st.status === 'غياب بعذر') leave += 1
    else if (st.status === 'إجازة رسمية') leave += 1
    else if (st.status === 'راحة أسبوعية') rest += 1
    else if (st.status === 'يوم عطلة') rest += 1
    workHours += st.workHours
    lateMin += st.lateMin
    overtimeMin += st.overtimeMin
    if (!isWeekend(date)) { if (!OFFICIAL_HOLIDAYS[iso]) required += 1 }
  }
  return {
    present, absent, leave, rest,
    workHours: Math.round(workHours * 10) / 10,
    lateHours: Math.round((lateMin / 60) * 10) / 10,
    overtimeHours: Math.round((overtimeMin / 60) * 10) / 10,
    requiredDays: required, actualDays: present,
    rate: required > 0 ? Math.round((present / required) * 100) : 0,
    days
  }
}