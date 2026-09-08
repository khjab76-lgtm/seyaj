// صفحة الموارد البشرية — الإنذارات والتدقيق والصلاحيات والتكامل
// كشف الغياب المتتالي غير المبرر تلقائياً (5/10/15 يوماً) وإصدار الإنذارات،
// مركز إرسال قابل للربط بواتساب/بريد، سجل تدقيق لكل العمليات الحساسة،
// مصفوفة صلاحيات الوحدات، وحالة التكاملات المستقبلية (قوى/التأمينات/Mudad/البنوك).
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import {
  PageToolbar, StatCard, Table, Modal, Field, Select, Btn,
  EmptyRow, StatusBadge, useToast,
} from '@/components/ui-kit';
import { AlertTriangle, ScrollText, Send, PlugZap, Radar, Check } from 'lucide-react';
import {
  fetchWarnings, createWarning, markLetterSent, consecutiveAbsence, warningLevelFor,
  fetchAuditLogs, SEND_CHANNELS, FUTURE_INTEGRATIONS, todayISO,
} from '@/lib/hr';
import { WarningLetter, TerminationLetter } from '@/components/HrPapers';

const HR_UNITS = [
  { key: 'leaves', label: 'الإجازات والأرصدة' },
  { key: 'payroll', label: 'الرواتب والبنوك' },
  { key: 'employees', label: 'ملف الموظف والمستندات' },
  { key: 'warnings', label: 'الإنذارات والمخالفات' },
  { key: 'audit', label: 'سجل التدقيق' },
  { key: 'integrations', label: 'التكاملات' },
];
const HR_ROLES = ['مدير عام', 'مدير الموارد البشرية', 'مدير العمليات', 'مدير المنطقة', 'المشرف المباشر', 'محاسب الرواتب', 'موظف'];
// مصفوفة صلاحيات افتراضية على مستوى الوحدات والوظائف
const DEFAULT_PERMS: Record<string, Record<string, string[]>> = {
  'مدير الموارد البشرية': { leaves: ['عرض', 'اعتماد نهائي', 'تصفية'], payroll: ['عرض', 'اعتماد'], employees: ['عرض', 'إصدار مستندات', 'حركة'], warnings: ['إصدار', 'إرسال'], audit: ['عرض'], integrations: ['تفعيل'] },
  'مدير العمليات': { leaves: ['عرض', 'اعتماد'], payroll: ['عرض'], employees: ['عرض'], warnings: ['عرض'], audit: ['عرض'], integrations: [] },
  'مدير المنطقة': { leaves: ['عرض', 'اعتماد'], payroll: [], employees: ['عرض'], warnings: ['عرض'], audit: [], integrations: [] },
  'المشرف المباشر': { leaves: ['عرض', 'اعتماد أولي'], payroll: [], employees: ['عرض'], warnings: ['اقتراح'], audit: [], integrations: [] },
  'محاسب الرواتب': { leaves: ['عرض'], payroll: ['عرض', 'إنشاء مسودة'], employees: ['عرض'], warnings: [], audit: [], integrations: [] },
  'موظف': { leaves: ['تقديم طلب'], payroll: [], employees: ['عرض ملفي'], warnings: [], audit: [], integrations: [] },
  'مدير عام': { leaves: ['عرض', 'اعتماد نهائي'], payroll: ['عرض', 'اعتماد'], employees: ['عرض', 'إصدار مستندات'], warnings: ['إصدار', 'إرسال'], audit: ['عرض'], integrations: ['تفعيل'] },
};

export default function HrAuditPage() {
  const { employees, attendance, roles } = useStore();
  const toast = useToast();
  const [tab, setTab] = useState<'warnings' | 'audit' | 'perms' | 'integrations'>('warnings');
  const [warnings, setWarnings] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendTo, setSendTo] = useState<any>(null);
  const [channel, setChannel] = useState('manual');
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [scanMsg, setScanMsg] = useState('');

  const reload = async () => {
    setLoading(true);
    const [w, l] = await Promise.all([fetchWarnings(), fetchAuditLogs()]);
    setWarnings(w); setLogs(l);
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  // ===== كشف الغياب المتتالي غير المبرر =====
  const absenceRows = useMemo(() => {
    return employees.filter((e: any) => e.status !== 'موقوف').map((e: any) => {
      const present = attendance
        .filter((a: any) => a.employeeId === e.id && a.status !== 'غائب')
        .map((a: any) => a.date);
      const days = consecutiveAbsence(present);
      const level = warningLevelFor(days);
      const already = warnings.filter((w: any) => w.employee_code === e.no);
      return { emp: e, days, level, already };
    }).filter((r: any) => r.level);
  }, [employees, attendance, warnings]);

  const scan = async () => {
    let created = 0;
    for (const r of absenceRows) {
      const exists = warnings.some((w: any) => w.employee_code === r.emp.no && w.warning_type === r.level.label);
      if (exists) continue;
      await createWarning({
        employee_code: r.emp.no, employee_name: r.emp.name, warning_type: r.level.label,
        absence_days: r.days, absence_from: '', absence_to: todayISO(), article_ref: r.level.article,
        note: 'أُنشئ تلقائياً من كشف الغياب المتتالي',
      });
      created++;
    }
    setScanMsg(created ? `تم إصدار ${created} إنذاراً جديداً تلقائياً` : 'لا توجد حالات غياب تستوجب إنذاراً جديداً');
    toast.show(created ? `أُصدر ${created} إنذاراً` : 'الفحص مكتمل — لا جديد');
    reload();
  };

  const sendLetter = async () => {
    setBusy(true);
    await markLetterSent(sendTo.id, SEND_CHANNELS.find((c) => c.code === channel)?.label || channel, 'مدير الموارد البشرية');
    setBusy(false); setSendTo(null);
    toast.show('تم تسجيل الإرسال — يُنفذ في اليوم التالي للاعتماد');
    reload();
  };

  return (
    <div>
      {toast.node}
      <PageToolbar
        title="الإنذارات والتدقيق والصلاحيات والتكامل"
        subtitle="كشف آلي للغياب المتتالي وفق المادة (80)، مركز إرسال، سجل تدقيق شامل، وصلاحيات على مستوى الوحدات"
        actions={<Btn variant="outline" size="sm" onClick={reload}>تحديث</Btn>}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="إنذارات مسجلة" value={warnings.length} icon={<AlertTriangle className="h-5 w-5" />} tone="warning" />
        <StatCard title="بانتظار الإرسال" value={warnings.filter((w: any) => w.letter_status !== 'sent').length} icon={<Send className="h-5 w-5" />} tone="danger" />
        <StatCard title="سجلات تدقيق" value={logs.length} icon={<ScrollText className="h-5 w-5" />} tone="navy" />
        <StatCard title="حالات غياب حرجة" value={absenceRows.length} icon={<Radar className="h-5 w-5" />} tone={absenceRows.length ? 'danger' : 'success'} />
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {([
          ['warnings', 'الإنذارات والغياب'], ['audit', 'سجل التدقيق'], ['perms', 'الصلاحيات'], ['integrations', 'التكامل'],
        ] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} className={'rounded-lg px-4 py-2 text-sm font-bold ' + (tab === t ? 'bg-navy-900 text-gold-400' : 'bg-muted text-muted-foreground hover:bg-muted/70')}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'warnings' && (
        <div className="space-y-5">
          {/* كشف الغياب المتتالي */}
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-cairo text-base font-bold text-navy-900">كشف الغياب المتتالي غير المبرر (آلي)</h3>
              <Btn size="sm" onClick={scan}><Radar className="h-4 w-4" /> تشغيل الفحص وإصدار الإنذارات</Btn>
            </div>
            <p className="mb-2 text-xs text-muted-foreground">
              وفق اللائحة ونظام العمل: 5 أيام ← إنذار أول، 10 أيام ← إنذار ثانٍ، 15 يوماً ← خطاب فصل (المادة 80/7).
            </p>
            {scanMsg && <p className="mb-2 rounded bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">{scanMsg}</p>}
            <Table head={['الموظف', 'الرقم الوظيفي', 'أيام غياب متتالية', 'الإجراء المستحق', 'حالة الإنذار']}>
              {absenceRows.length === 0 ? <EmptyRow colSpan={5} text="لا توجد حالات غياب متتالٍ تستوجب إجراءً" /> :
                absenceRows.map((r: any) => (
                  <tr key={r.emp.id}>
                    <td className="px-4 py-2.5 font-bold text-navy-900">{r.emp.name}</td>
                    <td className="px-4 py-2.5">{r.emp.no}</td>
                    <td className="px-4 py-2.5"><span className="num rounded-md bg-rose-50 px-2 py-0.5 font-bold text-rose-700 ring-1 ring-rose-200">{r.days} يوم</span></td>
                    <td className="px-4 py-2.5 text-xs">{r.level.label}</td>
                    <td className="px-4 py-2.5 text-xs">{r.already.length ? <span className="text-emerald-700">مسجّل {r.already.length}</span> : <span className="text-amber-700">لم يصدر بعد</span>}</td>
                  </tr>
                ))}
            </Table>
          </div>

          {/* قائمة الإنذارات */}
          <div>
            <h3 className="mb-2 font-cairo text-base font-bold text-navy-900">سجل الإنذارات والخطابات</h3>
            <Table head={['الموظف', 'نوع الإنذار', 'الغياب', 'المرجع النظامي', 'الحالة', 'الإرسال', 'إجراءات']}>
              {loading ? <EmptyRow colSpan={7} text="جارٍ التحميل..." /> : warnings.length === 0 ? <EmptyRow colSpan={7} text="لا توجد إنذارات" /> :
                warnings.map((w: any) => (
                  <tr key={w.id}>
                    <td className="px-4 py-2.5 font-bold text-navy-900">{w.employee_name}<div className="text-[10px] font-normal text-muted-foreground">{w.employee_code}</div></td>
                    <td className="px-4 py-2.5 text-xs">{w.warning_type}</td>
                    <td className="px-4 py-2.5 num">{w.absence_days} يوم</td>
                    <td className="px-4 py-2.5 text-[10px] text-muted-foreground">{w.article_ref}</td>
                    <td className="px-4 py-2.5"><StatusBadge value={w.letter_status === 'sent' ? 'معتمد' : 'معلق'} /></td>
                    <td className="px-4 py-2.5 text-xs">{w.sent_via ? `${w.sent_via} — ${w.sent_date}` : '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        <Btn size="sm" variant="outline" onClick={() => setPreview(w)}>
                          {w.warning_type.includes('فصل') ? 'خطاب الفصل' : 'الإنذار'}
                        </Btn>
                        {w.letter_status !== 'sent' && (
                          <Btn size="sm" onClick={() => { setSendTo(w); setChannel('manual'); }}><Send className="h-3.5 w-3.5" /> إرسال</Btn>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </Table>
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <Table head={['التاريخ', 'المُنفِّذ', 'العملية', 'الكيان', 'المعرّف', 'التفاصيل']}>
          {loading ? <EmptyRow colSpan={6} text="جارٍ التحميل..." /> : logs.length === 0 ? <EmptyRow colSpan={6} text="لا توجد سجلات بعد — تُسجَّل كل العمليات الحساسة تلقائياً" /> :
            logs.slice(0, 200).map((l: any) => (
              <tr key={l.id}>
                <td className="px-4 py-2 text-xs">{l.created_at ? String(l.created_at).slice(0, 16).replace('T', ' ') : '—'}</td>
                <td className="px-4 py-2 font-bold text-navy-900">{l.actor}</td>
                <td className="px-4 py-2">{l.action}</td>
                <td className="px-4 py-2 font-mono text-[10px] text-muted-foreground">{l.entity}</td>
                <td className="px-4 py-2 font-mono text-[10px]">{l.entity_id}</td>
                <td className="px-4 py-2 text-xs">{l.details || '—'}</td>
              </tr>
            ))}
        </Table>
      )}

      {tab === 'perms' && (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="p-3 text-right font-bold">الوحدة \ الدور</th>
                {HR_ROLES.map((r) => <th key={r} className="p-3 text-right text-xs font-bold">{r}</th>)}
              </tr>
            </thead>
            <tbody>
              {HR_UNITS.map((u) => (
                <tr key={u.key} className="border-t">
                  <td className="p-3 font-bold text-navy-900">{u.label}</td>
                  {HR_ROLES.map((r) => {
                    const perms = DEFAULT_PERMS[r]?.[u.key] || [];
                    return (
                      <td key={r} className="p-2 align-top">
                        {perms.length ? perms.map((p) => (
                          <span key={p} className="mb-1 mr-1 inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">{p}</span>
                        )) : <span className="text-[10px] text-muted-foreground">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t p-3 text-[11px] text-muted-foreground">
            الصلاحيات مبنية على أدوار نظام «سياج» ({roles.length} دوراً مسجلاً) — كل إجراء حساس يمر عبر سجل التدقيق.
          </p>
        </div>
      )}

      {tab === 'integrations' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FUTURE_INTEGRATIONS.map((it) => (
            <div key={it.key} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-cairo text-base font-bold text-navy-900">{it.label}</h3>
                <span className={'rounded px-2 py-0.5 text-[10px] font-bold ring-1 ' + (it.status.startsWith('غير') ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200')}>
                  {it.status}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{it.desc}</p>
              <div className="mt-3 rounded-lg bg-slate-50 p-3 text-[11px] ring-1 ring-slate-200">
                <div className="flex items-center gap-1 font-bold text-navy-900"><PlugZap className="h-3.5 w-3.5" /> جاهزية الربط</div>
                <ul className="mt-1 space-y-0.5 text-slate-600">
                  <li>• واجهة موحدة في طبقة HR تنتظر المفاتيح</li>
                  <li>• لا يُفعَّل أي API قبل تزويد بيانات الاعتماد</li>
                  <li>• المخرجات الحالية جاهزة بصيغة الاستيراد المعتمدة</li>
                </ul>
              </div>
            </div>
          ))}
          <div className="rounded-xl border bg-card p-4 shadow-sm sm:col-span-2">
            <h3 className="mb-1 font-cairo text-base font-bold text-navy-900">مركز الإرسال (واتساب / البريد)</h3>
            <p className="text-xs text-muted-foreground">
              كل خطابات الإنذار والفصل تمر عبر «مركز الإرسال» — التسليم اليدوي مقابل التوقيع متاح الآن،
              والربط بواتساب الأعمال أو البريد يُفعَّل فور توفير المفاتيح دون تغيير في سير العمل.
            </p>
          </div>
        </div>
      )}

      {/* معاينة خطاب الإنذار/الفصل */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.warning_type} wide>
        {preview && (() => {
          const emp = employees.find((e: any) => e.no === preview.employee_code);
          const data = {
            name: preview.employee_name, employeeCode: preview.employee_code,
            idNumber: emp ? '1' + String(emp.phone).replace(/\D/g, '').slice(1, 10) : '',
            job: emp?.job || '', department: 'العمليات',
            absenceDays: preview.absence_days, absenceFrom: preview.absence_from, absenceTo: preview.absence_to,
            docDate: todayISO(),
          };
          return (
            <div>
              {preview.warning_type.includes('فصل')
                ? <TerminationLetter e={data as any} />
                : <WarningLetter e={data as any} />}
              <div className="mt-3 flex justify-end"><Btn variant="ghost" onClick={() => setPreview(null)}>إغلاق</Btn></div>
            </div>
          );
        })()}
      </Modal>

      {/* إرسال */}
      <Modal open={!!sendTo} onClose={() => setSendTo(null)} title="تسجيل إرسال الخطاب">
        {sendTo && (
          <div>
            <p className="mb-3 text-sm">
              <b>{sendTo.employee_name}</b> — {sendTo.warning_type}
            </p>
            <Field label="قناة الإرسال">
              <Select value={channel} onChange={(e: any) => setChannel(e.target.value)}
                options={SEND_CHANNELS.map((c) => ({ value: c.code, label: c.label }))} />
            </Field>
            <p className="mt-2 text-[11px] text-muted-foreground">
              يُسجَّل الإرسال رسمياً في اليوم التالي للاعتماد، وكل عملية تدخل سجل التدقيق.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Btn variant="ghost" onClick={() => setSendTo(null)}>إلغاء</Btn>
              <Btn disabled={busy} onClick={sendLetter}><Check className="h-4 w-4" /> تأكيد التسجيل</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
