import Link from "next/link";
import { Plus, Pencil, Trash2, Star } from "lucide-react";
import { all, get } from "@/lib/db";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ScheduleFields } from "@/components/company-fields";
import { Badge, Card, PageHeader, Alert, Field } from "@/components/ui";
import { WEEK_DAYS } from "@/lib/labels";
import { time12, durationLabel, fmtDate } from "@/lib/time";
import { scheduledMinutes, type Schedule } from "@/lib/hr";
import { saveSchedule, deleteSchedule } from "../actions";

export default async function SchedulesPage({ searchParams }: { searchParams: Promise<{ edit?: string; new?: string }> }) {
  const sp = await searchParams;
  const schedules = all<Schedule & { notes: string | null; emp_count: number }>(
    "SELECT s.*, (SELECT COUNT(*) FROM employees e WHERE e.schedule_id = s.id) AS emp_count FROM schedules s ORDER BY is_default DESC, id",
  );
  const editing = sp.edit ? get<Schedule & { notes: string | null }>("SELECT * FROM schedules WHERE id = ?", Number(sp.edit)) : undefined;
  const showForm = !!editing || !!sp.new;
  const employees = showForm ? all<{ id: number; full_name: string; employee_no: string; schedule_id: number | null }>(
    "SELECT id, full_name, employee_no, schedule_id FROM employees WHERE status != 'terminated' ORDER BY full_name") : [];

  return (
    <>
      <PageHeader
        title="مواعيد العمل"
        subtitle="الدوام الرسمي والدوامات الخاصة (رمضان، الورديات، الدوام المرن)"
        actions={!showForm && <Link href="?new=1" className="btn-primary"><Plus className="size-4" /> إضافة دوام</Link>}
      />
      {showForm ? (
        <Card title={editing ? `تعديل: ${editing.name}` : "دوام جديد"}>
          <ActionForm action={saveSchedule} className="space-y-6">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <ScheduleFields s={editing} />
            <Field label="ملاحظات">
              <input name="notes" className="input" defaultValue={editing?.notes ?? ""} />
            </Field>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" name="is_default" defaultChecked={!!editing?.is_default} className="size-4 accent-brand-600" />
              الدوام الافتراضي لكل الموظفين غير المخصصين لدوام آخر
            </label>
            {employees.length > 0 && (
              <div>
                <span className="label">تخصيص موظفين لهذا الدوام (اختياري)</span>
                <div className="grid max-h-64 gap-1 overflow-y-auto rounded-xl border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-3">
                  {employees.map((e) => (
                    <label key={e.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                      <input type="checkbox" name="employee_ids" value={e.id} defaultChecked={!!editing && e.schedule_id === editing.id} className="accent-brand-600" />
                      {e.full_name} <span className="text-xs text-slate-400">({e.employee_no})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <SubmitButton>حفظ الدوام</SubmitButton>
              <Link href="/settings/schedules" className="btn-secondary">إلغاء</Link>
            </div>
          </ActionForm>
        </Card>
      ) : (
        <div className="space-y-4">
          <Alert tone="sky">
            التأخير يُحتسب بالدقيقة <b>بعد انتهاء فترة السماح</b>. الخروج المتأخر لا يُحتسب عملاً إضافياً؛
            العمل الإضافي يكون فقط بطلب معتمد من صفحة «العمل الإضافي».
          </Alert>
          <div className="grid gap-4 lg:grid-cols-2">
            {schedules.map((s) => (
              <div key={s.id} className="card p-5">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 text-lg font-bold">
                      {s.name} {!!s.is_default && <Badge tone="brand"><Star className="size-3" /> افتراضي</Badge>}
                    </div>
                    <div className="text-sm text-slate-500">
                      {s.emp_count} موظف مخصص
                      {(s.effective_from || s.effective_to) && ` • يسري ${s.effective_from ? `من ${fmtDate(s.effective_from)}` : ""} ${s.effective_to ? `إلى ${fmtDate(s.effective_to)}` : ""}`}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Link href={`?edit=${s.id}`} className="btn-ghost btn-sm"><Pencil className="size-4" /></Link>
                    {!s.is_default && (
                      <form action={deleteSchedule}>
                        <input type="hidden" name="id" value={s.id} />
                        <button className="btn-ghost btn-sm text-rose-600"><Trash2 className="size-4" /></button>
                      </form>
                    )}
                  </div>
                </div>
                <dl className="kv">
                  <dt>الدوام</dt><dd>{time12(s.start_time)} ← {time12(s.end_time)}</dd>
                  <dt>الاستراحة</dt><dd>{s.break_start ? `${time12(s.break_start)} ← ${time12(s.break_end)}` : "—"}</dd>
                  <dt>فترة السماح</dt><dd>{s.grace_minutes} دقيقة (التأخير يبدأ بعد {time12(Number(s.start_time.split(":")[0]) * 60 + Number(s.start_time.split(":")[1]) + s.grace_minutes)})</dd>
                  <dt>ساعات العمل الفعلية</dt><dd>{durationLabel(scheduledMinutes(s))}</dd>
                  <dt>أيام العمل</dt><dd>{s.work_days.split(",").map((d) => WEEK_DAYS[Number(d)]).join("، ")}</dd>
                </dl>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
