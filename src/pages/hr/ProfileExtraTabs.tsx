// تبويبات ملف الموظف 11–18 — كلها مرتبطة برقم الموظف employee_code.
import { Table, EmptyRow, StatusBadge, Btn } from '@/components/ui-kit';
import { Plane, Stamp, Mail, ClipboardCheck, GitBranch, History, Paperclip, Eye, Download, UserPlus, Trash2, Plus, ScanText } from 'lucide-react';
import { expiryStatus } from '@/lib/hr';
import { parseAttachments, downloadDoc } from '@/lib/recruitment';

const ATTACH_TYPES = ['هوية', 'إقامة', 'شهادة تدريب', 'عقد', 'مرفق آخر'];

function Letters({ rows, withType, onPreview }: any) {
  const head = withType ? ['رقم الخطاب', 'النوع', 'الموضوع', 'الحالة', 'التاريخ', ''] : ['رقم الخطاب', 'الموضوع', 'الحالة', 'التاريخ', ''];
  return (
    <Table head={head}>
      {rows.length === 0 ? <EmptyRow colSpan={head.length} text="لا توجد خطابات" /> :
        rows.map((l: any) => (
          <tr key={l.id}>
            <td className="px-4 py-2 font-mono text-xs font-bold">{l.letter_no}</td>
            {withType && <td className="px-4 py-2 text-xs">{l.letter_type}</td>}
            <td className="px-4 py-2 text-xs">{l.subject || '—'}</td>
            <td className="px-4 py-2"><StatusBadge value={l.status} /></td>
            <td className="px-4 py-2 text-xs num">{l.sent_date || String(l.created_at || '').slice(0, 10) || '—'}</td>
            <td className="px-4 py-2">{l.attachment_key ? <button title="معاينة" onClick={() => onPreview(l.attachment_key)} className="rounded p-1 hover:bg-muted"><Eye className="h-3.5 w-3.5" /></button> : '—'}</td>
          </tr>
        ))}
    </Table>
  );
}

export default function ProfileExtraTabs(p: any) {
  const { tab, sel, empSupports, transferLetters, confirmLetters, otherLetters, empVisits, recApps, empDocsAll, audits, onPreview, onDocPreview, onDeleteDoc, onAddAttach, onOcrDoc } = p;
  // وضع القراءة فقط للموظف العادي — كل ما تبقى من خصائص العرض دون تغيير.
  const canEdit = p.canEdit !== false;

  if (tab === 'support') return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><GitBranch className="h-4 w-4 text-navy-900" /> حركات المساندة (تغطية مواقع/ورديات إضافية/بديل راحات) المرتبطة بالموظف.</div>
      <Table head={['النوع', 'الموقع الأساسي', 'موقع التغطية', 'التاريخ', 'من', 'إلى', 'ملاحظة', 'المصدر']}>
        {empSupports.length === 0 ? <EmptyRow colSpan={8} text="لا توجد مباشرات مسجلة" /> :
          empSupports.map((s: any, i: number) => (
            <tr key={i}>
              <td className="px-4 py-2 font-bold">{s.movement_type === 'coverage' ? 'تغطية موقع' : s.movement_type === 'extra' ? 'ورديّة إضافية' : s.movement_type === 'rest_relief' ? 'بديل راحات' : (s.movement_type || s.type || '—')}</td>
              <td className="px-4 py-2 text-xs">{s.home_site || s.homeSite || '—'}</td>
              <td className="px-4 py-2 text-xs">{s.covered_site || s.coveredSite || '—'}</td>
              <td className="px-4 py-2 text-xs num">{s.movement_date || s.date || '—'}</td>
              <td className="px-4 py-2 text-xs num">{s.checkin_time || s.checkIn || '—'}</td>
              <td className="px-4 py-2 text-xs num">{s.checkout_time || s.checkOut || '—'}</td>
              <td className="px-4 py-2 text-xs">{s.note || '—'}</td>
              <td className="px-4 py-2 text-[10px] text-muted-foreground">{s._src}</td>
            </tr>
          ))}
      </Table>
    </div>
  );

  if (tab === 'transfer') return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><Plane className="h-4 w-4 text-navy-900" /> خطابات التحويل والنقل مرتبطة بالرقم {sel.no}.</div>
      <Letters rows={transferLetters} onPreview={onPreview} />
    </div>
  );

  if (tab === 'confirm') return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><Stamp className="h-4 w-4 text-navy-900" /> خطابات تثبيت الحراس مرتبطة بالرقم {sel.no}.</div>
      <Letters rows={confirmLetters} onPreview={onPreview} />
    </div>
  );

  if (tab === 'letters') {
    const official = empDocsAll.filter((x: any) => !ATTACH_TYPES.includes(x.doc_type));
    return (
      <div className="space-y-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-bold text-muted-foreground"><Mail className="h-3.5 w-3.5" /> خطابات التوظيف والأخرى</div>
          <Letters rows={otherLetters} withType onPreview={onPreview} />
        </div>
        <div>
          <div className="mb-1 text-xs font-bold text-muted-foreground">المستندات الرسمية الصادرة من ملف الموظف</div>
          <Table head={['النوع', 'التاريخ', 'الحالة', 'إجراءات']}>
            {official.length === 0 ? <EmptyRow colSpan={4} text="لا توجد مستندات مصدرة" /> :
              official.map((x: any) => (
                <tr key={x.id}>
                  <td className="px-4 py-2 font-bold">{x.doc_type}</td>
                  <td className="px-4 py-2 text-xs">{x.doc_date}</td>
                  <td className="px-4 py-2">{x.verified ? 'مصدق' : 'مصدَّر'}</td>
                  <td className="px-4 py-2"><Btn size="sm" variant="outline" onClick={() => onDocPreview(x)}><Eye className="h-3.5 w-3.5" /> معاينة</Btn></td>
                </tr>
              ))}
          </Table>
        </div>
      </div>
    );
  }

  if (tab === 'visits') return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><ClipboardCheck className="h-4 w-4 text-navy-900" /> نماذج المرور الميداني التي شملت هذا الموظف — مرتبطة بالرقم {sel.no}.</div>
      <Table head={['التاريخ', 'الوردية', 'المشرف الزائر', 'الموقع', 'الحالة', 'المصدر']}>
        {empVisits.length === 0 ? <EmptyRow colSpan={6} text="لا توجد زيارات مسجلة لهذا الموظف" /> :
          empVisits.map((v: any, i: number) => (
            <tr key={i}>
              <td className="px-4 py-2 text-xs num">{v._date || v.visit_date || '—'}</td>
              <td className="px-4 py-2 text-xs">{v._shift || v.shift || '—'}</td>
              <td className="px-4 py-2 text-xs font-bold">{v._sup || v.supervisor_name || '—'}</td>
              <td className="px-4 py-2 text-xs">{v._site || v.site || '—'}</td>
              <td className="px-4 py-2"><StatusBadge value={v._status || v.status || '—'} /></td>
              <td className="px-4 py-2 text-[10px] text-muted-foreground">{v._src}</td>
            </tr>
          ))}
      </Table>
    </div>
  );

  if (tab === 'recruit') return (
    <div>
      <div className="mb-2 rounded-lg border border-sky-200 bg-sky-50 p-2.5 text-xs text-sky-800">
        <b>طلبات التوظيف المرتبطة:</b> تُعرض بالربط إلى الطلب الأصلي (نفس مفاتيح التخزين) دون نسخ للملفات.
      </div>
      <Table head={['رقم الطلب', 'تاريخ الطلب', 'الوظيفة المطلوبة', 'الحالة', 'المرفقات']}>
        {recApps.length === 0 ? <EmptyRow colSpan={5} text="لا يوجد طلب توظيف مرتبط بهذا الموظف" /> :
          recApps.map((r: any) => {
            const atts = parseAttachments(r);
            return (
              <tr key={r.id}>
                <td className="px-4 py-2 font-mono text-xs font-bold text-navy-900">{r.app_no}</td>
                <td className="px-4 py-2 text-xs">{r.app_date}</td>
                <td className="px-4 py-2 text-xs">{r.job_requested}</td>
                <td className="px-4 py-2"><StatusBadge value={r.status} /></td>
                <td className="px-4 py-2">
                  {atts.length === 0 ? <span className="text-xs text-muted-foreground">—</span> : (
                    <div className="space-y-1">
                      {atts.map((a: any, i: number) => (
                        <div key={i} className="flex items-center justify-between gap-2 rounded-md bg-card px-2 py-1 text-[11px] ring-1 ring-border">
                          <span className="truncate"><Paperclip className="ml-1 inline h-3 w-3 text-muted-foreground" /><b>{a.doc_type}</b> — {a.file_name}</span>
                          <span className="flex shrink-0 gap-0.5">
                            <button title="معاينة" onClick={() => onPreview(a.file_key)} className="rounded p-1 hover:bg-muted"><Eye className="h-3.5 w-3.5" /></button>
                            <button title="تنزيل" onClick={() => downloadDoc(a.file_key)} className="rounded p-1 hover:bg-muted"><Download className="h-3.5 w-3.5" /></button>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
      </Table>
      {recApps.length > 0 && <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground"><UserPlus className="h-3.5 w-3.5" /> حُوِّل هذا الموظف من طلب توظيف إلكتروني — السجل الكامل في وحدة «التوظيف والخطابات».</div>}
    </div>
  );

  if (tab === 'docs') return (
    <div>
      {canEdit && (
        <div className="mb-2 flex justify-end"><Btn size="sm" onClick={onAddAttach}><Plus className="h-4 w-4" /> إضافة مرفق/وثيقة</Btn></div>
      )}
      <Table head={['النوع', 'التاريخ', 'الحالة', 'إجراءات']}>
        {empDocsAll.length === 0 ? <EmptyRow colSpan={4} text="لا توجد وثائق" /> :
          empDocsAll.map((x: any) => (
            <tr key={x.id}>
              <td className="px-4 py-2 font-bold">{x.doc_type}</td>
              <td className="px-4 py-2 text-xs">{x.doc_date}</td>
              <td className="px-4 py-2">
                {ATTACH_TYPES.includes(x.doc_type) ? (() => { const st = expiryStatus(x.doc_date); return st ? <StatusBadge value={st.severity === 'danger' ? 'مرفوض' : st.severity === 'warning' ? 'معلق' : 'معتمد'} /> : '—'; })() : (x.verified ? 'مصدق' : 'مصدَّر')}
              </td>
              <td className="px-4 py-2">
                <div className="flex flex-wrap gap-1">
                  {canEdit && ATTACH_TYPES.includes(x.doc_type) ? (() => {
                    let cj: any = {}; try { cj = JSON.parse(x.content_json || '{}'); } catch { cj = {}; }
                    return cj.file_key ? <Btn size="sm" variant="outline" onClick={() => { if (onOcrDoc) onOcrDoc(x); }}><ScanText className="h-3.5 w-3.5" /> مراجعة OCR</Btn> : null;
                  })() : null}
                  {!ATTACH_TYPES.includes(x.doc_type) && <Btn size="sm" variant="outline" onClick={() => onDocPreview(x)}><Eye className="h-3.5 w-3.5" /> معاينة</Btn>}
                  {canEdit && <button title="حذف" onClick={() => onDeleteDoc(x.id)} className="rounded p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>}
                </div>
              </td>
            </tr>
          ))}
      </Table>
    </div>
  );

  if (tab === 'audit') return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><History className="h-4 w-4 text-navy-900" /> كل عملية تمت على بيانات هذا الموظف مرتبطة بالرقم {sel.no}.</div>
      <Table head={['المستخدم', 'العملية', 'الكيان', 'المعرف', 'التفاصيل', 'التاريخ']}>
        {audits.length === 0 ? <EmptyRow colSpan={6} text="لا توجد تعديلات مسجلة" /> :
          audits.map((a: any) => (
            <tr key={a.id}>
              <td className="px-4 py-2 text-xs font-bold">{a.actor || '—'}</td>
              <td className="px-4 py-2 text-xs">{a.action}</td>
              <td className="px-4 py-2 text-[10px] text-muted-foreground">{a.entity}</td>
              <td className="px-4 py-2 text-[10px] num">{a.entity_id || '—'}</td>
              <td className="max-w-56 truncate px-4 py-2 text-xs" title={a.details}>{a.details || '—'}</td>
              <td className="px-4 py-2 text-[10px] num">{String(a.created_at || '').slice(0, 16).replace('T', ' ')}</td>
            </tr>
          ))}
      </Table>
    </div>
  );

  return null;
}