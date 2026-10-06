"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { all, get, run, tx } from "@/lib/db";
import { requireUser, isHR, isGM, isManager } from "@/lib/auth";
import { safe, str, req, intOrNull, numOr, UserError } from "@/lib/action";
import { saveUploads } from "@/lib/files";
import { logEvent, notify } from "@/lib/workflow";
import { getEmployee, nextRef, overtimeRates, round2, scheduleFor } from "@/lib/hr";
import { toMinutes } from "@/lib/time";
import type { ActionState } from "@/components/forms";

type OT = { id: number; ref_no: string; status: string; work_date: string; start_time: string; end_time: string; department_id: number | null };

const windowMinutes = (o: Pick<OT, "start_time" | "end_time">) => {
  const s = toMinutes(o.start_time)!;
  let e = toMinutes(o.end_time)!;
  if (e <= s) e += 24 * 60; // عمل يمتد بعد منتصف الليل
  return e - s;
};

export async function createOvertime(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  let id = 0;
  const r = await safe(async () => {
    if (!isHR(u) && !isGM(u) && !isManager(u)) throw new UserError("طلب العمل الإضافي يرفعه مدير القسم أو الموارد البشرية");
    const o = { start_time: req(fd, "start_time", "من الساعة"), end_time: req(fd, "end_time", "إلى الساعة") };
    if (windowMinutes(o) <= 0) throw new UserError("الفترة غير صحيحة");
    id = run(
      `INSERT INTO overtime_requests(ref_no, department_id, requested_by_name, work_date, start_time, end_time, location_id, employees_needed, reason, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      nextRef("overtime_requests", "OT"), intOrNull(fd, "department_id"), str(fd, "requested_by_name") ?? u.display_name,
      req(fd, "work_date", "التاريخ"), o.start_time, o.end_time, intOrNull(fd, "location_id"), intOrNull(fd, "employees_needed"), req(fd, "reason", "سبب العمل الإضافي"), u.id,
    ).id;
    await saveUploads(fd.getAll("files"), { entity_type: "overtime", entity_id: id, category: "request_form", title: "طلب القسم الورقي", uploaded_by: u.id });
    logEvent("overtime", id, "pending", "رفع طلب عمل إضافي", u, str(fd, "reason"));
    notify({ roles: ["hr", "gm"], title: "طلب عمل إضافي جديد", link: `/overtime/${id}` });
    return { ok: "done" };
  });
  if (r?.ok) redirect(`/overtime/${id}`);
  return r;
}

export async function overtimeStep(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const id = Number(fd.get("id"));
  return safe(async () => {
    const o = get<OT>("SELECT * FROM overtime_requests WHERE id = ?", id);
    if (!o) throw new UserError("الطلب غير موجود");
    const op = String(fd.get("op"));
    const note = str(fd, "note");
    if (op !== "upload" && fd.get("expected") !== o.status) throw new UserError("تغيرت حالة الطلب، حدّث الصفحة");
    const setStatus = (s: string) => run("UPDATE overtime_requests SET status = ?, updated_at = datetime('now') WHERE id = ?", s, id);

    switch (op) {
      case "approve": {
        if (!isHR(u) && !isGM(u)) throw new UserError("غير مصرح");
        if (fd.get("decision") === "reject") {
          if (!note) throw new UserError("اكتب سبب الرفض");
          logEvent("overtime", id, o.status, "رفض طلب العمل الإضافي", u, note);
          setStatus("rejected");
          break;
        }
        logEvent("overtime", id, o.status, "الموافقة على طلب العمل الإضافي", u, note);
        setStatus("approved");
        break;
      }
      case "assign": {
        if (!isHR(u)) throw new UserError("تخصيص الموظفين من صلاحية الموارد البشرية");
        const ids = fd.getAll("employee_ids").map(Number).filter(Boolean);
        if (!ids.length) throw new UserError("اختر الموظفين المخصصين");
        const planned = windowMinutes(o);
        tx(() => {
          run("DELETE FROM overtime_assignments WHERE overtime_id = ?", id);
          for (const eid of ids) {
            const e = getEmployee(eid)!;
            const rates = overtimeRates(e, scheduleFor(e, o.work_date));
            run(
              "INSERT INTO overtime_assignments(overtime_id, employee_id, planned_minutes, hourly_wage, hourly_basic, amount) VALUES (?,?,?,?,?,?)",
              id, eid, planned, round2(rates.hourlyWage), round2(rates.hourlyBasic), round2((planned / 60) * rates.hourlyOvertime),
            );
          }
        });
        for (const eid of ids) notify({ employeeId: eid, title: "تم تكليفك بعمل إضافي", body: `بتاريخ ${o.work_date} من ${o.start_time} إلى ${o.end_time}`, link: `/overtime/${id}` });
        logEvent("overtime", id, o.status, `تخصيص ${ids.length} موظف للعمل الإضافي`, u, note);
        setStatus("assigned");
        break;
      }
      case "complete": {
        if (!isHR(u)) throw new UserError("غير مصرح");
        const rows = all<{ id: number; employee_id: number; hourly_wage: number; hourly_basic: number }>("SELECT * FROM overtime_assignments WHERE overtime_id = ?", id);
        const pct = Number(get<{ value: string }>("SELECT value FROM settings WHERE key = 'overtime_rate_basic_pct'")?.value ?? 50) / 100;
        const period = o.work_date.slice(0, 7);
        let total = 0;
        tx(() => {
          run("DELETE FROM payroll_adjustments WHERE source = 'overtime' AND source_id IN (SELECT id FROM overtime_assignments WHERE overtime_id = ?)", id);
          for (const a of rows) {
            const attended = !!fd.get(`attended_${a.id}`);
            const mins = attended ? Math.max(0, numOr(fd, `minutes_${a.id}`, 0)) : 0;
            const amount = round2((mins / 60) * (a.hourly_wage + a.hourly_basic * pct));
            total += amount;
            run("UPDATE overtime_assignments SET attended = ?, actual_minutes = ?, amount = ? WHERE id = ?", attended ? 1 : 0, mins, amount, a.id);
            if (amount > 0)
              run(
                "INSERT INTO payroll_adjustments(employee_id, kind, source, source_id, amount, period, description) VALUES (?, 'addition', 'overtime', ?, ?, ?, ?)",
                a.employee_id, a.id, amount, period, `عمل إضافي ${o.ref_no} (${Math.round(mins / 6) / 10} ساعة)`,
              );
          }
        });
        logEvent("overtime", id, o.status, `اعتماد التنفيذ واحتساب الأجر الإضافي — الإجمالي ${total.toFixed(2)} ر.س`, u, note);
        setStatus("completed");
        break;
      }
      case "upload": {
        const ids = await saveUploads(fd.getAll("files"), { entity_type: "overtime", entity_id: id, category: str(fd, "category") ?? "document", uploaded_by: u.id });
        if (!ids.length) throw new UserError("اختر ملفاً");
        logEvent("overtime", id, o.status, "إرفاق مستند", u);
        break;
      }
      default:
        throw new UserError("إجراء غير معروف");
    }
    revalidatePath(`/overtime/${id}`);
    return { ok: "تم تنفيذ الإجراء" };
  });
}
