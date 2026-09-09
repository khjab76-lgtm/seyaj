import { useEffect, useMemo, useState } from 'react';
import { Bot, BrainCircuit, CheckCircle2, Mail, MessageCircle, ShieldCheck, SlidersHorizontal, Sparkles, Workflow, FileText, AlertTriangle, Save } from 'lucide-react';

const STORAGE_KEY = 'seyaj_ai_control_v1';

type Mode = 'off' | 'suggest' | 'approve' | 'auto';

type Policy = {
  key: string;
  label: string;
  description: string;
  mode: Mode;
};

const defaultPolicies: Policy[] = [
  { key: 'email_followups', label: 'المتابعات البريدية', description: 'متابعة العملاء والعروض والعقود عبر البريد الإلكتروني.', mode: 'auto' },
  { key: 'whatsapp_followups', label: 'متابعات WhatsApp', description: 'إرسال رسائل المتابعة عبر WhatsApp Business عند توفر التكامل.', mode: 'approve' },
  { key: 'external_letters', label: 'الخطابات الخارجية', description: 'إنشاء الخطابات الرسمية وإرسالها للجهات والعملاء.', mode: 'approve' },
  { key: 'employee_warnings', label: 'إنذارات الموظفين', description: 'تجهيز الإنذارات وحفظها ضمن ملف الموظف وإرسالها بعد الاعتماد.', mode: 'approve' },
  { key: 'reports', label: 'التقارير الدورية', description: 'إنشاء التقارير اليومية والأسبوعية والشهرية تلقائياً.', mode: 'auto' },
  { key: 'contract_alerts', label: 'تنبيهات العقود', description: 'اكتشاف العقود القريبة من الانتهاء وإنشاء إجراءات المتابعة.', mode: 'auto' },
  { key: 'escalation', label: 'التصعيد الإداري', description: 'رفع الحالات المتأخرة أو عالية الخطورة للإدارة.', mode: 'approve' },
];

const modeLabels: Record<Mode, string> = {
  off: 'متوقف',
  suggest: 'اقتراح فقط',
  approve: 'يحتاج اعتماد',
  auto: 'تنفيذ تلقائي',
};

export default function AIControlCenter() {
  const [enabled, setEnabled] = useState(true);
  const [policies, setPolicies] = useState<Policy[]>(defaultPolicies);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed.enabled === 'boolean') setEnabled(parsed.enabled);
      if (Array.isArray(parsed.policies)) setPolicies(parsed.policies);
    } catch { /* use defaults */ }
  }, []);

  const autoCount = useMemo(() => policies.filter((p) => p.mode === 'auto').length, [policies]);
  const approvalCount = useMemo(() => policies.filter((p) => p.mode === 'approve').length, [policies]);

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled, policies, savedAt: new Date().toISOString() }));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const setPolicy = (key: string, mode: Mode) => {
    setPolicies((prev) => prev.map((p) => p.key === key ? { ...p, mode } : p));
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="rounded-2xl bg-gradient-to-l from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-amber-300"><Sparkles className="h-5 w-5" /> مركز التحكم بالذكاء الاصطناعي</div>
            <h2 className="font-cairo text-2xl font-extrabold">AI Manager — عقل نظام سياج</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-white/70">تحكم في مستوى استقلالية الذكاء الاصطناعي. كل إجراء حساس يمكن أن يبقى تحت اعتماد الإدارة، بينما الإجراءات المسموح بها تعمل تلقائياً.</p>
          </div>
          <button onClick={() => setEnabled(!enabled)} className={`flex items-center gap-3 rounded-xl px-5 py-3 font-bold transition ${enabled ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/70'}`}>
            <span className={`h-3 w-3 rounded-full ${enabled ? 'bg-white animate-pulse' : 'bg-white/40'}`} />
            الذكاء الاصطناعي {enabled ? 'مفعّل' : 'متوقف'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat icon={<Bot className="h-5 w-5" />} title="AI Agents" value="11" note="وكلاء متخصصون" />
        <Stat icon={<Workflow className="h-5 w-5" />} title="تلقائي الآن" value={String(autoCount)} note="مسارات تنفيذ تلقائي" />
        <Stat icon={<ShieldCheck className="h-5 w-5" />} title="تحت الاعتماد" value={String(approvalCount)} note="إجراءات حساسة" />
      </div>

      <section className="rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b p-5">
          <div><h3 className="font-cairo font-bold">سياسات التنفيذ</h3><p className="mt-1 text-xs text-muted-foreground">حدد لكل نوع إجراء هل يقترحه AI أو يحتاج اعتماداً أو ينفذه تلقائياً.</p></div>
          <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="divide-y">
          {policies.map((policy) => (
            <div key={policy.key} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-lg bg-slate-100 p-2 text-slate-700"><PolicyIcon policyKey={policy.key} /></div>
                <div><div className="font-semibold">{policy.label}</div><div className="mt-1 text-xs leading-6 text-muted-foreground">{policy.description}</div></div>
              </div>
              <div className="flex flex-wrap gap-2">
                {(['off', 'suggest', 'approve', 'auto'] as Mode[]).map((mode) => (
                  <button key={mode} onClick={() => setPolicy(policy.key, mode)} className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${policy.mode === mode ? 'border-slate-900 bg-slate-900 text-white' : 'hover:bg-muted'}`}>
                    {modeLabels[mode]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <InfoCard icon={<BrainCircuit className="h-5 w-5" />} title="ذاكرة AI" text="تمهيد طبقة ذاكرة مركزية لحفظ سياق العميل والموظف والموقع والعقد والعمليات السابقة وربطها بالوكلاء." />
        <InfoCard icon={<MessageCircle className="h-5 w-5" />} title="قنوات التنفيذ" text="Email وWhatsApp Business كقنوات تنفيذ. الإرسال الفعلي يتطلب إعداد بيانات التكامل والاعتماد الرسمي للقناة." />
      </div>

      <div className="flex justify-end">
        <button onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800">
          {saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? 'تم الحفظ' : 'حفظ إعدادات AI'}
        </button>
      </div>
    </div>
  );
}

function Stat({ icon, title, value, note }: { icon: React.ReactNode; title: string; value: string; note: string }) {
  return <div className="rounded-2xl border bg-card p-5 shadow-sm"><div className="flex items-center justify-between"><span className="text-sm font-semibold text-muted-foreground">{title}</span><span className="rounded-lg bg-slate-100 p-2">{icon}</span></div><div className="mt-3 font-cairo text-3xl font-extrabold">{value}</div><div className="mt-1 text-xs text-muted-foreground">{note}</div></div>;
}

function InfoCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="rounded-2xl border bg-card p-5 shadow-sm"><div className="flex items-center gap-2 font-cairo font-bold">{icon}{title}</div><p className="mt-3 text-sm leading-7 text-muted-foreground">{text}</p></div>;
}

function PolicyIcon({ policyKey }: { policyKey: string }) {
  if (policyKey.includes('email')) return <Mail className="h-4 w-4" />;
  if (policyKey.includes('whatsapp')) return <MessageCircle className="h-4 w-4" />;
  if (policyKey.includes('warning')) return <AlertTriangle className="h-4 w-4" />;
  if (policyKey.includes('letter')) return <FileText className="h-4 w-4" />;
  return <Workflow className="h-4 w-4" />;
}
