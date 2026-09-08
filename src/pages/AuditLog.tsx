import { useState, useMemo } from 'react';
import {
  FileText,
  ShieldCheck,
  Search,
  Download,
  Printer,
  Calendar,
  User,
  Filter,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Fingerprint,
  Users,
  ShieldAlert,
  Inbox,
  Lock,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { PageToolbar, Btn, StatCard, Table, StatusBadge, Modal, Select, Input, useToast } from '@/components/ui-kit';

const MODULE_MAP: Record<string, { label: string; icon: any; color: string }> = {
  all: { label: 'كل الوحدات', icon: Filter, color: 'text-slate-600' },
  attendance: { label: 'الحضور والانصراف', icon: Fingerprint, color: 'text-emerald-600' },
  employees: { label: 'الموظفون والكوادر', icon: Users, color: 'text-sky-600' },
  violations: { label: 'المخالفات والجزاءات', icon: ShieldAlert, color: 'text-rose-600' },
  requests: { label: 'الطلبات والاعتمادات', icon: Inbox, color: 'text-amber-600' },
  visits: { label: 'المرور والتفتيش الميداني', icon: ShieldCheck, color: 'text-indigo-600' },
  permissions: { label: 'الصلاحيات والأدوار', icon: Lock, color: 'text-purple-600' },
  alerts: { label: 'التنبيهات الأمنية', icon: AlertTriangle, color: 'text-orange-600' },
  system: { label: 'النظام وقواعد البيانات', icon: FileText, color: 'text-slate-600' },
};

export default function AuditLogPage() {
  const { auditLogs, exportCSV, currentUser } = useStore();
  const toast = useToast();

  const [selectedModule, setSelectedModule] = useState('all');
  const [search, setSearch] = useState('');
  const [actorFilter, setActorFilter] = useState('all');
  const [inspectModal, setInspectModal] = useState<any>(null);

  const actors = useMemo(() => {
    const list = Array.from(new Set(auditLogs.map((l: any) => l.actor).filter(Boolean)));
    return [{ value: 'all', label: 'كل المنفذين' }, ...list.map((a) => ({ value: a, label: a }))];
  }, [auditLogs]);

  const filtered = useMemo(() => {
    return auditLogs.filter((log: any) => {
      const matchModule = selectedModule === 'all' || log.module === selectedModule;
      const matchActor = actorFilter === 'all' || log.actor === actorFilter;
      const matchSearch =
        !search ||
        log.action?.toLowerCase().includes(search.toLowerCase()) ||
        log.details?.toLowerCase().includes(search.toLowerCase()) ||
        log.actor?.toLowerCase().includes(search.toLowerCase()) ||
        (log.target && String(log.target).toLowerCase().includes(search.toLowerCase()));

      return matchModule && matchActor && matchSearch;
    });
  }, [auditLogs, selectedModule, actorFilter, search]);

  const handleExport = () => {
    exportCSV(
      'seyaj-audit-logs.csv',
      filtered.map((l: any) => ({
        المعرف: l.id,
        الوقت: l.timestamp,
        المنفذ: l.actor,
        الدور: l.role || '—',
        الوحدة: MODULE_MAP[l.module]?.label || l.module,
        الإجراء: l.action,
        الهدف: l.target || '—',
        التفاصيل: l.details || '—',
      }))
    );
    toast.show('تم تصدير سجل التدقيق الشامل بصيغة CSV');
  };

  return (
    <div className="space-y-4">
      <PageToolbar
        title="سجل التدقيق والامتثال الأمني (Audit Log)"
        subtitle="سجل موثوق وغير قابل للتعديل لكافة العمليات الحساسة، التعديلات، وحركات الاعتماد"
        actions={
          <div className="flex items-center gap-2">
            <Btn variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4" /> تصدير CSV
            </Btn>
            <Btn variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> طباعة السجل
            </Btn>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="إجمالي السجلات" value={auditLogs.length} icon={<FileText className="h-5 w-5" />} tone="navy" />
        <StatCard title="عمليات الحضور" value={auditLogs.filter((l: any) => l.module === 'attendance').length} icon={<Fingerprint className="h-5 w-5" />} tone="success" />
        <StatCard title="إجراءات المخالفات" value={auditLogs.filter((l: any) => l.module === 'violations').length} icon={<ShieldAlert className="h-5 w-5" />} tone="danger" />
        <StatCard title="الطلبات والموافقات" value={auditLogs.filter((l: any) => l.module === 'requests').length} icon={<Inbox className="h-5 w-5" />} tone="warning" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3 rounded-lg border">
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={selectedModule}
            onChange={(e: any) => setSelectedModule(e.target.value)}
            options={[
              { value: 'all', label: 'كل الوحدات والعمليات' },
              { value: 'attendance', label: 'الحضور والانصراف' },
              { value: 'employees', label: 'الموظفون' },
              { value: 'violations', label: 'المخالفات والجزاءات' },
              { value: 'requests', label: 'الطلبات والاعتمادات' },
              { value: 'visits', label: 'المرور الميداني' },
              { value: 'permissions', label: 'الصلاحيات' },
              { value: 'alerts', label: 'التنبيهات' },
              { value: 'system', label: 'إدارة النظام' },
            ]}
          />

          <Select
            value={actorFilter}
            onChange={(e: any) => setActorFilter(e.target.value)}
            options={actors}
          />
        </div>

        <div className="relative w-72">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e: any) => setSearch(e.target.value)}
            placeholder="بحث في السجلات والمنفذين..."
            className="pr-9"
          />
        </div>
      </div>

      <Table head={['#', 'الوقت والتاريخ', 'المنفذ / المستخدم', 'الوحدة', 'الإجراء', 'الهدف / السجل المعني', 'التفاصيل', 'معاينة']}>
        {filtered.length === 0 ? (
          <tr>
            <td colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
              لا توجد سجلات مطابقة لمعايير البحث
            </td>
          </tr>
        ) : (
          filtered.map((log: any, idx: number) => {
            const modInfo = MODULE_MAP[log.module] || MODULE_MAP.system;
            const ModIcon = modInfo.icon;
            return (
              <tr key={log.id || idx} className="hover:bg-muted/40 transition-colors">
                <td className="px-4 py-2.5 num text-xs text-muted-foreground">{idx + 1}</td>
                <td className="px-4 py-2.5 num text-xs font-mono text-slate-600 whitespace-nowrap">
                  {log.timestamp}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-semibold text-xs">{log.actor}</span>
                  </div>
                  {log.role && <div className="text-[10px] text-muted-foreground pr-5">{log.role}</div>}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 ${modInfo.color}`}>
                    <ModIcon className="h-3 w-3" />
                    {modInfo.label}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-bold text-xs">{log.action}</td>
                <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground">
                  {log.target || '—'}
                </td>
                <td className="px-4 py-2.5 text-xs max-w-xs truncate text-slate-700" title={log.details}>
                  {log.details || '—'}
                </td>
                <td className="px-4 py-2.5">
                  <Btn size="sm" variant="ghost" onClick={() => setInspectModal(log)} title="فحص تفاصيل السجل">
                    <Eye className="h-3.5 w-3.5" />
                  </Btn>
                </td>
              </tr>
            );
          })
        )}
      </Table>

      {/* Inspect Log Details Modal */}
      {inspectModal && (
        <Modal title="تفاصيل حدث التدقيق والأمان" onClose={() => setInspectModal(null)}>
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2 bg-muted/40 p-3 rounded-lg border">
              <div>
                <span className="text-muted-foreground font-semibold">رقم السجل:</span> #{inspectModal.id}
              </div>
              <div>
                <span className="text-muted-foreground font-semibold">تاريخ ووقت الحدث:</span> {inspectModal.timestamp}
              </div>
              <div>
                <span className="text-muted-foreground font-semibold">المنفذ:</span> {inspectModal.actor}
              </div>
              <div>
                <span className="text-muted-foreground font-semibold">الصلاحية:</span> {inspectModal.role || 'مدير نظام'}
              </div>
              <div>
                <span className="text-muted-foreground font-semibold">الوحدة:</span> {MODULE_MAP[inspectModal.module]?.label || inspectModal.module}
              </div>
              <div>
                <span className="text-muted-foreground font-semibold">الهدف / المعرف:</span> {inspectModal.target || '—'}
              </div>
            </div>

            <div className="p-3 bg-white border rounded-lg">
              <div className="font-bold text-slate-800 mb-1">الإجراء المتخذ:</div>
              <div className="font-semibold text-primary">{inspectModal.action}</div>
              <div className="mt-2 text-slate-600 leading-relaxed">{inspectModal.details}</div>
            </div>

            {inspectModal.payload && (
              <div className="p-3 bg-slate-900 text-slate-100 rounded-lg font-mono text-[11px] overflow-x-auto">
                <div className="text-slate-400 mb-1">الحمولة الرقمية (Payload):</div>
                <pre>{JSON.stringify(inspectModal.payload, null, 2)}</pre>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t">
              <Btn variant="outline" onClick={() => setInspectModal(null)}>إغلاق</Btn>
            </div>
          </div>
        </Modal>
      )}

      {toast.node}
    </div>
  );
}
