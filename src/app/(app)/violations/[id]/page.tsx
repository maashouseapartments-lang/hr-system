import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer, CheckCircle2, Clock, Scale } from "lucide-react";
import { all, get, getSetting } from "@/lib/db";
import { requireRole, isGM, isHR } from "@/lib/auth";
import { dailyWage, getEmployee, penaltyAmount, penaltyLabel, violationOccurrence } from "@/lib/hr";
import { VIOLATION_STAGES, VIOLATION_STATUS } from "@/lib/labels";
import { eventsFor } from "@/lib/workflow";
import { fmtDate, money } from "@/lib/time";
import { ActionForm, AutoSubmitSelect, SubmitButton } from "@/components/forms";
import { Alert, Avatar, Badge, Card, Field, FileList, PageHeader, StatusBadge, Stepper, Timeline, type FileRow } from "@/components/ui";
import { StatementFields } from "./statement-fields";
import { violationStep } from "../actions";

type V = Record<string, string | number | null> & { id: number; ref_no: string; employee_id: number; status: string; incident_date: string; description: string; violation_type_id: number | null; penalty_code: string | null; deduction_amount: number | null; occurrence: number | null };
type VT = { id: number; code: string; category: string; description: string; penalty1: string; penalty2: string; penalty3: string; penalty4: string };

function Hidden({ v, op }: { v: V; op: string }) {
  return <><input type="hidden" name="id" value={v.id} /><input type="hidden" name="op" value={op} /><input type="hidden" name="expected" value={v.status} /></>;
}

export default async function ViolationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ type?: string }> }) {
  const u = await requireRole("hr", "gm");
  const id = Number((await params).id);
  const sp = await searchParams;
  const v = get<V>("SELECT * FROM violations WHERE id = ?", id);
  if (!v) notFound();
  const e = getEmployee(v.employee_id)!;
  const vt = v.violation_type_id ? get<VT>("SELECT * FROM violation_types WHERE id = ?", v.violation_type_id) : undefined;
  const files = all<FileRow>("SELECT * FROM files WHERE entity_type = 'violation' AND entity_id = ? ORDER BY id DESC", id);
  const events = eventsFor("violation", id);
  const history = all<{ id: number; ref_no: string; incident_date: string; code: string | null; penalty_code: string | null }>(
    `SELECT v.id, v.ref_no, v.incident_date, vt.code, v.penalty_code FROM violations v LEFT JOIN violation_types vt ON vt.id = v.violation_type_id
      WHERE v.employee_id = ? AND v.status = 'applied' AND v.id != ? ORDER BY v.incident_date DESC`,
    v.employee_id,
    id,
  );
  const hr = isHR(u);
  const canAct = (["investigation", "statement", "decision"].includes(v.status) && hr) || (v.status === "approval" && isGM(u));
  const stageLabel = (s: string) => VIOLATION_STAGES.find((x) => x.key === s)?.label ?? VIOLATION_STATUS[s]?.label ?? s;

  let panel: React.ReactNode = null;
  if (canAct && v.status === "investigation") {
    panel = (
      <ActionForm action={violationStep} className="space-y-4">
        <Hidden v={v} op="investigation" />
        <Field label="تحديث الأدلة والقرائن"><textarea name="evidence_notes" className="input" defaultValue={(v.evidence_notes as string) ?? ""} /></Field>
        <Field label="إضافة أدلة"><input type="file" name="files" multiple accept="application/pdf,image/*" className="input" /></Field>
        <Field label="ملاحظات"><input name="note" className="input" /></Field>
        <SubmitButton>اكتمل جمع الأدلة — استدعاء الموظف لسماع إفادته</SubmitButton>
      </ActionForm>
    );
  } else if (canAct && v.status === "statement") {
    panel = (
      <ActionForm action={violationStep} className="space-y-4">
        <Hidden v={v} op="statement" />
        <StatementFields />
        <Field label="ملاحظات المحقق"><input name="note" className="input" /></Field>
        <SubmitButton>حفظ والانتقال لتحديد الجزاء</SubmitButton>
      </ActionForm>
    );
  } else if (canAct && v.status === "decision") {
    const types = all<VT>("SELECT * FROM violation_types WHERE active = 1 ORDER BY category, id");
    const cats = [...new Set(types.map((t) => t.category))];
    const selId = sp.type ? Number(sp.type) : v.violation_type_id;
    const sel = types.find((t) => t.id === selId);
    let preview: React.ReactNode = null;
    if (sel) {
      const occ = violationOccurrence(v.employee_id, sel.id, v.incident_date, v.id);
      const code = [sel.penalty1, sel.penalty2, sel.penalty3, sel.penalty4][occ - 1];
      const daily = dailyWage(e);
      const amount = penaltyAmount(code, daily);
      preview = (
        <div className="space-y-3 rounded-xl border-2 border-amber-200 bg-amber-50 p-4">
          <div className="text-sm text-slate-600">البند {sel.code}: {sel.description}</div>
          <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
            {[sel.penalty1, sel.penalty2, sel.penalty3, sel.penalty4].map((p, i) => (
              <div key={i} className={`rounded-lg p-2 ${i + 1 === occ ? "bg-amber-400 font-bold text-amber-950 ring-2 ring-amber-600" : "bg-white"}`}>
                <div className="text-[11px] opacity-70">المرة {i + 1}</div>{penaltyLabel(p)}
              </div>
            ))}
          </div>
          <div className="text-lg font-extrabold">
            التكرار رقم {occ} خلال {getSetting("violation_repeat_days", "180")} يوماً ← {penaltyLabel(code)}
            {amount > 0 && <span className="text-rose-700"> = {money(amount)}</span>}
          </div>
          <div className="text-xs text-slate-600">أجر اليوم: {money(daily)} • الحد الأقصى للخصم: أجر {getSetting("max_violation_days", "5")} أيام</div>
          {code.startsWith("dismiss") && <Alert tone="rose">هذا الجزاء يتضمن الفصل. تأكد من استيفاء الإجراءات النظامية قبل الاعتماد.</Alert>}
          <ActionForm action={violationStep} className="space-y-3">
            <Hidden v={v} op="decision" />
            <input type="hidden" name="violation_type_id" value={sel.id} />
            {code === "warning_time" && <Field label="مبلغ حسم مدة التأخير/الانصراف" hint="احسبه من سجل الحضور"><input type="number" step="0.01" name="manual_amount" className="input max-w-xs" defaultValue={0} /></Field>}
            <Field label="مسوغات القرار"><textarea name="note" className="input" /></Field>
            <div className="flex flex-wrap gap-2">
              <SubmitButton name="decision" value="apply"><Scale className="size-4" /> رفع القرار للمدير الإداري للاعتماد</SubmitButton>
            </div>
          </ActionForm>
        </div>
      );
    }
    panel = (
      <div className="space-y-4">
        <form>
          <Field label="اختر البند المنطبق من لائحة تنظيم العمل">
            <AutoSubmitSelect name="type" className="input" defaultValue={selId ?? ""}>
              <option value="">— اختر البند —</option>
              {cats.map((c) => (
                <optgroup key={c} label={c}>
                  {types.filter((t) => t.category === c).map((t) => <option key={t.id} value={t.id}>{t.code} — {t.description.slice(0, 110)}</option>)}
                </optgroup>
              ))}
            </AutoSubmitSelect>
          </Field>
        </form>
        {preview}
        <ActionForm action={violationStep} className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <Hidden v={v} op="decision" />
          <input name="note" className="input max-w-sm" placeholder="سبب الحفظ" />
          <SubmitButton name="decision" value="cancel" className="btn-secondary">حفظ التحقيق (لم تثبت المخالفة)</SubmitButton>
        </ActionForm>
      </div>
    );
  } else if (canAct && v.status === "approval") {
    panel = (
      <ActionForm action={violationStep} className="space-y-4">
        <Hidden v={v} op="approval" />
        <div className="rounded-xl bg-amber-50 p-4">
          <div className="font-bold">البند {vt?.code} — المرة {v.occurrence}</div>
          <div className="text-lg font-extrabold">{penaltyLabel(v.penalty_code)} {v.deduction_amount ? `— ${money(v.deduction_amount)}` : ""}</div>
          {v.decision_notes && <div className="mt-1 text-sm">{v.decision_notes}</div>}
        </div>
        <Field label="ملاحظات"><textarea name="note" className="input" /></Field>
        <div className="flex flex-wrap gap-2">
          <SubmitButton name="decision" value="approve"><CheckCircle2 className="size-4" /> اعتماد وتطبيق الجزاء</SubmitButton>
          <SubmitButton name="decision" value="return" className="btn-secondary">إعادة للمراجعة</SubmitButton>
        </div>
      </ActionForm>
    );
  }

  const closed = ["applied", "cancelled"].includes(v.status);
  return (
    <>
      <PageHeader
        back={{ href: "/violations", label: "المخالفات" }}
        title={<span className="flex items-center gap-3">مخالفة <span className="font-mono text-lg text-slate-400">{v.ref_no}</span></span>}
        subtitle={<StatusBadge map={VIOLATION_STATUS} value={v.status} />}
        actions={<Link href={`/violations/${id}/print`} className="btn-secondary"><Printer className="size-4" /> محضر التحقيق والقرار</Link>}
      />
      <Card className="mb-6">
        {v.status === "cancelled" ? <Alert tone="slate">تم حفظ / إلغاء هذه المخالفة</Alert> : <Stepper steps={VIOLATION_STAGES} current={v.status} done={v.status === "applied"} />}
      </Card>
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {!closed && (
            <Card title={<span className="flex items-center gap-2"><Clock className="size-5 text-amber-500" /> {stageLabel(v.status)}</span>} className={canAct ? "ring-2 ring-amber-300" : ""}>
              {panel ?? <p className="text-slate-500">بانتظار إجراء الجهة المختصة.</p>}
            </Card>
          )}
          <Card title="تفاصيل المخالفة">
            <div className="mb-4 flex items-center gap-3">
              <Avatar name={e.full_name} fileId={e.photo_file_id} size={48} />
              <div><Link href={`/employees/${e.id}?tab=violations`} className="text-lg font-bold hover:text-brand-700">{e.full_name}</Link><div className="text-sm text-slate-500">#{e.employee_no}</div></div>
            </div>
            <dl className="kv sm:grid-cols-[150px_1fr_150px_1fr]">
              <dt>التاريخ</dt><dd>{fmtDate(v.incident_date)} {v.incident_time ?? ""}</dd>
              <dt>المكان</dt><dd>{v.incident_place ?? "—"}</dd>
              {vt && <><dt>البند</dt><dd>{vt.code}</dd><dt>التكرار</dt><dd>المرة {v.occurrence}</dd></>}
              {v.penalty_code && <><dt>الجزاء</dt><dd>{penaltyLabel(v.penalty_code)}</dd><dt>مبلغ الخصم</dt><dd className="text-rose-600">{money(v.deduction_amount)}</dd></>}
            </dl>
            <div className="mt-4 space-y-3 text-sm">
              <div><div className="font-bold text-slate-600">الوصف</div><p className="whitespace-pre-wrap leading-7">{v.description}</p></div>
              {v.evidence_notes && <div><div className="font-bold text-slate-600">الأدلة</div><p className="whitespace-pre-wrap leading-7">{v.evidence_notes}</p></div>}
              {v.statement_mode === "given" && <div className="rounded-xl bg-sky-50 p-3"><div className="font-bold">إفادة الموظف ({fmtDate(v.statement_date as string)})</div><p className="whitespace-pre-wrap leading-7">{v.employee_statement}</p></div>}
              {v.statement_mode === "refused" && <div className="rounded-xl bg-amber-50 p-3"><div className="font-bold">رفض الموظف الإفادة/التوقيع</div>الشاهدان: {v.witness1_name} ({v.witness1_id ?? "—"}) و {v.witness2_name} ({v.witness2_id ?? "—"})</div>}
              {v.statement_mode === "absent" && <div className="rounded-xl bg-amber-50 p-3"><div className="font-bold">تغيب الموظف وعدم الرد</div>{v.absence_notes}</div>}
            </div>
          </Card>
          <Card title="الأدلة والمرفقات">
            <FileList files={files} />
            <ActionForm action={violationStep} resetOnSuccess className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
              <input type="hidden" name="id" value={v.id} /><input type="hidden" name="op" value="upload" />
              <select name="category" className="input w-auto"><option value="evidence">دليل</option><option value="signed_copy">نسخة موقعة</option><option value="statement">إفادة</option></select>
              <input name="title" className="input w-48" placeholder="الوصف" />
              <input type="file" name="files" multiple accept="application/pdf,image/*" className="input w-auto" required />
              <SubmitButton className="btn-secondary">رفع</SubmitButton>
            </ActionForm>
          </Card>
          <Card title="سجل المخالفات السابقة المطبقة" pad={false}>
            {history.length ? (
              <table className="table"><tbody>{history.map((h) => (
                <tr key={h.id}><td><Link className="font-bold text-brand-700" href={`/violations/${h.id}`}>{h.ref_no}</Link></td><td>{fmtDate(h.incident_date)}</td><td>{h.code}</td><td><Badge tone="amber">{penaltyLabel(h.penalty_code)}</Badge></td></tr>
              ))}</tbody></table>
            ) : <p className="p-5 text-sm text-slate-500">لا توجد مخالفات سابقة.</p>}
          </Card>
          {hr && !closed && (
            <ActionForm action={violationStep} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={v.id} /><input type="hidden" name="op" value="cancel" />
              <input name="note" className="input max-w-xs" placeholder="سبب الإلغاء" />
              <SubmitButton className="btn-ghost text-rose-600" confirm="إلغاء المخالفة؟">إلغاء المخالفة</SubmitButton>
            </ActionForm>
          )}
        </div>
        <Card title="سجل الحركات"><Timeline events={events} stageLabel={stageLabel} /></Card>
      </div>
    </>
  );
}
