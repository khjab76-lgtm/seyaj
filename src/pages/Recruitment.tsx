// وحدة «التوظيف والخطابات» — طلب التوظيف الإلكتروني + الأرشيف + التحويل إلى موظف
// + الخطابات الرسمية (قوالب بمتغيرات الموظف، ترقيم، اعتماد، إرسال، أرشفة)
// + الصلاحيات المرتبطة بدور المستخدم الحالي.
// كل المرفقات تُرفع للتخزين السحابي (حاوية seyaj-docs)، والتحويل يتم بالربط
// دون نسخ أو فقدان، ويبقى الطلب الأصلي في الأرشيف بحالة «مكتمل».
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import {
  PageToolbar, StatCard, Table, Modal, Field, TextInput, TextArea, Select, Btn,
  EmptyRow, StatusBadge, useToast,
} from '@/components/ui-kit';
import {
  UserPlus, Inbox, FileText, Paperclip, Download, Eye, Check, X, Users, Printer,
  Mail, Archive, ShieldCheck, LayoutTemplate,
} from 'lucide-react';
import {
  fetchApplications, createApplication, moveStatus, convertApplication,
  validateApplication, parseLog, parseAttachments, nextEmpNo, buildEmployeeFromApplication,
  APP_STATUSES, STATUS_TONE, APP_DOC_TYPES, todayISO,
  uploadDoc, getFileUrl, downloadDoc, hrAudit,
  fetchLetters, createLetter, approveLetter, sendLetter, archiveLetter,
  LETTER_TYPES, LETTER_STATUSES, LETTER_STATUS_TONE, TEMPLATE_VARS, DEFAULT_TEMPLATES, fillTemplate,
  PERMISSION_KEYS, ROLE_PERMISSIONS, roleFor, can,
  type ApplicationForm,
} from '@/lib/recruitment';
import { getMe } from '@/lib/backend';
import { fetchHrSettings, setHrSetting } from '@/lib/hr';
import { salaryOf } from '@/lib/seyaj';

const EMPTY_FORM: ApplicationForm = {
  full_name: '', id_number: '', phone: '', nationality: 'سعودي', birth_date: '',
  qualification: '', specialization: '', experience: '', experience_years: 0,
  job_requested: '', city: '', address: '', email: '', emergency_contact: '',
  declaration: false, e_signature: '',
};

const SEND_CHANNELS = ['بريد إلكتروني', 'تسليم يدوي', 'واتساب', 'نظام داخلي'];

function StatusPill({ value }: any) {
  return <span className={'inline-flex rounded-md px-2 py-0.5 text-xs font-bold ring-1 ' + (STATUS_TONE[value] || 'bg-muted text-muted-foreground ring-border')}>{value}</span>;
}
function LetterPill({ value }: any) {
  return <span className={'inline-flex rounded-md px-2 py-0.5 text-xs font-bold ring-1 ' + (LETTER_STATUS_TONE[value] || 'bg-muted text-muted-foreground ring-border')}>{value}</span>;
}

function printLetter(letter: any) {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;
  w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/><title>${letter.letter_no}</title>
  <style>
    body{font-family:'Cairo','Tajawal',Tahoma,sans-serif;margin:40px;color:#202359;background:#fff}
    .head{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #ED2024;padding-bottom:12px;margin-bottom:24px}
    .brand{font-size:20px;font-weight:900}.brand small{display:block;font-size:11px;color:#666;font-weight:600}
    .meta{text-align:left;font-size:12px;color:#555}
    .no{font-weight:900;color:#ED2024;font-size:14px}
    h2{font-size:16px;margin:8px 0 16px}
    .body{white-space:pre-wrap;font-size:14px;line-height:2}
    .sign{margin-top:48px;text-align:left;font-size:13px}
    .sign b{display:block;font-size:15px}
    @media print{button{display:none}}
  </style></head><body>
  <div class="head"><div class="brand">شركة سياج للحراسات الأمنية الخاصة<small>SEyaj Security Services Co.</small></div>
  <div class="meta"><div class="no">${letter.letter_no}</div><div>${letter.sent_date || todayISO()}</div>${letter.app_no ? `<div>المرجع: ${letter.app_no}</div>` : ''}</div></div>
  <h2>${letter.subject || letter.letter_type}</h2>
  <div class="body">${(letter.content || '').replace(/</g, '&lt;')}</div>
  <div class="sign">إدارة الموارد البشرية<br/><b>التوقيع: ______________</b><br/>الختم الرسمي</div>
  <script>window.onload=()=>window.print()</script>
  </body></html>`);
  w.document.close();
}

export default function Recruitment() {
  const { employees, projects, sites, empCrud } = useStore();
  const toast = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [letters, setLetters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'archive' | 'new' | 'letters' | 'templates'>('archive');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('الكل');
  const [view, setView] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [actor, setActor] = useState('مسؤول التوظيف');

  // نموذج الطلب الجديد
  const [form, setForm] = useState<ApplicationForm>(EMPTY_FORM);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [attType, setAttType] = useState(APP_DOC_TYPES[0]);

  // نافذة التحويل إلى موظف
  const [convOpen, setConvOpen] = useState(false);
  const [convForm, setConvForm] = useState<any>({ project: '', site: '', job: '', hireDate: todayISO() });

  // نافذة إنشاء/عرض الخطاب
  const [ltrOpen, setLtrOpen] = useState<any>(null); // {mode:'new'|'view', row?, app?}
  const [ltrForm, setLtrForm] = useState<any>({ letter_type: LETTER_TYPES[0], subject: '', content: '', app_id: 0, app_no: '', employee_code: '', employee_name: '' });
  const [ltrQ, setLtrQ] = useState('');
  const [ltrStatus, setLtrStatus] = useState('الكل');

  // محرر القوالب
  const [tplType, setTplType] = useState(LETTER_TYPES[0]);
  const [tplBody, setTplBody] = useState('');
  const [tplSaved, setTplSaved] = useState<Record<string, string>>({});

  const role = roleFor(actor);
  const perms = ROLE_PERMISSIONS[role] || [];

  const reload = async () => {
    setLoading(true);
    const [a, l] = await Promise.all([fetchApplications(), fetchLetters()]);
    setRows(a); setLetters(l);
    setLoading(false);
  };
  useEffect(() => {
    reload();
    getMe().then((me: any) => {
      const name = me?.email || me?.name || me?.user_metadata?.name;
      if (name) setActor(String(name));
    });
    fetchHrSettings().then((s: any) => {
      const map: Record<string, string> = {};
      for (const r of s) if (String(r.setting_key).startsWith('template_letter_')) map[r.setting_key.replace('template_letter_', '')] = r.setting_value;
      setTplSaved(map);
      setTplBody(map[LETTER_TYPES[0]] || DEFAULT_TEMPLATES[LETTER_TYPES[0]]);
    });
  }, []);

  useEffect(() => {
    setTplBody(tplSaved[tplType] || DEFAULT_TEMPLATES[tplType] || '');
  }, [tplType, tplSaved]);

  const filtered = useMemo(() => {
    const s = q.trim();
    return rows.filter((r: any) => {
      if (statusFilter !== 'الكل' && r.status !== statusFilter) return false;
      if (s && !(`${r.full_name} ${r.app_no} ${r.id_number} ${r.phone} ${r.job_requested}`.includes(s))) return false;
      return true;
    });
  }, [rows, q, statusFilter]);

  const counts = useMemo(() => ({
    total: rows.length,
    pending: rows.filter((r: any) => ['جديد', 'قيد المراجعة', 'مقابلة'].includes(r.status)).length,
    accepted: rows.filter((r: any) => r.status === 'مقبول').length,
    converted: rows.filter((r: any) => r.converted).length,
  }), [rows]);

  const filteredLetters = useMemo(() => {
    const s = ltrQ.trim();
    return letters.filter((l: any) => {
      if (ltrStatus !== 'الكل' && l.status !== ltrStatus) return false;
      if (s && !(`${l.letter_no} ${l.employee_name} ${l.subject} ${l.app_no}`.includes(s))) return false;
      return true;
    });
  }, [letters, ltrQ, ltrStatus]);

  const set = (k: keyof ApplicationForm, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const addAttachment = async (f: File) => {
    setBusy(true);
    const up = await uploadDoc(f, 'recruitment');
    setAttachments((p) => [...p, {
      doc_type: attType, file_key: up.object_key, file_name: up.file_name,
      size: f.size, uploaded_at: todayISO(),
    }]);
    await hrAudit(actor, 'رفع مرفق طلب توظيف', 'recruitment_applications', 'مسودة', `${attType}: ${up.file_name} → ${up.object_key}`);
    setBusy(false);
    toast.show('تم رفع المرفق إلى التخزين السحابي وتسجيله في التدقيق');
  };

  const submitApplication = async () => {
    if (!can(actor, 'رفع')) { toast.show('لا تملك صلاحية تقديم الطلبات'); return; }
    const err = validateApplication(form);
    if (err) { toast.show(err); return; }
    setBusy(true);
    const created = await createApplication(form, attachments);
    setBusy(false);
    if (!created) { toast.show('تعذّر حفظ الطلب — تحقق من الاتصال'); return; }
    toast.show(`تم إنشاء الطلب رقم ${created.app_no}`);
    setForm(EMPTY_FORM); setAttachments([]);
    await reload();
    setTab('archive');
  };

  const decide = async (status: string) => {
    if (!view) return;
    setBusy(true);
    await moveStatus(view, status, actor);
    setBusy(false);
    toast.show(`تم نقل الطلب إلى «${status}»`);
    const fresh = await fetchApplications();
    setRows(fresh);
    setView(fresh.find((r: any) => r.id === view.id) || null);
  };

  const openConvert = () => {
    if (!view) return;
    setConvForm({ project: '', site: '', job: view.job_requested || '', hireDate: todayISO() });
    setConvOpen(true);
  };

  const doConvert = async () => {
    if (!view || !convForm.project || !convForm.site) { toast.show('اختر المشروع والموقع'); return; }
    if (!can(actor, 'تحويل')) { toast.show('لا تملك صلاحية التحويل إلى موظف'); return; }
    setBusy(true);
    const empNo = nextEmpNo(employees);
    const emp = buildEmployeeFromApplication(view, convForm, empNo);
    empCrud.add(emp);
    await convertApplication(view, empNo, actor);
    setBusy(false); setConvOpen(false);
    toast.show(`تم تحويل المتقدم إلى موظف برقم ${empNo} وربط طلبه ${view.app_no} بملفه`);
    await reload();
    setView(null);
  };

  const previewFile = async (key: string) => {
    if (!can(actor, 'تنزيل')) { toast.show('لا تملك صلاحية المعاينة/التنزيل'); return; }
    const url = await getFileUrl(key);
    if (url) window.open(url, '_blank');
    else toast.show('تعذّر توليد رابط المعاينة');
  };

  // ---------- الخطابات ----------
  const buildVars = (app: any) => {
    const emp = app?.converted ? employees.find((e: any) => e.no === app.employee_code) : null;
    const prj = emp ? projects.find((p: any) => p.id === emp.projectId) : null;
    const st = emp ? sites.find((s: any) => s.id === emp.siteId) : null;
    return {
      '{employee_name}': app?.full_name || '',
      '{id_number}': app?.id_number || '',
      '{job}': emp?.job || app?.job_requested || '',
      '{app_no}': app?.app_no || '',
      '{project}': prj?.name || '',
      '{site}': st?.name || '',
      '{salary}': String(salaryOf(emp?.job || app?.job_requested)),
      '{date}': todayISO(),
      '{letter_no}': 'يُعيَّن عند الحفظ',
    };
  };

  const openNewLetter = (app: any) => {
    const vars = buildVars(app);
    const tpl = tplSaved[LETTER_TYPES[0]] || DEFAULT_TEMPLATES[LETTER_TYPES[0]];
    setLtrForm({
      letter_type: LETTER_TYPES[0], subject: LETTER_TYPES[0],
      content: fillTemplate(tpl, vars),
      app_id: app.id, app_no: app.app_no,
      employee_code: app.employee_code || '', employee_name: app.full_name,
    });
    setLtrOpen({ mode: 'new' });
  };

  const changeLetterType = (t: string) => {
    const app = rows.find((r: any) => r.id === ltrForm.app_id);
    const tpl = tplSaved[t] || DEFAULT_TEMPLATES[t];
    setLtrForm((p: any) => ({ ...p, letter_type: t, subject: t, content: fillTemplate(tpl, buildVars(app)) }));
  };

  const saveLetter = async () => {
    if (!ltrForm.content.trim()) { toast.show('محتوى الخطاب مطلوب'); return; }
    setBusy(true);
    const created = await createLetter({
      letter_type: ltrForm.letter_type, app_no: ltrForm.app_no, app_id: ltrForm.app_id,
      employee_code: ltrForm.employee_code, employee_name: ltrForm.employee_name,
      subject: ltrForm.subject, content: ltrForm.content,
    }, actor);
    setBusy(false);
    if (!created) { toast.show('تعذّر حفظ الخطاب'); return; }
    toast.show(`تم إنشاء الخطاب رقم ${created.letter_no} كمسودة`);
    setLtrOpen(null);
    await reload();
  };

  const doApprove = async (l: any) => {
    if (!can(actor, 'اعتماد')) { toast.show('لا تملك صلاحية الاعتماد'); return; }
    await approveLetter(l, actor); toast.show('تم اعتماد الخطاب'); reload();
  };
  const doSend = async (l: any) => {
    const ch = window.prompt('قناة الإرسال: ' + SEND_CHANNELS.join(' / '), SEND_CHANNELS[0]);
    if (!ch) return;
    await sendLetter(l, ch, actor); toast.show(`تم إرسال الخطاب عبر ${ch}`); reload();
  };
  const doArchive = async (l: any) => {
    if (!can(actor, 'أرشفة')) { toast.show('لا تملك صلاحية الأرشفة'); return; }
    await archiveLetter(l, actor); toast.show('تمت أرشفة الخطاب'); reload();
  };

  const saveTemplate = async () => {
    setBusy(true);
    await setHrSetting(`template_letter_${tplType}`, tplBody, `قالب خطاب: ${tplType}`, actor);
    setBusy(false);
    setTplSaved((p) => ({ ...p, [tplType]: tplBody }));
    toast.show('تم حفظ القالب');
  };

  const atts = view ? parseAttachments(view) : [];
  const logs = view ? parseLog(view) : [];
  const ltrLogs = ltrOpen?.mode === 'view' ? parseLog(ltrOpen.row) : [];

  return (
    <div>
      {toast.node}
      <PageToolbar
        title="التوظيف والخطابات"
        subtitle="طلب توظيف إلكتروني كامل مع مرفقات سحابية، وسجل اعتماد، وتحويل بالربط إلى ملف الموظف، وخطارات رسمية بقوالب متغيرات، وصلاحيات حسب الدور"
        actions={
          <div className="flex gap-2">
            <Btn variant={tab === 'archive' ? 'primary' : 'outline'} size="sm" onClick={() => setTab('archive')}><Inbox className="h-4 w-4" /> الأرشيف</Btn>
            <Btn variant={tab === 'new' ? 'primary' : 'outline'} size="sm" onClick={() => setTab('new')}><UserPlus className="h-4 w-4" /> طلب جديد</Btn>
            <Btn variant={tab === 'letters' ? 'primary' : 'outline'} size="sm" onClick={() => setTab('letters')}><FileText className="h-4 w-4" /> الخطابات</Btn>
            <Btn variant={tab === 'templates' ? 'primary' : 'outline'} size="sm" onClick={() => setTab('templates')}><LayoutTemplate className="h-4 w-4" /> القوالب</Btn>
          </div>
        }
      />

      {/* شريط الصلاحيات */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 text-xs shadow-sm">
        <ShieldCheck className="h-4 w-4 text-navy-900" />
        <span className="font-bold text-navy-900">المستخدم الحالي: {actor}</span>
        <span className="rounded bg-navy-900 px-2 py-0.5 font-bold text-gold-400">الدور: {role}</span>
        <span className="text-muted-foreground">الصلاحيات:</span>
        {PERMISSION_KEYS.map((p) => (
          <span key={p} className={'rounded px-1.5 py-0.5 font-bold ring-1 ' + (perms.includes(p) ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-50 text-slate-400 ring-slate-200 line-through')}>{p}</span>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="إجمالي الطلبات" value={counts.total} icon={<Inbox className="h-5 w-5" />} tone="navy" />
        <StatCard title="قيد الإجراء" value={counts.pending} icon={<FileText className="h-5 w-5" />} tone="warning" />
        <StatCard title="مقبولة تنتظر التحويل" value={counts.accepted} icon={<Check className="h-5 w-5" />} tone="success" />
        <StatCard title="خطابات مصدرة" value={letters.length} icon={<Printer className="h-5 w-5" />} tone="info" />
      </div>

      {tab === 'archive' && (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <TextInput placeholder="بحث بالاسم أو رقم الطلب أو الهوية..." value={q} onChange={(e: any) => setQ(e.target.value)} className="w-72" />
            <Select value={statusFilter} onChange={(e: any) => setStatusFilter(e.target.value)} options={[
              { value: 'الكل', label: 'كل الحالات' },
              ...APP_STATUSES.map((s) => ({ value: s, label: s })),
            ]} />
            <Btn variant="outline" size="sm" onClick={reload}>تحديث</Btn>
          </div>
          <Table head={['رقم الطلب', 'التاريخ', 'المتقدم', 'الوظيفة المطلوبة', 'الجوال', 'المرفقات', 'الحالة', 'إجراءات']}>
            {loading ? <EmptyRow colSpan={8} text="جارٍ التحميل..." /> : filtered.length === 0 ? <EmptyRow colSpan={8} text="لا توجد طلبات مطابقة" /> :
              filtered.map((r: any) => (
                <tr key={r.id} className="hover:bg-muted/50">
                  <td className="px-4 py-2.5 font-mono text-xs font-bold text-navy-900">{r.app_no}
                    {r.converted && <div className="text-[10px] font-normal text-emerald-700">موظف {r.employee_code}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-xs">{r.app_date}</td>
                  <td className="px-4 py-2.5 font-bold">{r.full_name}<div className="text-[10px] font-normal text-muted-foreground">{r.id_number}</div></td>
                  <td className="px-4 py-2.5 text-xs">{r.job_requested}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{r.phone}</td>
                  <td className="px-4 py-2.5"><span className="inline-flex items-center gap-1 text-xs"><Paperclip className="h-3.5 w-3.5" />{parseAttachments(r).length}</span></td>
                  <td className="px-4 py-2.5"><StatusPill value={r.status} /></td>
                  <td className="px-4 py-2.5">
                    <Btn size="sm" variant="outline" onClick={() => setView(r)}><Eye className="h-3.5 w-3.5" /> عرض</Btn>
                  </td>
                </tr>
              ))}
          </Table>
        </div>
      )}

      {tab === 'new' && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-navy-900"><UserPlus className="h-5 w-5" /><h3 className="font-cairo text-base font-extrabold">نموذج طلب التوظيف الإلكتروني</h3></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="الاسم الكامل *"><TextInput value={form.full_name} onChange={(e: any) => set('full_name', e.target.value)} /></Field>
            <Field label="رقم الهوية/الإقامة (10 أرقام) *"><TextInput value={form.id_number} onChange={(e: any) => set('id_number', e.target.value.replace(/\D/g, '').slice(0, 10))} maxLength={10} /></Field>
            <Field label="رقم الجوال (يبدأ بـ05) *"><TextInput value={form.phone} onChange={(e: any) => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} maxLength={10} /></Field>
            <Field label="الجنسية *"><Select value={form.nationality} onChange={(e: any) => set('nationality', e.target.value)} options={['سعودي', 'يمني', 'مصري', 'سوداني', 'أردني', 'باكستاني', 'بنغلاديشي', 'هندي', 'فلبيني', 'أخرى'].map((n) => ({ value: n, label: n }))} /></Field>
            <Field label="تاريخ الميلاد *"><TextInput type="date" value={form.birth_date} onChange={(e: any) => set('birth_date', e.target.value)} /></Field>
            <Field label="المؤهل العلمي *"><TextInput value={form.qualification} onChange={(e: any) => set('qualification', e.target.value)} placeholder="مثال: ثانوية عامة / بكالوريوس" /></Field>
            <Field label="التخصص"><TextInput value={form.specialization} onChange={(e: any) => set('specialization', e.target.value)} /></Field>
            <Field label="سنوات الخبرة"><TextInput type="number" min={0} value={form.experience_years} onChange={(e: any) => set('experience_years', Number(e.target.value))} /></Field>
            <Field label="الوظيفة المطلوبة *"><TextInput value={form.job_requested} onChange={(e: any) => set('job_requested', e.target.value)} placeholder="مثال: رجل أمن" /></Field>
            <Field label="المدينة *"><TextInput value={form.city} onChange={(e: any) => set('city', e.target.value)} /></Field>
            <Field label="البريد الإلكتروني"><TextInput type="email" value={form.email} onChange={(e: any) => set('email', e.target.value)} /></Field>
            <Field label="جهة التواصل في الطوارئ"><TextInput value={form.emergency_contact} onChange={(e: any) => set('emergency_contact', e.target.value)} placeholder="الاسم — الجوال" /></Field>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Field label="العنوان"><TextArea value={form.address} onChange={(e: any) => set('address', e.target.value)} /></Field>
            <Field label="الخبرات السابقة"><TextArea value={form.experience} onChange={(e: any) => set('experience', e.target.value)} /></Field>
          </div>

          <div className="mt-5 rounded-lg border bg-muted/30 p-4">
            <div className="mb-2 text-xs font-bold text-navy-900">المستندات والمرفقات</div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Select value={attType} onChange={(e: any) => setAttType(e.target.value)} options={APP_DOC_TYPES.map((t) => ({ value: t, label: t }))} className="w-56" />
              <label className={'inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border bg-card px-3 text-sm font-semibold ' + (can(actor, 'رفع') ? 'hover:bg-muted' : 'pointer-events-none opacity-40')}>
                <Paperclip className="h-4 w-4" /> اختيار ملف ورفع
                <input type="file" className="hidden" disabled={busy} onChange={(e: any) => { const f = e.target.files?.[0]; if (f) addAttachment(f); e.target.value = ''; }} />
              </label>
              {busy && <span className="text-xs text-muted-foreground">جارٍ الرفع...</span>}
            </div>
            {attachments.length === 0 ? <div className="text-xs text-muted-foreground">لم تُرفع ملفات بعد — تُخزَّن جميعها في الحاوية السحابية seyaj-docs.</div> : (
              <div className="space-y-1">
                {attachments.map((a: any, i: number) => (
                  <div key={i} className="flex items-center justify-between rounded-md bg-card px-3 py-1.5 text-xs ring-1 ring-border">
                    <span><b>{a.doc_type}</b> — {a.file_name}</span>
                    <span className="flex items-center gap-2">
                      <button className="rounded p-1 hover:bg-muted" title="معاينة" onClick={() => previewFile(a.file_key)}><Eye className="h-3.5 w-3.5" /></button>
                      <button className="text-rose-600 hover:underline" onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}>إزالة</button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded-lg border bg-card p-3 text-sm">
              <input type="checkbox" checked={form.declaration} onChange={(e: any) => set('declaration', e.target.checked)} className="h-4 w-4 accent-[#202359]" />
              أقر بصحة جميع البيانات والمرفقات المقدمة
            </label>
            <Field label="التوقيع الإلكتروني (اسمك كما في الهوية) *"><TextInput value={form.e_signature} onChange={(e: any) => set('e_signature', e.target.value)} placeholder="اكتب اسمك للتوقيع" /></Field>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => { setForm(EMPTY_FORM); setAttachments([]); }}>تفريغ النموذج</Btn>
            <Btn disabled={busy} onClick={submitApplication}><FileText className="h-4 w-4" /> إرسال الطلب</Btn>
          </div>
        </div>
      )}

      {tab === 'letters' && (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <TextInput placeholder="بحث برقم الخطاب أو الاسم أو المرجع..." value={ltrQ} onChange={(e: any) => setLtrQ(e.target.value)} className="w-72" />
            <Select value={ltrStatus} onChange={(e: any) => setLtrStatus(e.target.value)} options={[{ value: 'الكل', label: 'كل الحالات' }, ...LETTER_STATUSES.map((s) => ({ value: s, label: s }))]} />
            <Btn variant="outline" size="sm" onClick={reload}>تحديث</Btn>
          </div>
          <Table head={['رقم الخطاب', 'النوع', 'المرجع (طلب)', 'الموظف/المتقدم', 'الموضوع', 'الحالة', 'إجراءات']}>
            {loading ? <EmptyRow colSpan={7} text="جارٍ التحميل..." /> : filteredLetters.length === 0 ? <EmptyRow colSpan={7} text="لا توجد خطابات — أنشئ خطاباً من أرشيف الطلبات" /> :
              filteredLetters.map((l: any) => (
                <tr key={l.id} className="hover:bg-muted/50">
                  <td className="px-4 py-2.5 font-mono text-xs font-bold text-navy-900">{l.letter_no}</td>
                  <td className="px-4 py-2.5 text-xs font-bold">{l.letter_type}</td>
                  <td className="px-4 py-2.5 font-mono text-[11px]">{l.app_no || '—'}</td>
                  <td className="px-4 py-2.5 text-xs">{l.employee_name}{l.employee_code && <div className="text-[10px] text-muted-foreground">{l.employee_code}</div>}</td>
                  <td className="px-4 py-2.5 text-xs">{l.subject}</td>
                  <td className="px-4 py-2.5"><LetterPill value={l.status} /></td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      <Btn size="sm" variant="outline" onClick={() => setLtrOpen({ mode: 'view', row: l })}><Eye className="h-3.5 w-3.5" /> عرض</Btn>
                      {l.status === 'مسودة' && can(actor, 'اعتماد') && <Btn size="sm" variant="success" onClick={() => doApprove(l)}><Check className="h-3.5 w-3.5" /> اعتماد</Btn>}
                      {l.status === 'معتمد' && <Btn size="sm" onClick={() => doSend(l)}><Mail className="h-3.5 w-3.5" /> إرسال</Btn>}
                      {['معتمد', 'مُرسل'].includes(l.status) && can(actor, 'أرشفة') && <Btn size="sm" variant="outline" onClick={() => doArchive(l)}><Archive className="h-3.5 w-3.5" /> أرشفة</Btn>}
                      <Btn size="sm" variant="ghost" onClick={() => printLetter(l)}><Printer className="h-3.5 w-3.5" /> PDF</Btn>
                    </div>
                  </td>
                </tr>
              ))}
          </Table>
        </div>
      )}

      {tab === 'templates' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <Table head={['نوع القالب', 'الحالة']}>
              {LETTER_TYPES.map((t) => (
                <tr key={t} className={'cursor-pointer ' + (tplType === t ? 'bg-gold-500/10' : 'hover:bg-muted/50')} onClick={() => setTplType(t)}>
                  <td className="px-4 py-2.5 font-bold text-navy-900">{t}</td>
                  <td className="px-4 py-2.5">{tplSaved[t] ? <StatusBadge value="مخصص" /> : <StatusBadge value="افتراضي" />}</td>
                </tr>
              ))}
            </Table>
          </div>
          <div className="lg:col-span-2">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-cairo text-sm font-extrabold text-navy-900">تحرير قالب: {tplType}</h3>
                <Btn size="sm" disabled={busy} onClick={saveTemplate}><FileText className="h-4 w-4" /> حفظ القالب</Btn>
              </div>
              <TextArea value={tplBody} onChange={(e: any) => setTplBody(e.target.value)} className="min-h-[260px] font-mono text-xs leading-6" />
              <div className="mt-3 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="mb-1.5 text-xs font-bold text-navy-900">متغيرات التعبئة التلقائية (تُستبدل من بيانات الموظف/الطلب)</div>
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATE_VARS.map((v) => (
                    <button key={v.token} title={v.label} onClick={() => setTplBody((p: string) => p + v.token)} className="rounded bg-navy-900 px-2 py-0.5 font-mono text-[10px] font-bold text-gold-400 hover:bg-navy-700">{v.token}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* نافذة عرض الطلب الكاملة */}
      <Modal open={!!view} onClose={() => setView(null)} title={view ? `طلب توظيف ${view.app_no}` : ''} wide>
        {view && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <StatusPill value={view.status} />
              <span className="text-xs text-muted-foreground">تاريخ الطلب: {view.app_date}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
              {[
                ['الاسم الكامل', view.full_name], ['رقم الهوية/الإقامة', view.id_number], ['الجوال', view.phone],
                ['الجنسية', view.nationality], ['تاريخ الميلاد', view.birth_date], ['المؤهل', view.qualification],
                ['التخصص', view.specialization], ['سنوات الخبرة', view.experience_years], ['الوظيفة المطلوبة', view.job_requested],
                ['المدينة', view.city], ['البريد', view.email], ['الطوارئ', view.emergency_contact],
              ].map(([k, v]: any) => (
                <div key={k}><span className="text-xs text-muted-foreground">{k}: </span><span className="font-bold text-navy-900">{v || '—'}</span></div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-2.5 text-xs ring-1 ring-slate-200"><span className="font-bold text-navy-900">العنوان: </span>{view.address || '—'}</div>
              <div className="rounded-lg bg-slate-50 p-2.5 text-xs ring-1 ring-slate-200"><span className="font-bold text-navy-900">الخبرات السابقة: </span>{view.experience || '—'}</div>
            </div>
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs">
              <span className="font-bold text-emerald-800">{view.declaration ? '✓ مقرّ بصحة البيانات' : 'بدون إقرار'}</span>
              <span className="text-emerald-800">التوقيع الإلكتروني: <b>{view.e_signature || '—'}</b></span>
            </div>

            <div>
              <div className="mb-1.5 text-xs font-bold text-muted-foreground">المرفقات ({atts.length}) — مخزّنة سحابياً ومرتبطة بهذا الطلب</div>
              {atts.length === 0 ? <div className="text-xs text-muted-foreground">لا مرفقات.</div> : (
                <div className="space-y-1.5">
                  {atts.map((a: any, i: number) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-card px-3 py-2 text-xs ring-1 ring-border">
                      <span className="truncate"><b>{a.doc_type}</b> — {a.file_name} <span className="text-muted-foreground">({a.uploaded_at})</span></span>
                      <span className="flex shrink-0 gap-1">
                        <button className="rounded p-1.5 hover:bg-muted" title="معاينة" onClick={() => previewFile(a.file_key)}><Eye className="h-3.5 w-3.5" /></button>
                        <button className="rounded p-1.5 hover:bg-muted" title="تنزيل" onClick={() => can(actor, 'تنزيل') ? downloadDoc(a.file_key) : toast.show('لا تملك صلاحية التنزيل')}><Download className="h-3.5 w-3.5" /></button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="mb-1.5 text-xs font-bold text-muted-foreground">سجل الحالة والاعتماد</div>
              <div className="space-y-1">
                {logs.map((l: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-navy-700" />
                    <span className="font-bold text-navy-900">{l.action}</span>
                    <span className="text-muted-foreground">— {l.by} — {String(l.at).slice(0, 10)} — {l.status}</span>
                  </div>
                ))}
              </div>
            </div>

            {view.converted ? (
              <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800">
                ✓ هذا الطلب مُحوَّل إلى الموظف <b>{view.employee_code}</b> بتاريخ {view.converted_date} بواسطة {view.converted_by} — المرفقات معروضة في قسم «طلبات التوظيف والمرفقات» بملف الموظف، والطلب محفوظ في الأرشيف.
              </div>
            ) : (
              <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
                {view.status !== 'قيد المراجعة' && <Btn size="sm" variant="outline" disabled={busy} onClick={() => decide('قيد المراجعة')}>قيد المراجعة</Btn>}
                {view.status !== 'مقابلة' && <Btn size="sm" variant="outline" disabled={busy} onClick={() => decide('مقابلة')}>مقابلة</Btn>}
                {view.status !== 'مقبول' && can(actor, 'اعتماد') && <Btn size="sm" variant="success" disabled={busy} onClick={() => decide('مقبول')}><Check className="h-3.5 w-3.5" /> قبول</Btn>}
                {view.status !== 'مرفوض' && can(actor, 'اعتماد') && <Btn size="sm" variant="danger" disabled={busy} onClick={() => decide('مرفوض')}><X className="h-3.5 w-3.5" /> رفض</Btn>}
                {view.status === 'مقبول' && can(actor, 'تحويل') && <Btn size="sm" disabled={busy} onClick={openConvert}><UserPlus className="h-3.5 w-3.5" /> تحويل إلى موظف</Btn>}
              </div>
            )}
            <div className="flex justify-end border-t pt-3">
              <Btn size="sm" variant="outline" onClick={() => openNewLetter(view)}><FileText className="h-3.5 w-3.5" /> إنشاء خطاب مرتبط بهذا الطلب</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* نافذة التحويل إلى موظف */}
      <Modal open={convOpen} onClose={() => setConvOpen(false)} title="تحويل المتقدم إلى موظف">
        <p className="mb-3 text-xs text-muted-foreground">
          سيتم إنشاء سجل الموظف من بيانات الطلب مباشرة دون إعادة إدخال، وربط جميع المرفقات بملفه تحت مرجع الطلب <b>{view?.app_no}</b> — دون نسخ أو تكرار للملفات.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="المشروع *"><Select value={convForm.project} onChange={(e: any) => setConvForm({ ...convForm, project: e.target.value })} options={[{ value: '', label: '— اختر —' }, ...projects.map((p: any) => ({ value: String(p.id), label: p.name }))]} /></Field>
          <Field label="الموقع *"><Select value={convForm.site} onChange={(e: any) => setConvForm({ ...convForm, site: e.target.value })} options={[{ value: '', label: '— اختر —' }, ...sites.map((s: any) => ({ value: String(s.id), label: s.name }))]} /></Field>
          <Field label="المسمى الوظيفي"><TextInput value={convForm.job} onChange={(e: any) => setConvForm({ ...convForm, job: e.target.value })} /></Field>
          <Field label="تاريخ المباشرة"><TextInput type="date" value={convForm.hireDate} onChange={(e: any) => setConvForm({ ...convForm, hireDate: e.target.value })} /></Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setConvOpen(false)}>إلغاء</Btn>
          <Btn disabled={busy} onClick={doConvert}><Users className="h-4 w-4" /> تأكيد التحويل وإنشاء ملف الموظف</Btn>
        </div>
      </Modal>

      {/* نافذة إنشاء/عرض الخطاب */}
      <Modal open={!!ltrOpen} onClose={() => setLtrOpen(null)} title={ltrOpen?.mode === 'new' ? 'إنشاء خطاب رسمي' : ltrOpen?.row?.letter_no} wide>
        {ltrOpen?.mode === 'new' && (
          <div>
            <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="نوع الخطاب">
                <Select value={ltrForm.letter_type} onChange={(e: any) => changeLetterType(e.target.value)} options={LETTER_TYPES.map((t) => ({ value: t, label: t }))} />
              </Field>
              <Field label="الموضوع"><TextInput value={ltrForm.subject} onChange={(e: any) => setLtrForm({ ...ltrForm, subject: e.target.value })} /></Field>
            </div>
            <div className="mb-2 rounded-lg bg-slate-50 p-2 text-[11px] text-muted-foreground ring-1 ring-slate-200">
              مرتبط بالطلب <b className="font-mono">{ltrForm.app_no}</b> — {ltrForm.employee_name} — تمّت التعبئة التلقائية من بيانات الطلب والموظف.
            </div>
            <Field label="محتوى الخطاب">
              <TextArea value={ltrForm.content} onChange={(e: any) => setLtrForm({ ...ltrForm, content: e.target.value })} className="min-h-[240px] font-mono text-xs leading-6" />
            </Field>
            <div className="mt-4 flex justify-end gap-2">
              <Btn variant="ghost" onClick={() => setLtrOpen(null)}>إلغاء</Btn>
              <Btn disabled={busy} onClick={saveLetter}><FileText className="h-4 w-4" /> حفظ كمسودة</Btn>
            </div>
          </div>
        )}
        {ltrOpen?.mode === 'view' && ltrOpen.row && (
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-mono text-xs font-bold text-navy-900">{ltrOpen.row.letter_no}</div>
                <div className="text-xs text-muted-foreground">{ltrOpen.row.letter_type} — مرجع: {ltrOpen.row.app_no || '—'}</div>
              </div>
              <LetterPill value={ltrOpen.row.status} />
            </div>
            <div className="whitespace-pre-wrap rounded-lg border bg-slate-50 p-4 font-mono text-xs leading-6 ring-1 ring-slate-200">{ltrOpen.row.content}</div>
            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs ring-1 ring-slate-200">
              <div className="mb-1 font-bold text-navy-900">سجل الاعتماد</div>
              {ltrLogs.map((l: any, i: number) => (
                <div key={i} className="text-muted-foreground">• {l.action} — {l.by} — {String(l.at).slice(0, 10)} ({l.status})</div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Btn variant="ghost" onClick={() => setLtrOpen(null)}>إغلاق</Btn>
              <Btn variant="outline" onClick={() => printLetter(ltrOpen.row)}><Printer className="h-4 w-4" /> طباعة / PDF</Btn>
              {ltrOpen.row.status === 'مسودة' && can(actor, 'اعتماد') && <Btn variant="success" onClick={async () => { await doApprove(ltrOpen.row); setLtrOpen(null); }}><Check className="h-4 w-4" /> اعتماد</Btn>}
              {ltrOpen.row.status === 'معتمد' && <Btn onClick={async () => { await doSend(ltrOpen.row); setLtrOpen(null); }}><Mail className="h-4 w-4" /> إرسال</Btn>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}