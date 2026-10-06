import { all, get, getSetting } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { companyTz, getEmployee, isWorkDay, scheduleFor } from "@/lib/hr";
import { nowInTz, time12, durationLabel, fmtDate } from "@/lib/time";
import { ATTENDANCE_STATUS } from "@/lib/labels";
import { Alert, Card, Empty, PageHeader, StatusBadge } from "@/components/ui";
import { PunchClient } from "./punch-client";

export const metadata = { title: "تسجيل الحضور" };

export default async function AttendancePage() {
  const u = await requireUser();
  if (!u.employee_id)
    return (
      <>
        <PageHeader title="تسجيل الحضور والانصراف" />
        <Card><Empty title="حسابك غير مرتبط بملف موظف">تسجيل الحضور متاح للموظفين فقط. اربط حسابك بملفك الوظيفي من صفحة المستخدمين.</Empty></Card>
      </>
    );
  const e = getEmployee(u.employee_id)!;
  const tz = companyTz();
  const now = nowInTz(tz);
  const s = scheduleFor(e, now.date);
  const rec = get<{ check_in_minutes: number | null; check_out_minutes: number | null; late_minutes: number; early_leave_minutes: number; worked_minutes: number; status: string }>(
    "SELECT * FROM attendance WHERE employee_id = ? AND work_date = ?",
    e.id,
    now.date,
  );
  const assigned = all<{ id: number; name: string; latitude: number; longitude: number; radius_m: number }>(
    "SELECT l.id, l.name, l.latitude, l.longitude, l.radius_m FROM locations l JOIN employee_locations el ON el.location_id = l.id WHERE el.employee_id = ? AND l.active = 1",
    e.id,
  );
  const hasAssignments = !!get("SELECT 1 FROM employee_locations WHERE employee_id = ?", e.id);
  const locations = hasAssignments ? assigned : all<{ id: number; name: string; latitude: number; longitude: number; radius_m: number }>("SELECT id, name, latitude, longitude, radius_m FROM locations WHERE active = 1");
  const kind = rec?.check_in_minutes == null ? "in" : rec.check_out_minutes == null ? "out" : "done";
  const history = all<{ work_date: string; check_in_minutes: number | null; check_out_minutes: number | null; late_minutes: number; worked_minutes: number; status: string }>(
    "SELECT * FROM attendance WHERE employee_id = ? ORDER BY work_date DESC LIMIT 7",
    e.id,
  );

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`أهلاً ${e.full_name.split(" ")[0]} 👋`} subtitle="سجّل حضورك وانصرافك من موقع العمل" />
      <div className="grid gap-5">
        {s && (
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="card p-4"><div className="text-xs text-slate-500">بداية الدوام</div><div className="text-lg font-extrabold">{time12(s.start_time)}</div></div>
            <div className="card p-4"><div className="text-xs text-slate-500">آخر وقت بدون تأخير</div><div className="text-lg font-extrabold text-amber-700">{time12(Number(s.start_time.slice(0, 2)) * 60 + Number(s.start_time.slice(3, 5)) + s.grace_minutes)}</div></div>
            <div className="card p-4"><div className="text-xs text-slate-500">نهاية الدوام</div><div className="text-lg font-extrabold">{time12(s.end_time)}</div></div>
          </div>
        )}
        {s && !isWorkDay(s, now.weekday) && <Alert tone="sky">اليوم ليس من أيام العمل الرسمية في دوامك.</Alert>}
        {rec && (
          <Card>
            <div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
              <div><div className="text-xs text-slate-500">الحضور</div><div className="text-lg font-bold">{time12(rec.check_in_minutes)}</div></div>
              <div><div className="text-xs text-slate-500">الانصراف</div><div className="text-lg font-bold">{time12(rec.check_out_minutes)}</div></div>
              <div><div className="text-xs text-slate-500">التأخير</div><div className={`text-lg font-bold ${rec.late_minutes ? "text-amber-700" : ""}`}>{rec.late_minutes} د</div></div>
              <div><div className="text-xs text-slate-500">ساعات العمل</div><div className="text-lg font-bold">{durationLabel(rec.worked_minutes)}</div></div>
            </div>
          </Card>
        )}
        {kind === "done" && <Alert tone="brand" title="أكملت تسجيل اليوم ✅">سجلت الحضور والانصراف لهذا اليوم.</Alert>}
        <PunchClient kind={kind} locations={locations} requireSelfie={getSetting("require_selfie") === "1"} tz={tz} />
        <Card title="آخر 7 أيام" pad={false}>
          {history.length ? (
            <table className="table">
              <thead><tr><th>اليوم</th><th>الحضور</th><th>الانصراف</th><th>التأخير</th><th>الحالة</th></tr></thead>
              <tbody>{history.map((h) => (
                <tr key={h.work_date}>
                  <td>{fmtDate(h.work_date)}</td><td>{time12(h.check_in_minutes)}</td><td>{time12(h.check_out_minutes)}</td>
                  <td>{h.late_minutes} د</td><td><StatusBadge map={ATTENDANCE_STATUS} value={h.status} /></td>
                </tr>
              ))}</tbody>
            </table>
          ) : <Empty title="لا توجد سجلات بعد" />}
        </Card>
      </div>
    </div>
  );
}
