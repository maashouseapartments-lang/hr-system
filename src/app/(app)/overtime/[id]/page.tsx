import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer, CheckCircle2, XCircle, Clock } from "lucide-react";
import { all, get } from "@/lib/db";
import { requireUser, isHR, isGM } from "@/lib/auth";
import { getEmployee, overtimeRates, scheduleFor } from "@/lib/hr";
import { OVERTIME_STATUS } from "@/lib/labels";
import { eventsFor } from "@/lib/workflow";
import { durationLabel, fmtDate, money, time12, toMinutes } from "@/lib/time";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Alert, Avatar, Badge, Card, Field, FileList, PageHeader, StatusBadge, Stepper, Timeline, type FileRow } from "@/components/ui";
import { overtimeStep } from "../actions";

type OT = { id: number; ref_no: string; status: string; work_date: string; start_time: string; end_time: string; reason: string; requested_by_name: string | null; employees_needed: number | null; dept: string | null; loc: string | null; department_id: number | null };

const STAGES = [
  { key: "pending", label: "اعتماد الطلب" },
  { key: "approved", label: "تخصيص الموظفين" },
  { key: "assigned", label: "تأكيد التنفيذ والاحتساب" },
];

export default async function OvertimeDetail({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const id = Number((await params).id);
  const o = get<OT>("SELECT o.*, d.name AS dept, l.name AS loc FROM overtime_requests o LEFT JOIN departments d ON d.id = o.department_id LEFT JOIN locations l ON l.id = o.location_id WHERE o.id = ?", id);
  if (!o) notFound();
  const assignments = all<{ id: number; employee_id: number; full_name: string; photo_file_id: number | null; planned_minutes: number; actual_minutes: number | null; hourly_wage: number; hourly_basic: number; amount: number; attended: number | null }>(
    "SELECT a.*, e.full_name, e.photo_file_id FROM overtime_assignments a JOIN employees e ON e.id = a.employee_id WHERE a.overtime_id = ? ORDER BY e.full_name",
    id,
  );
  const files = all<FileRow>("SELECT * FROM files WHERE entity_type = 'overtime' AND entity_id = ? ORDER BY id DESC", id);
  const hr = isHR(u);
  let mins = toMinutes(o.end_time)! - toMinutes(o.start_time)!;
  if (mins <= 0) mins += 1440;
  const hidden = (op: string) => <><input type="hidden" name="id" value={o.id} /><input type="hidden" name="op" value={op} /><input type="hidden" name="expected" value={o.status} /></>;

  let panel: React.ReactNode = null;
  if (o.status === "pending" && (hr || isGM(u))) {
    panel = (
      <ActionForm action={overtimeStep} className="space-y-4">
        {hidden("approve")}
        <Field label="ملاحظات"><textarea name="note" className="input" /></Field>
        <div className="flex gap-2">
          <SubmitButton name="decision" value="approve"><CheckCircle2 className="size-4" /> الموافقة</SubmitButton>
          <SubmitButton name="decision" value="reject" className="btn-danger"><XCircle className="size-4" /> رفض</SubmitButton>
        </div>
      </ActionForm>
    );
  } else if (o.status === "approved" && hr) {
    const emps = all<{ id: number; full_name: string; dept: string | null; on_leave: number }>(
      `SELECT e.id, e.full_name, d.name AS dept,
              EXISTS (SELECT 1 FROM leave_requests l WHERE l.employee_id = e.id AND l.status NOT IN ('rejected','cancelled') AND ? BETWEEN l.start_date AND l.end_date) AS on_leave
         FROM employees e LEFT JOIN departments d ON d.id = e.department_id WHERE e.status = 'active'
        ORDER BY (e.department_id = ?) DESC, e.full_name`,
      o.work_date,
      o.department_id ?? 0,
    );
    panel = (
      <ActionForm action={overtimeStep} className="space-y-4">
        {hidden("assign")}
        <p className="text-sm text-slate-600">اختر الموظفين حسب الورقة الواردة من القسم{o.employees_needed ? ` (المطلوب: ${o.employees_needed})` : ""}. يظهر الأجر المتوقع لكل موظف عن {durationLabel(mins)}.</p>
        <div className="grid max-h-96 gap-1 overflow-y-auto rounded-xl border border-slate-200 p-2 sm:grid-cols-2">
          {emps.map((x) => {
            const e = getEmployee(x.id)!;
            const r = overtimeRates(e, scheduleFor(e, o.work_date));
            return (
              <label key={x.id} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50 has-[:checked]:bg-brand-50 ${x.on_leave ? "opacity-50" : ""}`}>
                <input type="checkbox" name="employee_ids" value={x.id} disabled={!!x.on_leave} className="accent-brand-600" />
                <span className="flex-1">{x.full_name} <span className="text-xs text-slate-400">{x.dept ?? ""}</span></span>
                {x.on_leave ? <Badge tone="sky">في إجازة</Badge> : <span className="text-xs font-semibold text-brand-700">{money((mins / 60) * r.hourlyOvertime)}</span>}
              </label>
            );
          })}
        </div>
        <Field label="ملاحظات"><input name="note" className="input" /></Field>
        <SubmitButton>تخصيص الموظفين وإبلاغهم</SubmitButton>
      </ActionForm>
    );
  } else if (o.status === "assigned" && hr) {
    panel = (
      <ActionForm action={overtimeStep} className="space-y-4">
        {hidden("complete")}
        <p className="text-sm text-slate-600">أكّد حضور كل موظف وعدد الدقائق الفعلية، ثم اعتمد ليُضاف المبلغ إلى مسير الرواتب.</p>
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {assignments.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-3 p-3">
              <label className="flex flex-1 items-center gap-2 font-semibold"><input type="checkbox" name={`attended_${a.id}`} defaultChecked className="size-4 accent-brand-600" /> {a.full_name}</label>
              <label className="flex items-center gap-2 text-sm">الدقائق الفعلية <input type="number" name={`minutes_${a.id}`} defaultValue={a.planned_minutes} min={0} className="input w-28" /></label>
            </div>
          ))}
        </div>
        <Field label="ملاحظات"><input name="note" className="input" /></Field>
        <SubmitButton>اعتماد التنفيذ واحتساب الأجر الإضافي</SubmitButton>
      </ActionForm>
    );
  }

  const total = assignments.reduce((s, a) => s + (a.amount || 0), 0);
  return (
    <>
      <PageHeader
        back={{ href: "/overtime", label: "العمل الإضافي" }}
        title={<span className="flex items-center gap-3">عمل إضافي <span className="font-mono text-lg text-slate-400">{o.ref_no}</span></span>}
        subtitle={<StatusBadge map={OVERTIME_STATUS} value={o.status} />}
        actions={<Link href={`/overtime/${id}/print`} className="btn-secondary"><Printer className="size-4" /> طباعة التكليف</Link>}
      />
      <Card className="mb-6">{o.status === "rejected" ? <Alert tone="rose">تم رفض الطلب</Alert> : <Stepper steps={STAGES} current={o.status} done={o.status === "completed"} />}</Card>
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {panel && <Card title={<span className="flex items-center gap-2"><Clock className="size-5 text-amber-500" /> المرحلة الحالية</span>} className="ring-2 ring-amber-300">{panel}</Card>}
          <Card title="تفاصيل الطلب">
            <dl className="kv sm:grid-cols-[140px_1fr_140px_1fr]">
              <dt>القسم</dt><dd>{o.dept ?? "—"}</dd>
              <dt>مقدم الطلب</dt><dd>{o.requested_by_name ?? "—"}</dd>
              <dt>التاريخ</dt><dd>{fmtDate(o.work_date)}</dd>
              <dt>الوقت</dt><dd>{time12(o.start_time)} ← {time12(o.end_time)} ({durationLabel(mins)})</dd>
              <dt>الموقع</dt><dd>{o.loc ?? "—"}</dd>
              <dt>العدد المطلوب</dt><dd>{o.employees_needed ?? "—"}</dd>
            </dl>
            <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">{o.reason}</p>
          </Card>
          {assignments.length > 0 && (
            <Card title="الموظفون المكلفون" pad={false}>
              <table className="table">
                <thead><tr><th>الموظف</th><th>أجر الساعة</th><th>الأساسي/ساعة</th><th>المدة</th><th>المبلغ</th><th>الحضور</th></tr></thead>
                <tbody>
                  {assignments.map((a) => (
                    <tr key={a.id}>
                      <td><div className="flex items-center gap-2"><Avatar name={a.full_name} fileId={a.photo_file_id} size={28} />{a.full_name}</div></td>
                      <td>{money(a.hourly_wage)}</td><td>{money(a.hourly_basic)}</td>
                      <td>{durationLabel(a.actual_minutes ?? a.planned_minutes)}</td>
                      <td className="font-bold text-brand-700">{money(a.amount)}</td>
                      <td>{a.attended == null ? "—" : a.attended ? <Badge tone="brand">حضر</Badge> : <Badge tone="rose">لم يحضر</Badge>}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-extrabold"><td colSpan={4}>الإجمالي</td><td colSpan={2}>{money(total)}</td></tr>
                </tbody>
              </table>
            </Card>
          )}
          <Card title="المرفقات">
            <FileList files={files} />
            <ActionForm action={overtimeStep} resetOnSuccess className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
              <input type="hidden" name="id" value={o.id} /><input type="hidden" name="op" value="upload" />
              <select name="category" className="input w-auto"><option value="request_form">طلب القسم</option><option value="signed_copy">نسخة موقعة</option><option value="document">مستند</option></select>
              <input type="file" name="files" multiple accept="application/pdf,image/*" className="input w-auto" required />
              <SubmitButton className="btn-secondary">رفع</SubmitButton>
            </ActionForm>
          </Card>
        </div>
        <Card title="سجل الحركات"><Timeline events={eventsFor("overtime", id)} stageLabel={(s) => OVERTIME_STATUS[s]?.label ?? s} /></Card>
      </div>
    </>
  );
}
