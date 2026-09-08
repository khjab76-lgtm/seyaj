import { useState, useMemo } from 'react';
import {
  Bell,
  ShieldAlert,
  AlertTriangle,
  Info,
  CheckCircle2,
  Plus,
  Download,
  Search,
  CheckCheck,
  Building,
  Clock,
  Trash2,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { PageToolbar, Btn, StatCard, Table, StatusBadge, Modal, Field, Input, Select, useToast } from '@/components/ui-kit';

const SEVERITY_CONFIG: Record<string, { label: string; tone: 'danger' | 'warning' | 'info'; icon: any; bg: string; text: string }> = {
  critical: { label: 'حرج للغاية', tone: 'danger', icon: ShieldAlert, bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700' },
  warning: { label: 'تحذير تشغيلي', tone: 'warning', icon: AlertTriangle, bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
  info: { label: 'إشعار توضيحي', tone: 'info', icon: Info, bg: 'bg-sky-50 border-sky-200', text: 'text-sky-700' },
};

export default function AlertsPage() {
  const { alerts, addAlert, dismissAlert, exportCSV, sites, employees, currentUser } = useStore();
  const toast = useToast();

  const [filterSeverity, setFilterSeverity] = useState('all');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [resolveModal, setResolveModal] = useState<any>(null);
  const [resolutionNote, setResolutionNote] = useState('');

  const [newAlert, setNewAlert] = useState({
    title: '',
    message: '',
    severity: 'warning',
    siteName: '',
  });

  const filtered = useMemo(() => {
    return alerts.filter((a: any) => {
      const matchSev = filterSeverity === 'all' || a.severity === filterSeverity;
      const matchSearch =
        !search ||
        a.title?.toLowerCase().includes(search.toLowerCase()) ||
        a.message?.toLowerCase().includes(search.toLowerCase());
      return matchSev && matchSearch;
    });
  }, [alerts, filterSeverity, search]);

  const criticalCount = alerts.filter((a: any) => a.severity === 'critical').length;
  const warningCount = alerts.filter((a: any) => a.severity === 'warning').length;
  const infoCount = alerts.filter((a: any) => a.severity === 'info').length;

  const handleCreateAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlert.title.trim() || !newAlert.message.trim()) {
      toast.show('يرجى كتابة عنوان التنبيه وتفاصيله');
      return;
    }
    const fullMessage = newAlert.siteName
      ? `[${newAlert.siteName}] ${newAlert.message.trim()}`
      : newAlert.message.trim();

    addAlert({
      title: newAlert.title.trim(),
      message: fullMessage,
      severity: newAlert.severity as any,
    });

    setModalOpen(false);
    setNewAlert({ title: '', message: '', severity: 'warning', siteName: '' });
    toast.show('تم بث التنبيه الأمني وتوثيقه في النظام');
  };

  const handleResolveAlert = () => {
    if (!resolveModal) return;
    dismissAlert(resolveModal.id);
    setResolveModal(null);
    setResolutionNote('');
    toast.show('تمت معالجة التنبيه وإغلاقه');
  };

  const handleExport = () => {
    exportCSV(
      'seyaj-security-alerts.csv',
      filtered.map((a: any) => ({
        المعرف: a.id,
        المستوى: SEVERITY_CONFIG[a.severity]?.label || a.severity,
        العنوان: a.title,
        الرسالة: a.message,
        الوقت: a.time,
      }))
    );
    toast.show('تم تصدير التنبيهات الأمنية');
  };

  return (
    <div className="space-y-4">
      <PageToolbar
        title="مركز التنبيهات والأحداث الأمنية"
        subtitle="متابعة فورية للحوادث، الخروقات، عدم مطابقة البصمات، وتأخر الورديات"
        actions={
          <div className="flex items-center gap-2">
            <Btn variant="primary" onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" /> بث تنبيه أمني عاجل
            </Btn>
            <Btn variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4" /> تصدير التنبيهات
            </Btn>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="إجمالي التنبيهات" value={alerts.length} icon={<Bell className="h-5 w-5" />} tone="gold" />
        <StatCard title="حرجة للغاية" value={criticalCount} icon={<ShieldAlert className="h-5 w-5" />} tone="danger" />
        <StatCard title="تحذيرات تشغيلية" value={warningCount} icon={<AlertTriangle className="h-5 w-5" />} tone="warning" />
        <StatCard title="إشعارات معلوماتية" value={infoCount} icon={<Info className="h-5 w-5" />} tone="info" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3 rounded-lg border">
        <div className="flex items-center gap-2">
          <Select
            value={filterSeverity}
            onChange={(e: any) => setFilterSeverity(e.target.value)}
            options={[
              { value: 'all', label: 'كل درجات الأهمية' },
              { value: 'critical', label: 'حرج للغاية (Critical)' },
              { value: 'warning', label: 'تحذير تشغيلي (Warning)' },
              { value: 'info', label: 'إشعار معلوماتي (Info)' },
            ]}
          />
        </div>

        <div className="relative w-72">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e: any) => setSearch(e.target.value)}
            placeholder="بحث في محتوى التنبيهات..."
            className="pr-9"
          />
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-dashed bg-card/50 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-600" />
            <div className="font-bold text-base">لا توجد تنبيهات نشطة مطابقة للبحث</div>
            <div className="text-xs mt-1">جميع المواقع الأمنية تعمل وفق الخطط التشغيلية المعتمدة</div>
          </div>
        ) : (
          filtered.map((a: any) => {
            const config = SEVERITY_CONFIG[a.severity] || SEVERITY_CONFIG.info;
            const Icon = config.icon;
            return (
              <div
                key={a.id}
                className={`flex flex-col md:flex-row items-start md:items-center justify-between p-4 rounded-xl border gap-3 transition-all hover:shadow-sm ${config.bg}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg bg-white/80 shadow-xs mt-0.5 ${config.text}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-sm ${config.text}`}>{a.title}</span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/70 border text-slate-700">
                        {config.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 mt-1 leading-relaxed max-w-2xl">{a.message}</p>
                    <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500">
                      <Clock className="h-3 w-3" />
                      <span>{a.time}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  <Btn
                    size="sm"
                    variant="outline"
                    className="bg-white/80 hover:bg-white"
                    onClick={() => {
                      setResolveModal(a);
                      setResolutionNote('تم التنسيق مع مشرف الموقع واتخاذ اللازم.');
                    }}
                  >
                    <CheckCheck className="h-3.5 w-3.5 text-emerald-600" /> معالجة وإغلاق
                  </Btn>
                  <Btn
                    size="sm"
                    variant="ghost"
                    onClick={() => dismissAlert(a.id)}
                    title="حذف التنبيه"
                    className="text-rose-600 hover:bg-rose-100/50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Btn>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal بث تنبيه جديد */}
      {modalOpen && (
        <Modal title="بث تنبيه أمني عاجل" onClose={() => setModalOpen(false)}>
          <form onSubmit={handleCreateAlert} className="space-y-3">
            <Field label="درجة الأهمية والخطورة">
              <Select
                value={newAlert.severity}
                onChange={(e: any) => setNewAlert({ ...newAlert, severity: e.target.value })}
                options={[
                  { value: 'critical', label: 'حرج للغاية (Critical) — تدخل فوري' },
                  { value: 'warning', label: 'تحذير تشغيلي (Warning) — متابعة مشرف' },
                  { value: 'info', label: 'إشعار معلوماتي (Info)' },
                ]}
              />
            </Field>

            <Field label="عنوان التنبيه">
              <Input
                value={newAlert.title}
                onChange={(e: any) => setNewAlert({ ...newAlert, title: e.target.value })}
                placeholder="مثال: بصمة غير مطابقة، خرق أمني، تأخر حراس..."
                required
              />
            </Field>

            <Field label="الموقع الأمني المعني (اختياري)">
              <Select
                value={newAlert.siteName}
                onChange={(e: any) => setNewAlert({ ...newAlert, siteName: e.target.value })}
                options={[
                  { value: '', label: 'جميع المواقع / إشعار عام' },
                  ...sites.map((s: any) => ({ value: s.name, label: s.name })),
                ]}
              />
            </Field>

            <Field label="تفاصيل البلاغ والتعليمات الميدانية">
              <textarea
                className="w-full rounded-md border p-2 text-xs min-h-[90px] outline-none focus:ring-1 focus:ring-primary"
                value={newAlert.message}
                onChange={(e: any) => setNewAlert({ ...newAlert, message: e.target.value })}
                placeholder="اكتب تفاصيل التنبيه الأمني والإجراء المطلوب من المشرفين تنفيذه فوراً..."
                required
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Btn type="button" variant="outline" onClick={() => setModalOpen(false)}>إلغاء</Btn>
              <Btn type="submit" variant="primary">بث التنبيه الآن</Btn>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal معالجة وإغلاق التنبيه */}
      {resolveModal && (
        <Modal title="معالجة وإغلاق التنبيه الأمني" onClose={() => setResolveModal(null)}>
          <div className="space-y-3">
            <div className="p-3 bg-muted/60 rounded-lg text-xs">
              <div className="font-bold text-sm text-foreground">{resolveModal.title}</div>
              <p className="mt-1 text-muted-foreground">{resolveModal.message}</p>
            </div>

            <Field label="إجراءات المعالجة المتخذة (تسجل في سجل التدقيق)">
              <textarea
                className="w-full rounded-md border p-2 text-xs min-h-[80px] outline-none focus:ring-1 focus:ring-primary"
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="اذكر الإجراءات المتخذة لمعالجة هذا البلاغ..."
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Btn variant="outline" onClick={() => setResolveModal(null)}>إلغاء</Btn>
              <Btn variant="primary" onClick={handleResolveAlert}>
                <CheckCircle2 className="h-4 w-4" /> تأكيد المعالجة وإغلاق البلاغ
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {toast.node}
    </div>
  );
}
