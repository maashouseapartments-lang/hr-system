"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { all, get, run, setSetting } from "@/lib/db";
import { hashPassword, requireRole } from "@/lib/auth";
import { safe, str, req, numOr, intOrNull, bool, UserError } from "@/lib/action";
import { saveCompany, scheduleFromForm, insertSchedule } from "@/lib/company";
import type { ActionState } from "@/components/forms";

const hr = () => requireRole("hr");

export async function updateCompany(_: ActionState, fd: FormData) {
  const u = await hr();
  return safe(async () => {
    await saveCompany(fd, u.id);
    revalidatePath("/", "layout");
    return { ok: "تم حفظ بيانات الشركة" };
  });
}

// ─────────── الدوامات ───────────
export async function saveSchedule(_: ActionState, fd: FormData) {
  await hr();
  const r = await safe(() => {
    const s = scheduleFromForm(fd);
    const id = intOrNull(fd, "id");
    const isDefault = !!fd.get("is_default");
    if (id) {
      if (isDefault) run("UPDATE schedules SET is_default = 0");
      run(
        `UPDATE schedules SET name=?, start_time=?, end_time=?, break_start=?, break_end=?, grace_minutes=?, work_days=?,
           effective_from=?, effective_to=?, notes=?, is_default = CASE WHEN ? THEN 1 ELSE is_default END WHERE id = ?`,
        s.name, s.start_time, s.end_time, s.break_start, s.break_end, s.grace_minutes, s.work_days,
        s.effective_from, s.effective_to, s.notes, isDefault, id,
      );
    } else insertSchedule(s, isDefault || !get("SELECT 1 FROM schedules"));
    // تخصيص موظفين لهذا الدوام
    const sid = id ?? (get<{ id: number }>("SELECT MAX(id) AS id FROM schedules")!.id);
    const emps = fd.getAll("employee_ids").map(Number).filter(Boolean);
    for (const e of emps) run("UPDATE employees SET schedule_id = ? WHERE id = ?", sid, e);
    return { ok: "saved" };
  });
  if (r?.ok) redirect("/settings/schedules");
  return r;
}

export async function deleteSchedule(fd: FormData) {
  await hr();
  const id = Number(fd.get("id"));
  const s = get<{ is_default: number }>("SELECT is_default FROM schedules WHERE id = ?", id);
  if (s && !s.is_default) {
    run("UPDATE employees SET schedule_id = NULL WHERE schedule_id = ?", id);
    run("DELETE FROM schedules WHERE id = ?", id);
  }
  revalidatePath("/settings/schedules");
}

// ─────────── الأقسام ───────────
export async function saveDepartment(_: ActionState, fd: FormData) {
  await hr();
  const r = await safe(() => {
    const id = intOrNull(fd, "id");
    const parent = intOrNull(fd, "parent_id");
    if (id && parent === id) throw new UserError("لا يمكن أن يكون القسم تابعاً لنفسه");
    if (id && parent) {
      // منع الحلقات في الهيكل
      let p: number | null = parent;
      while (p) {
        if (p === id) throw new UserError("لا يمكن جعل القسم تابعاً لأحد أقسامه الفرعية");
        p = get<{ parent_id: number | null }>("SELECT parent_id FROM departments WHERE id = ?", p)?.parent_id ?? null;
      }
    }
    const vals = [
      req(fd, "name", "اسم القسم"),
      str(fd, "code"),
      parent,
      intOrNull(fd, "head_employee_id"),
      bool(fd, "in_clearance"),
      str(fd, "clearance_items"),
      numOr(fd, "sort_order", 0),
    ];
    if (id)
      run("UPDATE departments SET name=?, code=?, parent_id=?, head_employee_id=?, in_clearance=?, clearance_items=?, sort_order=? WHERE id=?", ...vals, id);
    else
      run("INSERT INTO departments(name, code, parent_id, head_employee_id, in_clearance, clearance_items, sort_order) VALUES (?,?,?,?,?,?,?)", ...vals);
    return { ok: "saved" };
  });
  if (r?.ok) redirect("/settings/departments");
  return r;
}

export async function deleteDepartment(fd: FormData) {
  await hr();
  const id = Number(fd.get("id"));
  const parent = get<{ parent_id: number | null }>("SELECT parent_id FROM departments WHERE id = ?", id)?.parent_id ?? null;
  run("UPDATE departments SET parent_id = ? WHERE parent_id = ?", parent, id);
  run("DELETE FROM departments WHERE id = ?", id);
  revalidatePath("/settings/departments");
}

// ─────────── مواقع الحضور ───────────
export async function saveLocation(_: ActionState, fd: FormData) {
  await hr();
  const r = await safe(() => {
    const id = intOrNull(fd, "id");
    const lat = numOr(fd, "latitude", NaN);
    const lng = numOr(fd, "longitude", NaN);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
      throw new UserError("الإحداثيات غير صحيحة");
    const vals = [req(fd, "name", "اسم الموقع"), lat, lng, Math.max(20, numOr(fd, "radius_m", 150)), str(fd, "address"), bool(fd, "active")];
    let locId = id;
    if (id) run("UPDATE locations SET name=?, latitude=?, longitude=?, radius_m=?, address=?, active=? WHERE id=?", ...vals, id);
    else locId = run("INSERT INTO locations(name, latitude, longitude, radius_m, address, active) VALUES (?,?,?,?,?,?)", ...vals).id;
    if (fd.get("assign_all")) {
      for (const e of all<{ id: number }>("SELECT id FROM employees WHERE status != 'terminated'"))
        run("INSERT OR IGNORE INTO employee_locations(employee_id, location_id) VALUES (?,?)", e.id, locId);
    }
    return { ok: "saved" };
  });
  if (r?.ok) redirect("/settings/locations");
  return r;
}

export async function deleteLocation(fd: FormData) {
  await hr();
  run("DELETE FROM locations WHERE id = ?", Number(fd.get("id")));
  revalidatePath("/settings/locations");
}

// ─────────── أنواع الإجازات ───────────
export async function saveLeaveType(_: ActionState, fd: FormData) {
  await hr();
  return safe(() => {
    const id = intOrNull(fd, "id");
    const vals = [
      req(fd, "name", "اسم الإجازة"),
      intOrNull(fd, "default_days"),
      bool(fd, "paid"),
      bool(fd, "full_cycle"),
      bool(fd, "deducts_balance"),
      str(fd, "legal_reference"),
      bool(fd, "active"),
    ];
    if (id) run("UPDATE leave_types SET name=?, default_days=?, paid=?, full_cycle=?, deducts_balance=?, legal_reference=?, active=? WHERE id=?", ...vals, id);
    else
      run(
        "INSERT INTO leave_types(code, name, default_days, paid, full_cycle, deducts_balance, legal_reference, active) VALUES (?,?,?,?,?,?,?,?)",
        `custom_${Date.now()}`,
        ...vals,
      );
    revalidatePath("/settings/leave-types");
    return { ok: "تم الحفظ" };
  });
}

// ─────────── لائحة المخالفات ───────────
export async function saveViolationType(_: ActionState, fd: FormData) {
  await hr();
  const r = await safe(() => {
    const id = intOrNull(fd, "id");
    const p = (k: string) => {
      const kind = str(fd, `${k}_kind`) ?? "warning";
      const val = numOr(fd, `${k}_val`, 0);
      if (kind === "pct" || kind === "days") {
        if (val <= 0) throw new UserError("أدخل قيمة الحسم لكل تكرار");
        return `${kind}:${val}`;
      }
      return kind;
    };
    const vals = [req(fd, "code", "رقم البند"), req(fd, "category", "التصنيف"), req(fd, "description", "وصف المخالفة"), p("p1"), p("p2"), p("p3"), p("p4"), bool(fd, "active")];
    if (id) run("UPDATE violation_types SET code=?, category=?, description=?, penalty1=?, penalty2=?, penalty3=?, penalty4=?, active=? WHERE id=?", ...vals, id);
    else run("INSERT INTO violation_types(code, category, description, penalty1, penalty2, penalty3, penalty4, active) VALUES (?,?,?,?,?,?,?,?)", ...vals);
    return { ok: "saved" };
  });
  if (r?.ok) redirect("/settings/violation-types");
  return r;
}

// ─────────── إعدادات عامة ───────────
export async function saveGeneralSettings(_: ActionState, fd: FormData) {
  await hr();
  return safe(() => {
    setSetting("deduction_basis", str(fd, "deduction_basis") === "basic" ? "basic" : "total");
    setSetting("block_shared_device", fd.get("block_shared_device") ? "1" : "0");
    setSetting("require_selfie", fd.get("require_selfie") ? "1" : "0");
    setSetting("overtime_rate_basic_pct", String(numOr(fd, "overtime_rate_basic_pct", 50)));
    setSetting("violation_repeat_days", String(numOr(fd, "violation_repeat_days", 180)));
    setSetting("max_violation_days", String(numOr(fd, "max_violation_days", 5)));
    return { ok: "تم حفظ الإعدادات" };
  });
}

// ─────────── المستخدمون ───────────
export async function saveUser(_: ActionState, fd: FormData) {
  await requireRole("admin");
  return safe(() => {
    const id = intOrNull(fd, "id");
    const role = str(fd, "role") ?? "employee";
    if (!["admin", "hr", "gm", "finance", "employee"].includes(role)) throw new UserError("صلاحية غير صحيحة");
    const pw = str(fd, "password");
    if (pw && pw.length < 6) throw new UserError("كلمة المرور يجب ألا تقل عن 6 أحرف");
    if (id) {
      run("UPDATE users SET display_name=?, role=?, employee_id=?, active=? WHERE id=?", req(fd, "display_name", "الاسم"), role, intOrNull(fd, "employee_id"), bool(fd, "active"), id);
      if (pw) run("UPDATE users SET password_hash = ? WHERE id = ?", hashPassword(pw), id);
    } else {
      if (!pw) throw new UserError("كلمة المرور مطلوبة للمستخدم الجديد");
      run(
        "INSERT INTO users(username, password_hash, display_name, role, employee_id) VALUES (?,?,?,?,?)",
        req(fd, "username", "اسم المستخدم"),
        hashPassword(pw),
        req(fd, "display_name", "الاسم"),
        role,
        intOrNull(fd, "employee_id"),
      );
    }
    revalidatePath("/settings/users");
    return { ok: "تم حفظ المستخدم" };
  });
}
