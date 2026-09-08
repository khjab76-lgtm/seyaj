import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Fingerprint, LogOut, Inbox, User, Plus, MapPin, CheckCircle2,
  ShieldAlert, RefreshCw, ExternalLink, Route as RouteIcon, ArrowLeftRight,
  Camera, Paperclip, X,
} from 'lucide-react';
import {
  getMe, startLogin, logout, fetchMyAttendance, fetchMyRequests, fetchMyPatrols, fetchMyHandovers,
  serverCheckIn, serverCheckOut, extractApiError, createRequestRecord,
  createPatrol, updatePatrol, createHandover,
  uploadDoc, getFileUrl,
  todayISO, nowTime, defaultShiftPeriod, getPosition, STATUS_AR, REQ_STATUS_AR,
  REQ_TYPES, REQ_TYPES_NEED_ATTACH, SHIFT_PERIODS, validateSaId, validateSaPhone,
} from '@/lib/backend';

type Tab = 'home' | 'requests' | 'patrols' | 'handover' | 'me';

function StatusPill({ ar, tone }: { ar: string; tone: 'ok' | 'warn' | 'bad' | 'info' }) {
  const cls = {
    ok: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    warn: 'bg-amber-50 text-amber-200 ring-amber-200',
    bad: 'bg-rose-50 text-rose-700 ring-rose-200',
    info: 'bg-sky-50 text-sky-700 ring-sky-200',
  }[tone];
  return <span className={'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ' + cls}>{ar}</span>;
}

function attTone(status: string): 'ok' | 'warn' | 'bad' | 'info' {
  if (status === 'present') return 'ok';
  if (status === 'late') return 'warn';
  if (status === 'checked_out') return 'info';
  return 'bad';
}

function reqTone(status: string): 'ok' | 'warn' | 'bad' | 'info' {
  if (status === 'approved') return 'ok';
  if (status === 'pending') return 'warn';
  return 'bad';
}

const inputCls = 'h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20';
const lblCls = 'mb-1.5 block text-xs font-bold text-slate-500';

export default function MobileApp() {
  const navigate = useNavigate();
  const [authState, setAuthState] = useState<'loading' | 'auth' | 'anon'>('loading');
  const [user, setUser] = useState<any>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [attendance, setAttendance] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [patrols, setPatrols] = useState<any[]>([]);
  const [handovers, setHandovers] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [showReqForm, setShowReqForm] = useState(false);
  const [clock, setClock] = useState(new Date());

  const [rf, setRf] = useState({ type: REQ_TYPES[0], start_date: todayISO(), end_date: todayISO(), reason: '' });
  const [rFile, setRFile] = useState<File | null>(null);

  const [pf, setPf] = useState({ site_name: '', project_name: '', shift_period: defaultShiftPeriod() });
  const [endFile, setEndFile] = useState<File | null>(null);
  const [endNote, setEndNote] = useState('');

  const [hf, setHf] = useState({
    site_name: '', project_name: '', shift_period: defaultShiftPeriod(),
    giver_name: '', giver_id_number: '', giver_phone: '',
    receiver_name: '', receiver_id_number: '', receiver_phone: '', note: '',
  });
  const [hFile, setHFile] = useState<File | null>(null);

  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2800); };

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadAll = useCallback(async () => {
    const [a, r, p, h] = await Promise.all([
      fetchMyAttendance().catch(() => []),
      fetchMyRequests().catch(() => []),
      fetchMyPatrols().catch(() => []),
      fetchMyHandovers().catch(() => []),
    ]);
    setAttendance(a);
    setRequests(r);
    setPatrols(p);
    setHandovers(h);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const me = await getMe();
      if (!alive) return;
      if (me) { setUser(me); setAuthState('auth'); }
      else setAuthState('anon');
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (authState === 'auth') loadAll();
  }, [authState, loadAll]);

  const empName = user?.name || user?.full_name || user?.display_name || user?.email || 'موظف سياج';
  const empCode = user?.employee_code || user?.code || (user?.email ? 'S-' + String(user.email).slice(0, 4).toUpperCase() : 'S-0000');
  const empSite = user?.site_name || 'موقع العمل';
  const empProject = user?.project_name || 'مشروع سياج';

  const today = todayISO();
  const todayRec = useMemo(
    () => attendance.find((a: any) => a.work_date === today),
    [attendance, today],
  );
  const activePatrol = useMemo(() => patrols.find((p: any) => p.status === 'active'), [patrols]);

  const doCheckIn = async () => {
    if (todayRec) { toast('أنت مسجّل الحضور اليوم بالفعل'); return; }
    setBusy(true);
    try {
      const pos = await getPosition();
      if (!pos) { toast('GPS غير متاح — فعّل خدمة الموقع ثم حاول مجددًا'); return; }
      const t = nowTime();
      const res = await serverCheckIn({
        employee_code: empCode, employee_name: empName,
        site_name: empSite, project_name: empProject,
        work_date: today, check_in_time: t,
        lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy,
      });
      await loadAll();
      const dist = res?.distance_m != null ? ` — المسافة ${Math.round(res.distance_m)}م` : '';
      toast(`تم تسجيل الحضور بنجاح ✓${dist}`);
    } catch (err) {
      toast(extractApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const doCheckOut = async () => {
    if (!todayRec) return;
    setBusy(true);
    try {
      const pos = await getPosition();
      const res = await serverCheckOut({
        record_id: todayRec.id, check_out_time: nowTime(),
        lat: pos?.lat ?? null, lng: pos?.lng ?? null, accuracy: pos?.accuracy ?? null,
      });
      await loadAll();
      const outside = res?.geo_status && res.geo_status !== 'ok';
      toast(outside ? 'تم تسجيل الانصراف خارج النطاق — سُجّل للمراجعة' : 'تم تسجيل الانصراف ✓');
    } catch (err) {
      toast(extractApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const needReqAttach = REQ_TYPES_NEED_ATTACH.includes(rf.type);

  const submitRequest = async () => {
    if (!rf.reason.trim()) { toast('السبب مطلوب'); return; }
    if (needReqAttach && !rFile) { toast('هذا النوع يتطلب إرفاق مستند'); return; }
    setBusy(true);
    try {
      let att: any = {};
      if (rFile) att = await uploadDoc(rFile, 'requests');
      await createRequestRecord({
        employee_name: empName, employee_code: empCode, request_type: rf.type,
        reason: rf.reason.trim(), start_date: rf.start_date, end_date: rf.end_date,
        status: 'pending', attachment_key: att.object_key, attachment_name: att.file_name,
      });
      await loadAll();
      setShowReqForm(false);
      setRf({ type: REQ_TYPES[0], start_date: todayISO(), end_date: todayISO(), reason: '' });
      setRFile(null);
      toast('تم إرسال طلبك للاعتماد ✓');
    } catch {
      toast('تعذّر إرسال الطلب');
    } finally {
      setBusy(false);
    }
  };

  const startPatrol = async () => {
    if (activePatrol) { toast('لديك دورية نشطة بالفعل'); return; }
    setBusy(true);
    try {
      await createPatrol({
        employee_name: empName, employee_code: empCode,
        site_name: pf.site_name || empSite, project_name: pf.project_name || empProject,
        shift_period: pf.shift_period, patrol_date: today, start_time: nowTime(), status: 'active',
      });
      await loadAll();
      toast('بدأت الدورية ✓');
    } catch {
      toast('تعذّر بدء الدورية');
    } finally {
      setBusy(false);
    }
  };

  const finishPatrol = async () => {
    if (!activePatrol) return;
    setBusy(true);
    try {
      let img: any = {};
      if (endFile) img = await uploadDoc(endFile, 'patrols');
      await updatePatrol(activePatrol.id, {
        end_time: nowTime(), status: 'completed',
        note: endNote.trim(), report_image_key: img.object_key, report_image_name: img.file_name,
      });
      await loadAll();
      setEndFile(null);
      setEndNote('');
      toast('تم إنهاء الدورية مع التقرير ✓');
    } catch {
      toast('تعذّر إنهاء الدورية');
    } finally {
      setBusy(false);
    }
  };

  const viewImg = async (key: string) => {
    const url = await getFileUrl(key);
    if (url) window.open(url, '_blank');
    else toast('تعذّر فتح الصورة');
  };

  const submitHandover = async () => {
    if (!hf.giver_name.trim() || !hf.receiver_name.trim()) { toast('اسم المسلّم والمستلم مطلوب'); return; }
    if (!validateSaId(hf.giver_id_number)) { toast('هوية المسلّم غير صحيحة (10 أرقام تبدأ بـ1)'); return; }
    if (!validateSaId(hf.receiver_id_number)) { toast('هوية المستلم غير صحيحة (10 أرقام تبدأ بـ1)'); return; }
    if (!validateSaPhone(hf.giver_phone)) { toast('جوال المسلّم غير صحيح (10 أرقام يبدأ بـ05)'); return; }
    if (!validateSaPhone(hf.receiver_phone)) { toast('جوال المستلم غير صحيح (10 أرقام يبدأ بـ05)'); return; }
    setBusy(true);
    try {
      let img: any = {};
      if (hFile) img = await uploadDoc(hFile, 'handovers');
      await createHandover({
        site_name: hf.site_name || empSite, project_name: hf.project_name || empProject,
        shift_period: hf.shift_period, handover_date: today, handover_time: nowTime(),
        giver_name: hf.giver_name.trim(), giver_id_number: hf.giver_id_number.trim(), giver_phone: hf.giver_phone.trim(),
        receiver_name: hf.receiver_name.trim(), receiver_id_number: hf.receiver_id_number.trim(), receiver_phone: hf.receiver_phone.trim(),
        note: hf.note.trim(), report_image_key: img.object_key, report_image_name: img.file_name, status: 'completed',
      });
      await loadAll();
      setHf({ site_name: '', project_name: '', shift_period: defaultShiftPeriod(), giver_name: '', giver_id_number: '', giver_phone: '', receiver_name: '', receiver_id_number: '', receiver_phone: '', note: '' });
      setHFile(null);
      toast('تم توثيق عملية التسليم ✓');
    } catch {
      toast('تعذّر حفظ التسليم');
    } finally {
      setBusy(false);
    }
  };

  const fmtClock = clock.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const fmtDate = clock.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  if (authState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-14 w-14 animate-spin rounded-full border-4 border-white/15 border-t-gold-500" />
          <p className="text-sm text-white/60">جارٍ التحقق من الجلسة...</p>
        </div>
      </div>
    );
  }

  if (authState === 'anon') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-navy-950 to-navy-800 p-6 text-center">
        <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-navy-900 p-3 shadow-lg">
            <img src="/assets/logo-seyaj.png" alt="شعار سياج" className="h-full w-full object-contain" />
          </div>
          <h1 className="font-cairo text-2xl font-extrabold text-navy-900">سياج</h1>
          <p className="mt-1 text-sm text-slate-500">تطبيق الموظف — الحضور والطلبات والدوريات والتسليم</p>
          <div className="my-6 rounded-xl bg-slate-50 p-4 text-right text-xs leading-relaxed text-slate-600 ring-1 ring-slate-200">
            سجّل الدخول بحسابك الموحّد في نظام سياج للوصول إلى:
            <ul className="mt-2 space-y-1.5">
              <li className="flex items-center gap-2"><Fingerprint className="h-3.5 w-3.5 text-gold-500" /> تسجيل الحضور والانصراف</li>
              <li className="flex items-center gap-2"><Inbox className="h-3.5 w-3.5 text-gold-500" /> رفع الطلبات بمرفقاتها</li>
              <li className="flex items-center gap-2"><RouteIcon className="h-3.5 w-3.5 text-gold-500" /> تنفيذ الدوريات وتقارير مصورة</li>
              <li className="flex items-center gap-2"><ArrowLeftRight className="h-3.5 w-3.5 text-gold-500" /> توثيق الاستلام والتسليم</li>
            </ul>
          </div>
          <button
            onClick={() => startLogin('/app')}
            className="h-12 w-full rounded-xl bg-gold-500 font-cairo text-base font-bold text-white shadow-lg shadow-gold-500/30 transition hover:bg-gold-600 active:scale-[0.98]"
          >
            تسجيل الدخول
          </button>
          <button
            onClick={() => navigate('/')}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-navy-800"
          >
            <ExternalLink className="h-3.5 w-3.5" /> العودة إلى لوحة التحكم
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-slate-100 shadow-2xl">
      <header className="bg-gradient-to-l from-navy-950 to-navy-800 px-5 pb-5 pt-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white p-1.5">
              <img src="/assets/logo-seyaj.png" alt="سياج" className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="font-cairo text-base font-extrabold leading-tight">سياج</div>
              <div className="text-[11px] text-white/55">تطبيق الموظف</div>
            </div>
          </div>
          <button
            onClick={async () => { try { await logout(); } catch { /* ignore */ } navigate('/'); }}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/80 hover:bg-white/20"
          >
            خروج
          </button>
        </div>
        <div className="mt-5 flex items-end justify-between">
          <div>
            <div className="text-[11px] text-white/55">مرحباً</div>
            <div className="font-cairo text-lg font-bold">{empName}</div>
            <div className="num mt-0.5 text-[11px] text-gold-400">{empCode} • {empSite}</div>
          </div>
          <div className="text-left">
            <div className="num text-2xl font-extrabold leading-none">{fmtClock}</div>
            <div className="mt-1 text-[10px] text-white/55">{fmtDate}</div>
          </div>
        </div>
      </header>

      <main className="flex-1 space-y-4 p-4 pb-24">
        {tab === 'home' && (
          <>
            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-cairo text-sm font-extrabold text-navy-900">بطاقة اليوم</h2>
                <button onClick={loadAll} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500 hover:bg-slate-200">
                  <RefreshCw className="h-3 w-3" /> تحديث
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-100">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700"><Fingerprint className="h-3.5 w-3.5" /> الحضور</div>
                  <div className="num mt-1.5 text-xl font-extrabold text-emerald-800">{todayRec?.check_in_time || '—'}</div>
                  <div className="mt-0.5 text-[10px] text-emerald-600/70">
                    {todayRec?.check_in_lat != null ? 'الموقع مؤكد ✓' : todayRec ? 'بدون إحداثيات' : 'لم يُسجّل بعد'}
                  </div>
                </div>
                <div className="rounded-xl bg-sky-50 p-3 ring-1 ring-sky-100">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-sky-700"><LogOut className="h-3.5 w-3.5" /> الانصراف</div>
                  <div className="num mt-1.5 text-xl font-extrabold text-sky-800">{todayRec?.check_out_time || '—'}</div>
                  <div className="mt-0.5 text-[10px] text-sky-600/70">{todayRec?.check_out_time ? 'اكتملت الوردية' : 'قيد الوردية'}</div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                {!todayRec ? (
                  <button onClick={doCheckIn} disabled={busy} className="h-12 flex-1 rounded-xl bg-gold-500 font-cairo text-sm font-bold text-white shadow-lg shadow-gold-500/25 transition hover:bg-gold-600 active:scale-[0.98] disabled:opacity-60">
                    {busy ? 'جارٍ التسجيل...' : 'تسجيل الحضور الآن'}
                  </button>
                ) : todayRec.status !== 'checked_out' ? (
                  <button onClick={doCheckOut} disabled={busy} className="h-12 flex-1 rounded-xl bg-navy-900 font-cairo text-sm font-bold text-white shadow-lg transition hover:bg-navy-800 active:scale-[0.98] disabled:opacity-60">
                    {busy ? 'جارٍ التسجيل...' : 'تسجيل الانصراف'}
                  </button>
                ) : (
                  <div className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-100 text-sm font-bold text-slate-500 ring-1 ring-slate-200">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> وردية اليوم مكتملة
                  </div>
                )}
              </div>
              {todayRec && (
                <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-slate-500">
                  <span>حالتك الآن:</span>
                  <StatusPill ar={STATUS_AR[todayRec.status] || todayRec.status} tone={attTone(todayRec.status)} />
                </div>
              )}
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
              <h2 className="mb-3 font-cairo text-sm font-extrabold text-navy-900">آخر سجلات الحضور</h2>
              {attendance.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">لا توجد سجلات بعد</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {attendance.slice(0, 6).map((a: any) => (
                    <li key={a.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <div className="num text-xs font-bold text-slate-700">{a.work_date}</div>
                        <div className="num mt-0.5 text-[11px] text-slate-400">{a.check_in_time || '—'} ← {a.check_out_time || '—'}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <StatusPill ar={STATUS_AR[a.status] || a.status} tone={attTone(a.status)} />
                        {a.site_name && <span className="text-[10px] text-slate-400">{a.site_name}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <button onClick={() => navigate('/')} className="w-full rounded-xl border border-dashed border-slate-300 bg-white/60 py-3 text-[11px] font-bold text-slate-500 hover:bg-white">
              فتح لوحة تحكم المشرف (سطح المكتب)
            </button>
          </>
        )}

        {tab === 'requests' && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-cairo text-sm font-extrabold text-navy-900">طلباتي ({requests.length})</h2>
              <button onClick={() => setShowReqForm(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-gold-500 px-3 py-2 text-xs font-bold text-white shadow-md shadow-gold-500/25 hover:bg-gold-600">
                <Plus className="h-3.5 w-3.5" /> طلب جديد
              </button>
            </div>
            {requests.length === 0 ? (
              <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200/70">
                <Inbox className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-xs font-bold text-slate-500">لا توجد طلبات</p>
                <p className="mt-1 text-[11px] text-slate-400">ارفع طلب إذن أو إجازة أو نقل وسيتابعه مشرفك</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {requests.map((r: any) => (
                  <li key={r.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-cairo text-sm font-extrabold text-navy-900">{r.request_type}</div>
                        <div className="num mt-0.5 text-[11px] text-slate-400">
                          {r.start_date === r.end_date ? r.start_date : `${r.start_date} ← ${r.end_date}`}
                        </div>
                      </div>
                      <StatusPill ar={REQ_STATUS_AR[r.status] || r.status} tone={reqTone(r.status)} />
                    </div>
                    <p className="mt-2 rounded-lg bg-slate-50 p-2.5 text-[11px] leading-relaxed text-slate-600">{r.reason}</p>
                    {r.attachment_key && (
                      <button onClick={() => viewImg(r.attachment_key)} className="mt-2 inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-1 text-[10px] font-bold text-sky-700 ring-1 ring-sky-200">
                        <Paperclip className="h-3 w-3" /> {r.attachment_name || 'مرفق'}
                      </button>
                    )}
                    {r.status !== 'pending' && (
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold">
                        {r.status === 'approved' ? (
                          <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /><span className="text-emerald-700">تم اعتماد طلبك</span></>
                        ) : (
                          <><ShieldAlert className="h-3.5 w-3.5 text-rose-600" /><span className="text-rose-700">تم رفض طلبك</span></>
                        )}
                      </div>
                    )}
                    {r.manager_note && <div className="mt-1.5 text-[10px] text-slate-500">ملاحظة المشرف: {r.manager_note}</div>}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === 'patrols' && (
          <>
            <h2 className="font-cairo text-sm font-extrabold text-navy-900">الدوريات ({patrols.length})</h2>
            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
              {!activePatrol ? (
                <div className="space-y-3">
                  <p className="text-[11px] font-bold text-slate-500">بدء دورية جديدة</p>
                  <label className="block"><span className={lblCls}>الموقع</span>
                    <input value={pf.site_name} onChange={(e) => setPf({ ...pf, site_name: e.target.value })} placeholder={empSite} className={inputCls} />
                  </label>
                  <label className="block"><span className={lblCls}>المشروع</span>
                    <input value={pf.project_name} onChange={(e) => setPf({ ...pf, project_name: e.target.value })} placeholder={empProject} className={inputCls} />
                  </label>
                  <label className="block"><span className={lblCls}>الفترة</span>
                    <select value={pf.shift_period} onChange={(e) => setPf({ ...pf, shift_period: e.target.value })} className={inputCls}>
                      {SHIFT_PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </label>
                  <button onClick={startPatrol} disabled={busy} className="h-11 w-full rounded-xl bg-gold-500 text-sm font-bold text-white shadow-lg shadow-gold-500/25 hover:bg-gold-600 disabled:opacity-60">
                    <RouteIcon className="ml-1 inline h-4 w-4" /> بدء الدورية
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">
                    <div>
                      <div className="text-xs font-extrabold text-amber-800">دورية نشطة — {activePatrol.site_name}</div>
                      <div className="num mt-0.5 text-[11px] text-amber-700">بدأت {activePatrol.start_time} • {activePatrol.shift_period}</div>
                    </div>
                    <StatusPill ar="نشطة" tone="warn" />
                  </div>
                  <label className="block"><span className={lblCls}>ملاحظات الجولة</span>
                    <textarea value={endNote} onChange={(e) => setEndNote(e.target.value)} placeholder="ما الذي لاحظته أثناء الجولة؟" className="min-h-16 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-gold-400" />
                  </label>
                  <label className="block"><span className={lblCls}>تقرير مصور (صورة)</span>
                    <input type="file" accept="image/*" capture="environment" onChange={(e) => setEndFile(e.target.files?.[0] ?? null)}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs file:ml-3 file:rounded file:border-0 file:bg-navy-900 file:px-3 file:py-1.5 file:text-[10px] file:font-bold file:text-gold-400" />
                    {endFile && <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-500"><Camera className="h-3 w-3" /> {endFile.name}</div>}
                  </label>
                  <button onClick={finishPatrol} disabled={busy} className="h-11 w-full rounded-xl bg-navy-900 text-sm font-bold text-white shadow-lg hover:bg-navy-800 disabled:opacity-60">
                    <CheckCircle2 className="ml-1 inline h-4 w-4" /> إنهاء الدورية وإرسال التقرير
                  </button>
                </div>
              )}
            </section>
            {patrols.length > 0 && (
              <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
                <h3 className="mb-3 font-cairo text-xs font-extrabold text-navy-900">سجل دورياتي</h3>
                <ul className="divide-y divide-slate-100">
                  {patrols.slice(0, 10).map((p: any) => (
                    <li key={p.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <div className="text-xs font-bold text-slate-700">{p.site_name} • {p.shift_period}</div>
                        <div className="num mt-0.5 text-[11px] text-slate-400">{p.patrol_date} — {p.start_time || '—'} ← {p.end_time || '—'}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.report_image_key && (
                          <button onClick={() => viewImg(p.report_image_key)} className="rounded-md bg-sky-50 p-1.5 text-sky-600 ring-1 ring-sky-200"><Camera className="h-3.5 w-3.5" /></button>
                        )}
                        <StatusPill ar={p.status === 'active' ? 'نشطة' : 'مكتملة'} tone={p.status === 'active' ? 'warn' : 'ok'} />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {tab === 'handover' && (
          <>
            <h2 className="font-cairo text-sm font-extrabold text-navy-900">الاستلام والتسليم</h2>
            <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className={lblCls}>الموقع</span>
                  <input value={hf.site_name} onChange={(e) => setHf({ ...hf, site_name: e.target.value })} placeholder={empSite} className={inputCls} />
                </label>
                <label className="block"><span className={lblCls}>الفترة</span>
                  <select value={hf.shift_period} onChange={(e) => setHf({ ...hf, shift_period: e.target.value })} className={inputCls}>
                    {SHIFT_PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="mb-2 text-[11px] font-extrabold text-navy-900">بيانات المسلّم (أنت)</div>
                <div className="space-y-2.5">
                  <input value={hf.giver_name} onChange={(e) => setHf({ ...hf, giver_name: e.target.value })} placeholder="الاسم" className={inputCls} />
                  <div className="grid grid-cols-2 gap-2.5">
                    <input inputMode="numeric" value={hf.giver_id_number} onChange={(e) => setHf({ ...hf, giver_id_number: e.target.value })} placeholder="الهوية (10 أرقام)" className={inputCls} />
                    <input inputMode="numeric" value={hf.giver_phone} onChange={(e) => setHf({ ...hf, giver_phone: e.target.value })} placeholder="الجوال 05..." className={inputCls} />
                  </div>
                  {hf.giver_id_number && !validateSaId(hf.giver_id_number) && <p className="text-[10px] font-bold text-rose-600">رقم الهوية يجب أن يبدأ بـ1 ويتكون من 10 أرقام</p>}
                  {hf.giver_phone && !validateSaPhone(hf.giver_phone) && <p className="text-[10px] font-bold text-rose-600">رقم الجوال يجب أن يبدأ بـ05 ويتكون من 10 أرقام</p>}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="mb-2 text-[11px] font-extrabold text-navy-900">بيانات المستلم</div>
                <div className="space-y-2.5">
                  <input value={hf.receiver_name} onChange={(e) => setHf({ ...hf, receiver_name: e.target.value })} placeholder="الاسم" className={inputCls} />
                  <div className="grid grid-cols-2 gap-2.5">
                    <input inputMode="numeric" value={hf.receiver_id_number} onChange={(e) => setHf({ ...hf, receiver_id_number: e.target.value })} placeholder="الهوية (10 أرقام)" className={inputCls} />
                    <input inputMode="numeric" value={hf.receiver_phone} onChange={(e) => setHf({ ...hf, receiver_phone: e.target.value })} placeholder="الجوال 05..." className={inputCls} />
                  </div>
                  {hf.receiver_id_number && !validateSaId(hf.receiver_id_number) && <p className="text-[10px] font-bold text-rose-600">رقم الهوية يجب أن يبدأ بـ1 ويتكون من 10 أرقام</p>}
                  {hf.receiver_phone && !validateSaPhone(hf.receiver_phone) && <p className="text-[10px] font-bold text-rose-600">رقم الجوال يجب أن يبدأ بـ05 ويتكون من 10 أرقام</p>}
                </div>
              </div>
              <label className="block"><span className={lblCls}>ملاحظات التسليم</span>
                <textarea value={hf.note} onChange={(e) => setHf({ ...hf, note: e.target.value })} placeholder="عهدة، مفاتيح، ملاحظات..." className="min-h-14 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-gold-400" />
              </label>
              <label className="block"><span className={lblCls}>تقرير مصور (اختياري)</span>
                <input type="file" accept="image/*" capture="environment" onChange={(e) => setHFile(e.target.files?.[0] ?? null)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs file:ml-3 file:rounded file:border-0 file:bg-navy-900 file:px-3 file:py-1.5 file:text-[10px] file:font-bold file:text-gold-400" />
                {hFile && <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-500"><Camera className="h-3 w-3" /> {hFile.name}</div>}
              </label>
              <button onClick={submitHandover} disabled={busy} className="h-11 w-full rounded-xl bg-gold-500 text-sm font-bold text-white shadow-lg shadow-gold-500/25 hover:bg-gold-600 disabled:opacity-60">
                <ArrowLeftRight className="ml-1 inline h-4 w-4" /> توثيق الاستلام والتسليم
              </button>
            </section>
            {handovers.length > 0 && (
              <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
                <h3 className="mb-3 font-cairo text-xs font-extrabold text-navy-900">آخر التسليمات</h3>
                <ul className="divide-y divide-slate-100">
                  {handovers.slice(0, 8).map((h: any) => (
                    <li key={h.id} className="py-2.5">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-slate-700">{h.site_name} • {h.shift_period}</div>
                        <div className="flex items-center gap-2">
                          {h.report_image_key && <button onClick={() => viewImg(h.report_image_key)} className="rounded-md bg-sky-50 p-1.5 text-sky-600 ring-1 ring-sky-200"><Camera className="h-3.5 w-3.5" /></button>}
                          <StatusPill ar={h.status === 'completed' ? 'مكتمل' : 'معلق'} tone={h.status === 'completed' ? 'ok' : 'warn'} />
                        </div>
                      </div>
                      <div className="num mt-1 text-[10px] text-slate-400">{h.giver_name} ← {h.receiver_name} • {h.handover_date} {h.handover_time}</div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {tab === 'me' && (
          <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
            <div className="bg-gradient-to-l from-navy-950 to-navy-800 p-6 text-center text-white">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/15 ring-2 ring-white/25">
                <User className="h-8 w-8" />
              </div>
              <div className="mt-3 font-cairo text-lg font-extrabold">{empName}</div>
              <div className="num mt-0.5 text-[11px] text-gold-400">{empCode}</div>
            </div>
            <dl className="divide-y divide-slate-100">
              {[
                ['الموقع', empSite],
                ['البريد', user?.email || '—'],
                ['إجمالي الورديات', String(attendance.length)],
                ['الدوريات', String(patrols.length)],
                ['التسليمات', String(handovers.length)],
                ['طلبات معلقة', String(requests.filter((r: any) => r.status === 'pending').length)],
                ['طلبات معتمدة', String(requests.filter((r: any) => r.status === 'approved').length)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between px-5 py-3.5">
                  <dt className="text-xs font-bold text-slate-500">{k}</dt>
                  <dd className="num text-xs font-extrabold text-navy-900">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="p-4">
              <button onClick={async () => { try { await logout(); } catch { /* ignore */ } navigate('/'); }} className="h-11 w-full rounded-xl border border-rose-200 bg-rose-50 text-sm font-bold text-rose-700 hover:bg-rose-100">
                تسجيل الخروج
              </button>
            </div>
          </section>
        )}
      </main>

      <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-md -translate-x-1/2 border-t bg-white/95 backdrop-blur">
        <div className="grid grid-cols-5">
          {[
            { k: 'home', label: 'الحضور', icon: Fingerprint },
            { k: 'requests', label: 'طلباتي', icon: Inbox, badge: requests.filter((r: any) => r.status === 'pending').length },
            { k: 'patrols', label: 'الدوريات', icon: RouteIcon },
            { k: 'handover', label: 'التسليم', icon: ArrowLeftRight },
            { k: 'me', label: 'حسابي', icon: User },
          ].map((it: any) => {
            const active = tab === it.k;
            return (
              <button key={it.k} onClick={() => setTab(it.k)} className={'relative flex flex-col items-center gap-1 py-2.5 text-[9px] font-bold transition-colors ' + (active ? 'text-gold-600' : 'text-slate-400 hover:text-slate-600')}>
                <it.icon className={'h-5 w-5 ' + (active ? 'text-gold-500' : '')} />
                {it.label}
                {it.badge > 0 && (
                  <span className="num absolute right-1/2 top-1 -mr-4 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-500 px-1 text-[9px] font-bold text-white">
                    {it.badge}
                  </span>
                )}
                {active && <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-gold-500" />}
              </button>
            );
          })}
        </div>
      </nav>

      {showReqForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm" onClick={() => setShowReqForm(false)} />
          <div className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-cairo text-base font-extrabold text-navy-900">رفع طلب جديد</h3>
              <button onClick={() => setShowReqForm(false)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3.5">
              <label className="block">
                <span className={lblCls}>نوع الطلب</span>
                <select value={rf.type} onChange={(e) => setRf({ ...rf, type: e.target.value })} className={inputCls}>
                  {REQ_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className={lblCls}>من تاريخ</span>
                  <input type="date" value={rf.start_date} onChange={(e) => setRf({ ...rf, start_date: e.target.value })} className="num h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-gold-400" />
                </label>
                <label className="block"><span className={lblCls}>إلى تاريخ</span>
                  <input type="date" value={rf.end_date} onChange={(e) => setRf({ ...rf, end_date: e.target.value })} className="num h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-gold-400" />
                </label>
              </div>
              <label className="block">
                <span className={lblCls}>السبب</span>
                <textarea value={rf.reason} onChange={(e) => setRf({ ...rf, reason: e.target.value })} placeholder="اكتب سبب الطلب..." className="min-h-20 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20" />
              </label>
              <label className="block">
                <span className={lblCls}>{needReqAttach ? 'المرفق (مطلوب)' : 'المرفق (اختياري)'}</span>
                <input type="file" accept="image/*,.pdf" onChange={(e) => setRFile(e.target.files?.[0] ?? null)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs file:ml-3 file:rounded file:border-0 file:bg-navy-900 file:px-3 file:py-1.5 file:text-[10px] file:font-bold file:text-gold-400" />
                {rFile && <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-500"><Paperclip className="h-3 w-3" /> {rFile.name}</div>}
              </label>
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setShowReqForm(false)} className="h-11 flex-1 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">إلغاء</button>
              <button onClick={submitRequest} disabled={busy} className="h-11 flex-1 rounded-xl bg-gold-500 text-sm font-bold text-white shadow-lg shadow-gold-500/25 hover:bg-gold-600 disabled:opacity-60">
                {busy ? 'جارٍ الإرسال...' : 'إرسال الطلب'}
              </button>
            </div>
          </div>
        </div>
      )}

      {msg && (
        <div className="fixed bottom-24 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-xl bg-navy-950 px-4 py-3 text-center text-sm font-bold text-white shadow-2xl">
          {msg}
        </div>
      )}
    </div>
  );
}