import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, MapPin, ShieldAlert, Save } from 'lucide-react';
import { useStore } from '@/lib/store';
import { PageToolbar, Table, Btn, Field, TextInput, Modal, StatusBadge, StatCard, useToast } from '@/components/ui-kit';
import { siteHeadcount, isOverCapacity, fmt } from '@/lib/seyaj';

export default function SitesCapacity() {
  const { sites, projects, employees, siteCapacity, upsertSiteCapacity, capacityReviews, addCapacityReview, closeCapacityReview } = useStore();
  const toast = useToast();
  const [edit, setEdit] = useState<any>(null);
  const [review, setReview] = useState<any>(null);
  const [justification, setJustification] = useState('');

  const rows = useMemo(() => sites.map((s: any) => {
    const cap = siteCapacity.find((c: any) => c.siteId === s.id) ?? { siteId: s.id, base: 0, relief: 0, patrol: 0, cost: 0 };
    const head = siteHeadcount(s.id, employees);
    const project = projects.find((p: any) => p.siteId === s.id);
    const openReview = capacityReviews.find((r: any) => r.siteId === s.id && !r.closed);
    return { ...s, cap, head, project: project ? project.name : '—', over: isOverCapacity(cap, head), openReview };
  }), [sites, siteCapacity, employees, projects, capacityReviews]);

  const overCount = rows.filter((r: any) => r.over).length;
  const totalCost = rows.reduce((s: number, r: any) => s + (r.cap.cost || 0), 0);
  const editTitle = edit ? 'سعة وتكلفة: ' + edit.name : '';
  const reviewTitle = review ? 'تبرير مراجعة السعة: ' + review.name : '';
  const reviewMax = review ? review.cap.base + review.cap.relief + review.cap.patrol : 0;

  const saveCap = () => {
    if (!edit) return;
    upsertSiteCapacity({ siteId: edit.siteId, base: Number(edit.base) || 0, relief: Number(edit.relief) || 0, patrol: Number(edit.patrol) || 0, cost: Number(edit.cost) || 0 });
    setEdit(null);
    toast.show('حُدّثت سعة الموقع وتكلفته');
  };

  const openReviewFor = (r: any) => {
    setReview(r);
    setJustification(r.openReview ? r.openReview.justification : '');
  };

  const submitReview = () => {
    if (!review) return;
    if (review.openReview && !review.openReview.closed) {
      closeCapacityReview(review.openReview.id, justification, 'مدير العمليات');
    } else {
      addCapacityReview({ siteId: review.id, siteName: review.name, headcount: review.head, capacity: reviewMax, justification, closedBy: 'مدير العمليات', closed: true });
    }
    setReview(null);
    toast.show('تم تبرير المراجعة وإغلاق التنبيه');
  };

  return (
    <div>
      <PageToolbar title="إدارة المواقع والسعات والتكاليف" subtitle="ربط الموقع بالمشروع، العدد الأساسي وبدلاء الراحات والدوريات، تكلفة الموقع، وتنبيه تجاوز السعة" />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="المواقع" value={rows.length} icon={<MapPin className="h-5 w-5" />} tone="navy" />
        <StatCard title="مواقع متجاوزة السعة" value={overCount} icon={<AlertTriangle className="h-5 w-5" />} tone={overCount ? 'danger' : 'success'} hint={overCount ? 'تحتاج تبريراً من صاحب الصلاحية' : 'الوضع مستقر'} />
        <StatCard title="إجمالي القوة النشطة" value={rows.reduce((s: number, r: any) => s + r.head, 0)} icon={<ShieldAlert className="h-5 w-5" />} tone="info" />
        <StatCard title="إجمالي التكلفة الشهرية" value={fmt(totalCost) + ' ر.س'} icon={<Save className="h-5 w-5" />} tone="gold" />
      </div>

      <Table head={['الموقع', 'الكود', 'المشروع المرتبط', 'الأساسي', 'بدلاء راحات', 'دوريات', 'الحالي', 'الحالة', 'التكلفة شهر', 'إجراءات']}>
        {rows.map((r: any) => (
          <tr key={r.id} className={'hover:bg-muted/40 ' + (r.over ? 'bg-rose-50/50' : '')}>
            <td className="px-4 py-2.5 font-bold">{r.name}</td>
            <td className="px-4 py-2.5 num">{r.code}</td>
            <td className="px-4 py-2.5 text-xs">{r.project}</td>
            <td className="px-4 py-2.5 num">{r.cap.base}</td>
            <td className="px-4 py-2.5 num">{r.cap.relief}</td>
            <td className="px-4 py-2.5 num">{r.cap.patrol}</td>
            <td className={'px-4 py-2.5 font-bold num ' + (r.over ? 'text-rose-600' : 'text-emerald-700')}>{r.head}</td>
            <td className="px-4 py-2.5">
              <StatusBadge value={r.over ? 'تجاوز السعة' : 'ضمن السعة'} />
            </td>
            <td className="px-4 py-2.5 num">{fmt(r.cap.cost)}</td>
            <td className="px-4 py-2.5">
              <div className="flex items-center gap-1">
                <Btn size="sm" variant="outline" onClick={() => setEdit({ siteId: r.id, name: r.name, ...r.cap })}>سعة وتكلفة</Btn>
                <Btn size="sm" variant={r.over ? 'primary' : 'ghost'} onClick={() => openReviewFor(r)} disabled={!r.over}>
                  {r.over ? (r.openReview && !r.openReview.closed ? 'تبرير مطلوب' : 'مراجعة') : '—'}
                </Btn>
              </div>
            </td>
          </tr>
        ))}
      </Table>

      <div className="mt-6 rounded-xl border bg-card shadow-sm">
        <div className="border-b px-4 py-3 font-cairo text-sm font-bold">سجل تبريرات المراجعات وإغلاق التنبيهات</div>
        <Table head={['الموقع', 'الحالي', 'السعة', 'التبرير', 'أُغلق بواسطة', 'التاريخ', 'الحالة']}>
          {capacityReviews.length ? capacityReviews.map((rv: any) => (
            <tr key={rv.id} className="hover:bg-muted/40">
              <td className="px-4 py-2.5 font-bold">{rv.siteName}</td>
              <td className="px-4 py-2.5 num">{rv.headcount}</td>
              <td className="px-4 py-2.5 num">{rv.capacity}</td>
              <td className="max-w-xs px-4 py-2.5 text-xs">{rv.justification}</td>
              <td className="px-4 py-2.5">{rv.closedBy}</td>
              <td className="px-4 py-2.5 num">{rv.date}</td>
              <td className="px-4 py-2.5"><StatusBadge value={rv.closed ? 'مغلق' : 'مفتوح'} /></td>
            </tr>
          )) : <tr><td colSpan={7} className="py-10 text-center text-sm text-muted-foreground">لا توجد مراجعات مسجلة — تظهر هنا كل تبريرات تجاوز السعة بعد إغلاقها من صاحب الصلاحية.</td></tr>}
        </Table>
      </div>
      {toast.node}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={editTitle}>
        {edit ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="العدد الأساسي"><TextInput type="number" value={edit.base} onChange={(e: any) => setEdit({ ...edit, base: e.target.value })} /></Field>
            <Field label="بدلاء الراحات"><TextInput type="number" value={edit.relief} onChange={(e: any) => setEdit({ ...edit, relief: e.target.value })} /></Field>
            <Field label="الدوريات"><TextInput type="number" value={edit.patrol} onChange={(e: any) => setEdit({ ...edit, patrol: e.target.value })} /></Field>
            <Field label="التكلفة الشهرية ر.س"><TextInput type="number" value={edit.cost} onChange={(e: any) => setEdit({ ...edit, cost: e.target.value })} /></Field>
            <div className="col-span-2 text-xs text-muted-foreground">
              الحد الأقصى المسموح = الأساسي + بدلاء الراحات + الدوريات. عند تجاوز العدد النشط لهذا الحد يظهر تنبيه «تجاوز السعة» ولا يُغلق إلا بتبرير من صاحب الصلاحية.
            </div>
          </div>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Btn variant="outline" onClick={() => setEdit(null)}>إلغاء</Btn>
          <Btn onClick={saveCap}><Save className="h-4 w-4" /> حفظ</Btn>
        </div>
      </Modal>

      <Modal open={!!review} onClose={() => setReview(null)} title={reviewTitle}>
        {review ? (
          <div>
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-200">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              العدد الحالي {review.head} يتجاوز السعة المعتمدة {reviewMax}. يجب تبرير المراجعة لإغلاق التنبيه.
            </div>
            <Field label="مبرر المراجعة (يظهر في سجل المراجعات)">
              <TextInput value={justification} onChange={(e: any) => setJustification(e.target.value)} placeholder="مثال: زيادة مؤقتة لتغطية فعالية موسمية حتى نهاية الشهر" />
            </Field>
          </div>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Btn variant="outline" onClick={() => setReview(null)}>إلغاء</Btn>
          <Btn variant="success" onClick={submitReview}><CheckCircle2 className="h-4 w-4" /> تبرير وإغلاق التنبيه</Btn>
        </div>
      </Modal>
    </div>
  );
}