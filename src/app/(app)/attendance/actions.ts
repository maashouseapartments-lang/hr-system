"use server";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { all, get, getSetting, run } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";
import { safe, str, UserError } from "@/lib/action";
import { saveDataUrl } from "@/lib/files";
import { notify } from "@/lib/workflow";
import {
  companyTz, dailyWage, earlyLeaveMinutes, getEmployee, haversine, isWorkDay, lateMinutes, minuteRate, round2, scheduleFor, toBreak,
} from "@/lib/hr";
import { nowInTz, toMinutes } from "@/lib/time";
import type { ActionState } from "@/components/forms";

export type PunchInput = {
  kind: "in" | "out";
  locationId: number;
  lat: number;
  lng: number;
  accuracy: number;
  photo: string | null;
  deviceId: string;
};

const DEVICE_COOKIE = "hr_device";

export async function punch(input: PunchInput): Promise<ActionState> {
  const u = await requireUser();
  return safe(async () => {
    if (!u.employee_id) throw new UserError("حسابك غير مرتبط بملف موظف");
    const e = getEmployee(u.employee_id);
    if (!e || e.status === "terminated") throw new UserError("ملفك الوظيفي غير نشط");

    // ── الموقع
    const loc = get<{ id: number; name: string; latitude: number; longitude: number; radius_m: number }>(
      "SELECT * FROM locations WHERE id = ? AND active = 1",
      input.locationId,
    );
    if (!loc) throw new UserError("اختر موقع التسجيل");
    const assigned = all<{ location_id: number }>("SELECT location_id FROM employee_locations WHERE employee_id = ?", e.id);
    if (assigned.length && !assigned.some((a) => a.location_id === loc.id)) throw new UserError("هذا الموقع غير مخصص لك");
    if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) throw new UserError("تعذر قراءة موقعك");
    const distance = haversine(input.lat, input.lng, loc.latitude, loc.longitude);
    if (distance > loc.radius_m)
      throw new UserError(`أنت خارج نطاق «${loc.name}» — تبعد ${Math.round(distance)} متر والنطاق المسموح ${loc.radius_m} متر`);

    // ── الصورة
    if (getSetting("require_selfie") === "1" && !input.photo) throw new UserError("التقط صورة الوجه لإثبات الحضور");

    // ── بصمة الجهاز
    const jar = await cookies();
    let device = jar.get(DEVICE_COOKIE)?.value;
    if (!device) {
      device = /^[\w-]{8,64}$/.test(input.deviceId) ? input.deviceId : crypto.randomUUID();
      jar.set(DEVICE_COOKIE, device, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 * 5 });
    }
    const ua = (await headers()).get("user-agent") ?? "";
    const others = all<{ employee_id: number; full_name: string }>(
      "SELECT d.employee_id, e.full_name FROM devices d JOIN employees e ON e.id = d.employee_id WHERE d.device_id IN (?, ?) AND d.employee_id != ?",
      device,
      input.deviceId,
      e.id,
    );
    if (others.length) {
      const block = getSetting("block_shared_device") === "1";
      run(
        "INSERT INTO device_alerts(device_id, employee_id, other_employee_ids, action, blocked, user_agent) VALUES (?,?,?,?,?,?)",
        device,
        e.id,
        others.map((o) => o.employee_id).join(","),
        input.kind === "in" ? "check_in" : "check_out",
        block ? 1 : 0,
        ua,
      );
      notify({
        roles: ["hr", "admin"],
        title: "⚠️ تسجيل حضور من جهاز مشترك",
        body: `${e.full_name} حاول تسجيل ${input.kind === "in" ? "الحضور" : "الانصراف"} من جهاز سبق استخدامه من: ${others.map((o) => o.full_name).join("، ")}`,
        link: "/attendance/alerts",
        level: "danger",
      });
      if (block) throw new UserError("لا يمكن تسجيل الحضور من هذا الجهاز لأنه مسجل لموظف آخر. يجب أن يسجل كل موظف من جهازه الخاص. تم إبلاغ الموارد البشرية.");
    }
    run(
      `INSERT INTO devices(device_id, employee_id, user_agent) VALUES (?,?,?)
       ON CONFLICT(device_id, employee_id) DO UPDATE SET last_seen = datetime('now'), user_agent = excluded.user_agent`,
      device,
      e.id,
      ua,
    );

    // ── الوقت والجدول
    const tz = companyTz();
    const now = nowInTz(tz);
    const s = scheduleFor(e, now.date);
    if (!s) throw new UserError("لم يتم تحديد مواعيد العمل بعد. راجع الموارد البشرية");
    const workday = isWorkDay(s, now.weekday);
    const rate = minuteRate(e, s);
    const rec = get<{ id: number; check_in_minutes: number | null; check_out_minutes: number | null; late_minutes: number }>(
      "SELECT id, check_in_minutes, check_out_minutes, late_minutes FROM attendance WHERE employee_id = ? AND work_date = ?",
      e.id,
      now.date,
    );
    const iso = new Date().toISOString();

    if (input.kind === "in") {
      if (rec?.check_in_minutes != null) throw new UserError("سجلت حضورك اليوم مسبقاً");
      const late = workday ? lateMinutes(s, now.minutes) : 0;
      const vals = [
        s.id, iso, now.minutes, loc.id, input.lat, input.lng, input.accuracy, round2(distance), device,
        late, round2(rate), round2(late * rate), late > 0 ? "late" : "present", ua,
      ];
      let id: number;
      if (rec) {
        run(
          `UPDATE attendance SET schedule_id=?, check_in_at=?, check_in_minutes=?, check_in_location_id=?, check_in_lat=?, check_in_lng=?,
             check_in_accuracy=?, check_in_distance=?, check_in_device=?, late_minutes=?, minute_rate=?, deduction_amount=?, status=?, user_agent=? WHERE id=?`,
          ...vals,
          rec.id,
        );
        id = rec.id;
      } else {
        id = run(
          `INSERT INTO attendance(schedule_id, check_in_at, check_in_minutes, check_in_location_id, check_in_lat, check_in_lng, check_in_accuracy,
             check_in_distance, check_in_device, late_minutes, minute_rate, deduction_amount, status, user_agent, employee_id, work_date)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          ...vals,
          e.id,
          now.date,
        ).id;
      }
      if (input.photo) {
        const pid = saveDataUrl(input.photo, { entity_type: "attendance", entity_id: id, category: "selfie", title: "صورة الحضور", uploaded_by: u.id });
        run("UPDATE attendance SET check_in_photo_id = ? WHERE id = ?", pid, id);
      }
      revalidatePath("/attendance");
      return { ok: late > 0 ? `تم تسجيل حضورك — تأخير ${late} دقيقة بعد فترة السماح` : "تم تسجيل حضورك بنجاح، يومك سعيد ☀️" };
    }

    // انصراف
    if (!rec || rec.check_in_minutes == null) throw new UserError("لا يوجد تسجيل حضور اليوم. سجّل الحضور أولاً");
    if (rec.check_out_minutes != null) throw new UserError("سجلت انصرافك اليوم مسبقاً");
    const early = workday ? earlyLeaveMinutes(s, now.minutes) : 0;
    const worked = Math.max(0, now.minutes - rec.check_in_minutes - toBreak(s, rec.check_in_minutes, now.minutes));
    run(
      `UPDATE attendance SET check_out_at=?, check_out_minutes=?, check_out_location_id=?, check_out_lat=?, check_out_lng=?, check_out_accuracy=?,
         check_out_distance=?, check_out_device=?, early_leave_minutes=?, worked_minutes=?, deduction_amount=? WHERE id=?`,
      iso, now.minutes, loc.id, input.lat, input.lng, input.accuracy, round2(distance), device, early, worked,
      round2((rec.late_minutes + early) * rate), rec.id,
    );
    if (input.photo) {
      const pid = saveDataUrl(input.photo, { entity_type: "attendance", entity_id: rec.id, category: "selfie", title: "صورة الانصراف", uploaded_by: u.id });
      run("UPDATE attendance SET check_out_photo_id = ? WHERE id = ?", pid, rec.id);
    }
    revalidatePath("/attendance");
    return { ok: early > 0 ? `تم تسجيل انصرافك — خروج مبكر ${early} دقيقة` : "تم تسجيل انصرافك، في أمان الله 👋" };
  });
}

/** احتساب الغياب ليوم معين لكل من لم يسجل حضوراً وليس في إجازة */
export async function markAbsences(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("hr");
  return safe(() => {
    const date = str(fd, "date");
    if (!date) throw new UserError("اختر التاريخ");
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const emps = all<{ id: number }>(
      `SELECT e.id FROM employees e WHERE e.status IN ('active') AND e.hire_date <= ?
         AND NOT EXISTS (SELECT 1 FROM attendance a WHERE a.employee_id = e.id AND a.work_date = ?)
         AND NOT EXISTS (SELECT 1 FROM leave_requests l WHERE l.employee_id = e.id AND l.status NOT IN ('rejected','cancelled','hr_review','direct_manager','dept_manager')
                         AND ? BETWEEN l.start_date AND l.end_date)`,
      date,
      date,
      date,
    );
    let n = 0;
    for (const { id } of emps) {
      const e = getEmployee(id)!;
      const s = scheduleFor(e, date);
      if (!s || !isWorkDay(s, weekday)) continue;
      run(
        "INSERT INTO attendance(employee_id, work_date, schedule_id, status, deduction_amount, minute_rate) VALUES (?,?,?, 'absent', ?, ?)",
        id,
        date,
        s.id,
        round2(dailyWage(e)),
        round2(minuteRate(e, s)),
      );
      n++;
    }
    revalidatePath("/attendance/records");
    return { ok: n ? `تم تسجيل ${n} حالة غياب ليوم ${date}` : "لا توجد حالات غياب لهذا اليوم" };
  });
}

/** تعديل سجل (عذر مقبول / تصحيح وقت) من الموارد البشرية */
export async function editAttendance(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireRole("hr");
  return safe(() => {
    const id = Number(fd.get("id"));
    const rec = get<{ employee_id: number; work_date: string; check_in_minutes: number | null; check_out_minutes: number | null }>(
      "SELECT employee_id, work_date, check_in_minutes, check_out_minutes FROM attendance WHERE id = ?",
      id,
    );
    if (!rec) throw new UserError("السجل غير موجود");
    const e = getEmployee(rec.employee_id)!;
    const s = scheduleFor(e, rec.work_date);
    if (!s) throw new UserError("لا يوجد دوام");
    const note = `${str(fd, "note") ?? ""} (بواسطة ${u.display_name})`;
    if (fd.get("excuse")) {
      run("UPDATE attendance SET status = 'excused', deduction_amount = 0, excuse_note = ? WHERE id = ?", note, id);
    } else {
      const inM = toMinutes(str(fd, "check_in")) ?? rec.check_in_minutes;
      const outM = toMinutes(str(fd, "check_out")) ?? rec.check_out_minutes;
      const weekday = new Date(`${rec.work_date}T12:00:00Z`).getUTCDay();
      const wd = isWorkDay(s, weekday);
      const late = inM != null && wd ? lateMinutes(s, inM) : 0;
      const early = outM != null && wd ? earlyLeaveMinutes(s, outM) : 0;
      const rate = minuteRate(e, s);
      const worked = inM != null && outM != null ? Math.max(0, outM - inM - toBreak(s, inM, outM)) : 0;
      run(
        `UPDATE attendance SET check_in_minutes=?, check_out_minutes=?, late_minutes=?, early_leave_minutes=?, worked_minutes=?, minute_rate=?,
           deduction_amount=?, status=?, excuse_note=? WHERE id=?`,
        inM, outM, late, early, worked, round2(rate), round2((late + early) * rate), inM == null ? "absent" : late ? "late" : "present", note, id,
      );
    }
    revalidatePath("/attendance/records");
    return { ok: "تم تحديث السجل" };
  });
}

export async function resolveAlert(fd: FormData) {
  const u = await requireRole("hr");
  run("UPDATE device_alerts SET resolved = 1, resolution_note = ? WHERE id = ?", `${String(fd.get("note") || "تمت المراجعة")} — ${u.display_name}`, Number(fd.get("id")));
  if (fd.get("reset_device")) run("DELETE FROM devices WHERE device_id = ?", String(fd.get("device_id")));
  revalidatePath("/attendance/alerts");
}
