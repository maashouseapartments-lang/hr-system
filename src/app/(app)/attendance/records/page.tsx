import Link from "next/link";
import { redirect } from "next/navigation";
import { all } from "@/lib/db";
import { requireUser, isHR, isStaff } from "@/lib/auth";
import { teamIds } from "@/lib/permissions";
import { today } from "@/lib/hr";
import { ATTENDANCE_STATUS } from "@/lib/labels";
import { durationLabel, fmtDate, money, time12, fromMinutes } from "@/lib/time";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Avatar, Card, Empty, PageHeader, StatusBadge, Stat } from "@/components/ui";
import { UserCheck, Clock, UserX, Wallet } from "lucide-react";
import { markAbsences, editAttendance } from "../actions";

type R = {
  id: number; employee_id: number; full_name: string; employee_no: string; photo_file_id: number | null; work_date: string;
  check_in_minutes: number | null; check_out_minutes: number | null; late_minutes: number; early_leave_minutes: number; worked_minutes: number;
  deduction_amount: number; status: string; loc: string | null; check_in_photo_id: number | null; check_out_photo_id: number | null;
  check_in_distance: number | null; check_in_accuracy: number | null; excuse_note: string | null; check_in_lat: number | null; check_in_lng: number | null;
};

export default async function RecordsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; emp?: string; dept?: string; status?: string }> }) {
  const u = await requireUser();
  const team = teamIds(u);
  if (!isStaff(u) && !team.length) redirect("/attendance");
  const sp = await searchParams;
  const t = today();
  const from = sp.from ?? t;
  const to = sp.to ?? t;
  const where = ["a.work_date BETWEEN ? AND ?"];
  const params: unknown[] = [from, to];
  if (!isStaff(u)) where.push(`a.employee_id IN (${team.join(",")})`);
  if (sp.emp) { where.push("a.employee_id = ?"); params.push(Number(sp.emp)); }
  if (sp.dept) { where.push("e.department_id = ?"); params.push(Number(sp.dept)); }
  if (sp.status) { where.push("a.status = ?"); params.push(sp.status); }
  const rows = all<R>(
    `SELECT a.*, e.full_name, e.employee_no, e.photo_file_id, l.name AS loc FROM attendance a JOIN employees e ON e.id = a.employee_id
       LEFT JOIN locations l ON l.id = a.check_in_location_id WHERE ${where.join(" AND ")} ORDER BY a.work_date DESC, e.full_name`,
    ...params,
  );
  const emps = all<{ id: number; full_name: string }>(`SELECT id, full_name FROM employees WHERE status != 'terminated' ${isStaff(u) ? "" : `AND id IN (${team.join(",")})`} ORDER BY full_name`);
  const depts = all<{ id: number; name: string }>("SELECT id, name FROM departments ORDER BY name");
  const sum = {
    present: rows.filter((r) => r.status === "present").length,
    late: rows.filter((r) => r.status === "late").length,
    absent: rows.filter((r) => r.status === "absent").length,
    ded: rows.reduce((s, r) => s + r.deduction_amount, 0),
  };
  const hr = isHR(u);
  return (
    <>
      <PageHeader title="سجلات الحضور والانصراف" subtitle={from === to ? fmtDate(from) : `${fmtDate(from)} — ${fmtDate(to)}`} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="حاضر بدون تأخير" value={sum.present} icon={<UserCheck className="size-6" />} />
        <Stat label="متأخر" value={sum.late} icon={<Clock className="size-6" />} tone="amber" />
        <Stat label="غائب" value={sum.absent} icon={<UserX className="size-6" />} tone="rose" />
        <Stat label="إجمالي الخصومات" value={<span className="text-lg">{money(sum.ded)}</span>} icon={<Wallet className="size-6" />} tone="violet" />
      </div>
      <Card pad={false}>
        <form className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-4">
          <label><span className="label">من</span><input type="date" name="from" defaultValue={from} className="input" /></label>
          <label><span className="label">إلى</span><input type="date" name="to" defaultValue={to} className="input" /></label>
          <label><span className="label">الموظف</span><select name="emp" defaultValue={sp.emp} className="input"><option value="">الكل</option>{emps.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select></label>
          <label><span className="label">القسم</span><select name="dept" defaultValue={sp.dept} className="input"><option value="">الكل</option>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          <label><span className="label">الحالة</span><select name="status" defaultValue={sp.status} className="input"><option value="">الكل</option>{Object.entries(ATTENDANCE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
          <button className="btn-secondary">عرض</button>
        </form>
        {hr && (
          <ActionForm action={markAbsences} className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/70 p-4 text-sm">
            <span className="font-semibold">احتساب الغياب لمن لم يسجل حضوراً وليس في إجازة، ليوم:</span>
            <input type="date" name="date" defaultValue={t} className="input w-auto" />
            <SubmitButton className="btn-secondary btn-sm" confirm="سيتم تسجيل غياب وخصم أجر يوم لكل من لم يسجل حضوراً في هذا اليوم. متابعة؟">احتساب الغياب</SubmitButton>
          </ActionForm>
        )}
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>الموظف</th><th>التاريخ</th><th>الحضور</th><th>الانصراف</th><th>الموقع</th><th>العمل</th><th>تأخير</th><th>مبكر</th><th>الخصم</th><th>الحالة</th><th>الصور</th>{hr && <th />}</tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><Link href={`/employees/${r.employee_id}?tab=attendance`} className="flex items-center gap-2 font-bold hover:text-brand-700"><Avatar name={r.full_name} fileId={r.photo_file_id} size={30} />{r.full_name}</Link></td>
                    <td className="whitespace-nowrap">{fmtDate(r.work_date)}</td>
                    <td>{time12(r.check_in_minutes)}</td>
                    <td>{time12(r.check_out_minutes)}</td>
                    <td className="text-xs">
                      {r.loc ?? "—"}
                      {r.check_in_distance != null && <div className="text-slate-400">{Math.round(r.check_in_distance)} م ±{Math.round(r.check_in_accuracy ?? 0)}</div>}
                    </td>
                    <td>{durationLabel(r.worked_minutes)}</td>
                    <td className={r.late_minutes ? "font-bold text-amber-700" : "text-slate-400"}>{r.late_minutes}</td>
                    <td className={r.early_leave_minutes ? "font-bold text-amber-700" : "text-slate-400"}>{r.early_leave_minutes}</td>
                    <td className={r.deduction_amount ? "font-semibold text-rose-600" : "text-slate-400"}>{money(r.deduction_amount)}</td>
                    <td>
                      <StatusBadge map={ATTENDANCE_STATUS} value={r.status} />
                      {r.excuse_note && <div className="mt-1 max-w-40 text-[11px] text-slate-500">{r.excuse_note}</div>}
                    </td>
                    <td>
                      <div className="flex gap-1">
                        {r.check_in_photo_id && <a href={`/api/files/${r.check_in_photo_id}`} target="_blank" title="صورة الحضور"><Avatar name="د" fileId={r.check_in_photo_id} size={32} /></a>}
                        {r.check_out_photo_id && <a href={`/api/files/${r.check_out_photo_id}`} target="_blank" title="صورة الانصراف"><Avatar name="خ" fileId={r.check_out_photo_id} size={32} /></a>}
                      </div>
                    </td>
                    {hr && (
                      <td>
                        <details className="relative">
                          <summary className="btn-ghost btn-sm cursor-pointer list-none">تعديل</summary>
                          <div className="absolute end-0 z-10 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                            <ActionForm action={editAttendance} className="space-y-3">
                              <input type="hidden" name="id" value={r.id} />
                              <label className="block"><span className="label">وقت الحضور</span><input type="time" name="check_in" defaultValue={r.check_in_minutes != null ? fromMinutes(r.check_in_minutes) : ""} className="input" /></label>
                              <label className="block"><span className="label">وقت الانصراف</span><input type="time" name="check_out" defaultValue={r.check_out_minutes != null ? fromMinutes(r.check_out_minutes) : ""} className="input" /></label>
                              <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="excuse" className="accent-brand-600" /> عذر مقبول (إلغاء الخصم)</label>
                              <input name="note" className="input" placeholder="سبب التعديل" required />
                              <SubmitButton className="btn-primary btn-sm w-full">حفظ</SubmitButton>
                            </ActionForm>
                          </div>
                        </details>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty title="لا توجد سجلات في هذه الفترة" />}
      </Card>
    </>
  );
}
