import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Printer, CheckCircle2, XCircle, Clock } from "lucide-react";
import { all, get } from "@/lib/db";
import { requireUser, isHR, type SessionUser } from "@/lib/auth";
import { canActLeave, clearanceDeptsFor, leaveCtx, canViewEmployee } from "@/lib/permissions";
import { annualEligibility, getEmployee, type Eligibility } from "@/lib/hr";
import { clearanceRows, draftSettlement, getLeave, getLeaveType, stagesFor, type Leave, type SettlementLine } from "@/lib/leave";
import { EXTRA_STAGE_LABELS, LEAVE_STAGES, LEAVE_STATUS } from "@/lib/labels";
import { eventsFor } from "@/lib/workflow";
import { fmtDate, fmtDateTime, money, num } from "@/lib/time";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Alert, Avatar, Badge, Card, Field, FileList, PageHeader, StatusBadge, Stepper, Timeline, type FileRow } from "@/components/ui";
import { SettlementEditor } from "./settlement-editor";
import { leaveStep } from "../actions";

const stageLabel = (s: string) => LEAVE_STAGES.find((x) => x.key === s)?.short ?? LEAVE_STATUS[s]?.label ?? EXTRA_STAGE_LABELS[s] ?? s;

function Hidden({ l, op }: { l: Leave; op: string }) {
  return (
    <>
      <input type="hidden" name="id" value={l.id} />
      <input type="hidden" name="op" value={op} />
      <input type="hidden" name="expected" value={l.status} />
    </>
  );
}

function ApproveReject({ l, op, approveLabel = "موافقة", rejectable = true }: { l: Leave; op: string; approveLabel?: string; rejectable?: boolean }) {
  return (
    <ActionForm action={leaveStep} className="space-y-4">
      <Hidden l={l} op={op} />
      <Field label="ملاحظات / سبب الرفض"><textarea name="note" className="input" /></Field>
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="decision" value="approve"><CheckCircle2 className="size-4" /> {approveLabel}</SubmitButton>
        {rejectable && <SubmitButton name="decision" value="reject" className="btn-danger" confirm="تأكيد رفض الطلب؟"><XCircle className="size-4" /> رفض</SubmitButton>}
      </div>
    </ActionForm>
  );
}

function EligibilityBox({ el }: { el: Eligibility }) {
  return (
    <div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
      <div><div className="text-slate-500">مدة الخدمة</div><div className="font-bold">{num(el.serviceYears, 2)} سنة</div></div>
      <div><div className="text-slate-500">الاستحقاق السنوي</div><div className="font-bold">{el.entitlementPerYear} يوماً {el.entitlementPerYear === 30 ? "(أكثر من 5 سنوات)" : "(أقل من 5 سنوات)"}</div></div>
      <div><div className="text-slate-500">الرصيد المتاح</div><div className={`text-lg font-extrabold ${el.balance < 0 ? "text-rose-600" : "text-brand-700"}`}>{num(el.balance, 1)} يوم</div></div>
      <div><div className="text-slate-500">آخر إجازة سنوية</div><div className="font-bold">{el.lastLeaveReturn ? fmtDate(el.lastLeaveReturn) : "لم يأخذ"} ({num(el.daysSinceLastLeave)} يوم)</div></div>
      {!el.completedFirstYear && <div className="sm:col-span-2 lg:col-span-4"><Alert tone="amber">الموظف لم يُكمل السنة الأولى من خدمته بعد — الاستحقاق 21 يوماً بعد إكمال العام.</Alert></div>}
      {el.yearPassedSinceLastLeave && <div className="sm:col-span-2 lg:col-span-4"><Alert tone="brand">تجاوز سنة كاملة منذ آخر إجازة سنوية.</Alert></div>}
      {el.exceedsBalance && <div className="sm:col-span-2 lg:col-span-4"><Alert tone="rose">الأيام المطلوبة ({el.requestedDays}) تتجاوز الرصيد المتاح.</Alert></div>}
    </div>
  );
}

function ActionPanel({ l, u }: { l: Leave; u: SessionUser }) {
  const e = getEmployee(l.employee_id)!;
  switch (l.status) {
    case "hr_review": {
      const types = all<{ id: number; name: string; legal_reference: string | null }>("SELECT * FROM leave_types WHERE active = 1 ORDER BY id");
      const el = annualEligibility(e, l.start_date, l.id);
      return (
        <ActionForm action={leaveStep} className="space-y-4">
          <Hidden l={l} op="hr_review" />
          <h3 className="font-bold">بيانات الاستحقاق (محسوبة تلقائياً حتى تاريخ بداية الإجازة)</h3>
          <EligibilityBox el={{ ...el, requestedDays: l.days, exceedsBalance: l.days > el.balance }} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="نوع الإجازة *">
              <select name="leave_type_id" className="input" defaultValue={l.leave_type_id ?? ""} required>
                {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="من *"><input type="date" name="start_date" defaultValue={l.start_date} className="input" required /></Field>
            <Field label="إلى *"><input type="date" name="end_date" defaultValue={l.end_date} className="input" required /></Field>
          </div>
          <div className="flex flex-wrap gap-6 text-sm font-semibold">
            <label className="flex items-center gap-2"><input type="checkbox" name="needs_visa" defaultChecked={!!l.needs_visa} className="size-4 accent-brand-600" /> يحتاج تأشيرة خروج وعودة</label>
            <label className="flex items-center gap-2 text-rose-700"><input type="checkbox" name="override" className="size-4 accent-rose-600" /> اعتماد رغم تجاوز الرصيد</label>
          </div>
          <Field label="ملاحظات الموارد البشرية"><textarea name="note" className="input" /></Field>
          <div className="flex flex-wrap gap-2">
            <SubmitButton name="decision" value="approve"><CheckCircle2 className="size-4" /> إصدار الطلب ورفعه للموافقات</SubmitButton>
            <SubmitButton name="decision" value="reject" className="btn-danger" confirm="رفض الطلب؟"><XCircle className="size-4" /> رفض</SubmitButton>
          </div>
        </ActionForm>
      );
    }
    case "direct_manager":
    case "dept_manager":
      return <ApproveReject l={l} op="approve" approveLabel="الموافقة على الإجازة" />;
    case "substitute": {
      const emps = all<{ id: number; full_name: string; position: string | null }>(
        `SELECT e.id, e.full_name, p.title AS position FROM employees e LEFT JOIN positions p ON p.id = e.position_id
          WHERE e.status = 'active' AND e.id != ? ORDER BY (e.department_id = ?) DESC, e.full_name`,
        e.id,
        e.department_id ?? 0,
      );
      return (
        <ActionForm action={leaveStep} className="space-y-4">
          <Hidden l={l} op="substitute" />
          <Field label="الموظف البديل *" hint="يظهر أولاً موظفو نفس القسم">
            <select name="substitute_employee_id" className="input" required defaultValue="">
              <option value="" disabled>— اختر —</option>
              {emps.map((x) => <option key={x.id} value={x.id}>{x.full_name}{x.position ? ` — ${x.position}` : ""}</option>)}
            </select>
          </Field>
          <Field label="المهام المسلّمة للبديل"><textarea name="note" className="input" /></Field>
          <SubmitButton>تعيين البديل {getLeaveType(l.leave_type_id)?.full_cycle ? "وإصدار إخلاء الطرف" : "وإكمال الطلب"}</SubmitButton>
        </ActionForm>
      );
    }
    case "clearance": {
      const rows = clearanceRows(l.id).filter((r) => r.status !== "cleared");
      const mine = isHR(u) ? rows.map((r) => r.department_id) : clearanceDeptsFor(u, l.id);
      const signable = rows.filter((r) => mine.includes(r.department_id));
      if (!signable.length) return <Alert tone="sky">بانتظار توقيع بقية الأقسام.</Alert>;
      return (
        <div className="space-y-4">
          {signable.map((r) => (
            <ActionForm key={r.id} action={leaveStep} className="rounded-xl border border-slate-200 p-4">
              <Hidden l={l} op="clearance" />
              <input type="hidden" name="department_id" value={r.department_id} />
              <div className="mb-3 font-bold">قسم {r.dept} {isHR(u) && r.head_name && <span className="text-xs font-normal text-slate-500">(المسؤول: {r.head_name})</span>}</div>
              {r.clearance_items && <div className="mb-3 text-sm text-slate-600">العهد المعتادة: {r.clearance_items}</div>}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="العهد المستلمة"><input name="items" className="input" defaultValue={r.items ?? ""} /></Field>
                <Field label="ملاحظات"><input name="note" className="input" /></Field>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <SubmitButton name="status" value="cleared" className="btn-primary btn-sm"><CheckCircle2 className="size-4" /> تم استلام العهد — توقيع</SubmitButton>
                <SubmitButton name="status" value="has_custody" className="btn-secondary btn-sm">توجد عهدة لم تُسلّم</SubmitButton>
              </div>
            </ActionForm>
          ))}
        </div>
      );
    }
    case "gm_signature":
      return <ApproveReject l={l} op="gm_signature" approveLabel="توقيع واعتماد الطلب" />;
    case "settlement": {
      const lines: SettlementLine[] = l.settlement_json ? JSON.parse(l.settlement_json) : draftSettlement(l);
      return (
        <ActionForm action={leaveStep} className="space-y-4">
          <Hidden l={l} op="settlement" />
          <Alert tone="sky">بنود مقترحة محسوبة من الراتب والحضور والمخالفات والعمل الإضافي. راجعها وعدّلها حسب الحاجة.</Alert>
          <SettlementEditor initial={lines} />
          <Field label="ملاحظات"><textarea name="note" className="input" /></Field>
          <div className="flex flex-wrap gap-2">
            <SubmitButton name="submit" value="send">رفع التسوية للمدير الإداري</SubmitButton>
            <SubmitButton name="submit" value="draft" className="btn-secondary">حفظ مسودة</SubmitButton>
          </div>
        </ActionForm>
      );
    }
    case "settlement_gm":
      return (
        <ActionForm action={leaveStep} className="space-y-4">
          <Hidden l={l} op="settlement_gm" />
          <SettlementView l={l} />
          <Field label="ملاحظات"><textarea name="note" className="input" /></Field>
          <div className="flex flex-wrap gap-2">
            <SubmitButton name="decision" value="approve"><CheckCircle2 className="size-4" /> اعتماد التسوية</SubmitButton>
            <SubmitButton name="decision" value="return" className="btn-secondary">إعادة للموارد البشرية للتعديل</SubmitButton>
          </div>
        </ActionForm>
      );
    case "employee_sign": {
      const self = u.employee_id === l.employee_id;
      return (
        <ActionForm action={leaveStep} className="space-y-4">
          <Hidden l={l} op="employee_sign" />
          <SettlementView l={l} />
          <Link href={`/leaves/${l.id}/print?doc=settlement`} target="_blank" className="btn-secondary btn-sm"><Printer className="size-4" /> طباعة التسوية للتوقيع</Link>
          {!self && <Field label="نسخة التسوية موقعة من الموظف *" hint="اطبع التسوية، وقّعها مع الموظف، ثم ارفع الصورة أو PDF"><input type="file" name="signed_copy" accept="application/pdf,image/*" className="input" /></Field>}
          <label className="flex items-start gap-2 text-sm font-semibold">
            <input type="checkbox" name="ack" className="mt-1 size-4 accent-brand-600" required />
            {self ? "أقر بأنني اطلعت على تسوية المستحقات وأوافق عليها" : "أقر بأن الموظف اطلع على التسوية ووقّعها"}
          </label>
          <SubmitButton>{self ? "توقيع إلكتروني" : "تسجيل توقيع الموظف"}</SubmitButton>
        </ActionForm>
      );
    }
    case "visa":
      return (
        <ActionForm action={leaveStep} className="space-y-4">
          <Hidden l={l} op="visa" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="رقم التأشيرة *"><input name="visa_number" className="input" dir="ltr" required /></Field>
            <Field label="نوع التأشيرة">
              <select name="visa_type" className="input"><option>خروج وعودة مفردة</option><option>خروج وعودة متعددة</option><option>خروج نهائي</option></select>
            </Field>
            <Field label="تاريخ الإصدار"><input type="date" name="visa_issue_date" className="input" /></Field>
            <Field label="تاريخ الانتهاء"><input type="date" name="visa_expiry_date" className="input" /></Field>
          </div>
          <Field label="صورة التأشيرة"><input type="file" name="visa_file" accept="application/pdf,image/*" className="input" /></Field>
          <Field label="ملاحظات"><input name="note" className="input" /></Field>
          <SubmitButton>حفظ التأشيرة وإرسال التسوية للمالية</SubmitButton>
        </ActionForm>
      );
    case "finance":
      return (
        <ActionForm action={leaveStep} className="space-y-4">
          <Hidden l={l} op="finance" />
          <SettlementView l={l} />
          <div className="rounded-xl bg-slate-50 p-4 text-sm">
            التحويل إلى: <b>{e.full_name}</b> — {e.bank_name ?? "البنك غير محدد"} — <span dir="ltr" className="font-mono">{e.iban ?? "لا يوجد آيبان"}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="رقم الحوالة / المرجع *"><input name="transfer_reference" className="input" dir="ltr" required /></Field>
            <Field label="تاريخ التحويل"><input type="date" name="transfer_date" className="input" /></Field>
          </div>
          <Field label="إيصال التحويل *"><input type="file" name="receipt" accept="application/pdf,image/*" className="input" required /></Field>
          <Field label="ملاحظات"><input name="note" className="input" /></Field>
          <SubmitButton>تأكيد التحويل وإرسال الإيصال للموارد البشرية</SubmitButton>
        </ActionForm>
      );
    case "hr_archive":
      return (
        <ActionForm action={leaveStep} className="space-y-4">
          <Hidden l={l} op="hr_archive" />
          <Alert tone="sky">تأكد من استلام إيصال التحويل، واطبع النماذج (الطلب، إخلاء الطرف، التسوية) للحفظ الورقي، وارفع النسخ الموقعة هنا.</Alert>
          <Field label="النسخ الورقية الموقعة (اختياري)"><input type="file" name="files" multiple accept="application/pdf,image/*" className="input" /></Field>
          <Field label="ملاحظات"><input name="note" className="input" /></Field>
          <SubmitButton>أرشفة الملف وإغلاق الطلب</SubmitButton>
        </ActionForm>
      );
    default:
      return null;
  }
}

function SettlementView({ l }: { l: Leave }) {
  if (!l.settlement_json) return null;
  const lines: SettlementLine[] = JSON.parse(l.settlement_json);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <table className="table">
        <thead><tr><th>البند</th><th>استحقاق</th><th>خصم</th></tr></thead>
        <tbody>
          {lines.map((x, i) => (
            <tr key={i}><td>{x.label}</td><td className="text-brand-700">{x.kind === "addition" ? money(x.amount) : ""}</td><td className="text-rose-600">{x.kind === "deduction" ? money(x.amount) : ""}</td></tr>
          ))}
          <tr className="bg-slate-50 font-extrabold"><td>صافي المستحقات</td><td colSpan={2} className="text-lg">{money(l.settlement_total)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

export default async function LeavePage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const id = Number((await params).id);
  const l = getLeave(id);
  const ctx = leaveCtx(id);
  if (!l || !ctx) notFound();
  const canAct = canActLeave(u, ctx);
  if (!canViewEmployee(u, l.employee_id) && !canAct) redirect("/leaves");
  const e = getEmployee(l.employee_id)!;
  const lt = getLeaveType(l.leave_type_id);
  const stages = stagesFor(l);
  const events = eventsFor("leave", id);
  const files = all<FileRow>("SELECT * FROM files WHERE entity_type = 'leave' AND entity_id = ? ORDER BY id DESC", id);
  const clearance = clearanceRows(id);
  const sub = l.substitute_employee_id ? getEmployee(l.substitute_employee_id) : undefined;
  const elig: Eligibility | null = l.eligibility_snapshot ? JSON.parse(l.eligibility_snapshot) : null;
  const dept = get<{ name: string }>("SELECT name FROM departments WHERE id = ?", e.department_id ?? 0)?.name;
  const closed = ["completed", "rejected", "cancelled"].includes(l.status);
  const hr = isHR(u);

  return (
    <>
      <PageHeader
        back={{ href: "/leaves", label: "الإجازات" }}
        title={<span className="flex flex-wrap items-center gap-3">{lt?.name ?? "طلب إجازة"} <span className="font-mono text-lg text-slate-400">{l.ref_no}</span></span>}
        subtitle={<StatusBadge map={LEAVE_STATUS} value={l.status} />}
        actions={
          <>
            <Link href={`/leaves/${id}/print?doc=request`} className="btn-secondary"><Printer className="size-4" /> نموذج الطلب</Link>
            {clearance.length > 0 && <Link href={`/leaves/${id}/print?doc=clearance`} className="btn-secondary"><Printer className="size-4" /> إخلاء الطرف</Link>}
            {l.settlement_json && <Link href={`/leaves/${id}/print?doc=settlement`} className="btn-secondary"><Printer className="size-4" /> التسوية</Link>}
          </>
        }
      />

      <Card className="mb-6">
        {l.status === "rejected" || l.status === "cancelled" ? (
          <Alert tone={l.status === "rejected" ? "rose" : "slate"}>{l.status === "rejected" ? "تم رفض هذا الطلب" : "تم إلغاء هذا الطلب"}</Alert>
        ) : (
          <Stepper steps={stages} current={l.status} done={l.status === "completed"} />
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {!closed && (
            <Card title={<span className="flex items-center gap-2"><Clock className="size-5 text-amber-500" /> المرحلة الحالية: {stageLabel(l.status)}</span>} className={canAct ? "ring-2 ring-amber-300" : ""}>
              {canAct ? <ActionPanel l={l} u={u} /> : <p className="text-slate-500">بانتظار إجراء الجهة المختصة. ستصلك الإشعارات عند أي تحديث.</p>}
            </Card>
          )}

          <Card title="تفاصيل الطلب">
            <div className="mb-5 flex items-center gap-3">
              <Avatar name={e.full_name} fileId={e.photo_file_id} size={52} />
              <div>
                <Link href={`/employees/${e.id}`} className="text-lg font-bold hover:text-brand-700">{e.full_name}</Link>
                <div className="text-sm text-slate-500">#{e.employee_no} • {dept ?? "—"}</div>
              </div>
            </div>
            <dl className="kv sm:grid-cols-[160px_1fr_160px_1fr]">
              <dt>نوع الإجازة</dt><dd>{lt?.name ?? "—"} {lt && !lt.paid && <Badge tone="amber">بدون أجر</Badge>}</dd>
              <dt>عدد الأيام</dt><dd>{l.days} يوم</dd>
              <dt>من</dt><dd>{fmtDate(l.start_date)}</dd>
              <dt>إلى</dt><dd>{fmtDate(l.end_date)}</dd>
              <dt>تاريخ العودة المتوقع</dt><dd>{fmtDate(l.return_date)}</dd>
              <dt>المباشرة الفعلية</dt><dd>{fmtDate(l.actual_return_date)}</dd>
              <dt>الوجهة</dt><dd>{l.destination ?? "—"}</dd>
              <dt>التأشيرة</dt><dd>{l.needs_visa ? (l.visa_number ? `${l.visa_type ?? ""} رقم ${l.visa_number}` : "مطلوبة") : "لا يحتاج"}</dd>
              <dt>البديل</dt><dd>{sub?.full_name ?? "—"}</dd>
              <dt>تاريخ التقديم</dt><dd>{fmtDateTime(l.created_at)}</dd>
              {l.transfer_reference && <><dt>الحوالة</dt><dd>{l.transfer_reference} ({fmtDate(l.transfer_date)})</dd></>}
              {l.settlement_total != null && <><dt>صافي التسوية</dt><dd className="text-brand-700">{money(l.settlement_total)}</dd></>}
            </dl>
            {l.reason && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">{l.reason}</p>}
            {elig && <div className="mt-5"><h4 className="mb-2 text-sm font-bold text-slate-600">الاستحقاق عند المراجعة</h4><EligibilityBox el={elig} /></div>}
          </Card>

          {clearance.length > 0 && (
            <Card title="نموذج إخلاء الطرف (تسليم العهد)" pad={false}>
              <table className="table">
                <thead><tr><th>القسم</th><th>المسؤول</th><th>العهد</th><th>الحالة</th><th>التوقيع</th></tr></thead>
                <tbody>{clearance.map((c) => (
                  <tr key={c.id}>
                    <td className="font-bold">{c.dept}</td><td>{c.head_name ?? "—"}</td><td className="text-sm">{c.items ?? "—"}{c.notes && <div className="text-xs text-slate-500">{c.notes}</div>}</td>
                    <td>{c.status === "cleared" ? <Badge tone="brand">تم الاستلام</Badge> : c.status === "has_custody" ? <Badge tone="rose">عهدة لم تُسلّم</Badge> : <Badge tone="amber">بانتظار التوقيع</Badge>}</td>
                    <td className="text-xs">{c.signed_by_name ? <>{c.signed_by_name}<div className="text-slate-400">{fmtDateTime(c.signed_at)}</div></> : "—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </Card>
          )}

          {l.settlement_json && !["settlement_gm", "employee_sign", "finance"].includes(l.status) && (
            <Card title="تسوية المستحقات"><SettlementView l={l} /></Card>
          )}

          <Card title="المرفقات والنسخ الإلكترونية">
            <FileList files={files} />
            <ActionForm action={leaveStep} resetOnSuccess className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
              <input type="hidden" name="id" value={l.id} /><input type="hidden" name="op" value="upload" />
              <select name="category" className="input w-auto"><option value="signed_copy">نسخة موقعة</option><option value="request_form">نموذج الطلب</option><option value="document">مستند آخر</option></select>
              <input name="title" className="input w-48" placeholder="وصف المستند" />
              <input type="file" name="files" multiple accept="application/pdf,image/*" className="input w-auto" required />
              <SubmitButton className="btn-secondary">رفع</SubmitButton>
            </ActionForm>
          </Card>

          {(hr || (u.employee_id === l.employee_id && l.status === "hr_review")) && !closed && (
            <ActionForm action={leaveStep} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={l.id} /><input type="hidden" name="op" value="cancel" />
              <input name="note" className="input max-w-xs" placeholder="سبب الإلغاء" />
              <SubmitButton className="btn-ghost text-rose-600" confirm="إلغاء الطلب نهائياً؟">إلغاء الطلب</SubmitButton>
            </ActionForm>
          )}
          {hr && l.status === "completed" && !l.actual_return_date && (
            <Card title="تسجيل مباشرة الموظف بعد الإجازة">
              <ActionForm action={leaveStep} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={l.id} /><input type="hidden" name="op" value="return" />
                <Field label="تاريخ المباشرة"><input type="date" name="actual_return_date" className="input" required defaultValue={l.return_date ?? ""} /></Field>
                <input name="note" className="input max-w-xs" placeholder="ملاحظات" />
                <SubmitButton className="btn-secondary">تسجيل المباشرة</SubmitButton>
              </ActionForm>
            </Card>
          )}
        </div>

        <Card title="سجل الحركات">
          <Timeline events={events} stageLabel={stageLabel} />
        </Card>
      </div>
    </>
  );
}
