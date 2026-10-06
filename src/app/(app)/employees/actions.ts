"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { get, run, tx } from "@/lib/db";
import { hashPassword, requireRole } from "@/lib/auth";
import { safe, str, req, numOr, intOrNull, UserError } from "@/lib/action";
import { saveUpload, saveUploads } from "@/lib/files";
import { logEvent } from "@/lib/workflow";
import type { ActionState } from "@/components/forms";

const TEXT_FIELDS = [
  "full_name_en", "national_id", "id_type", "id_expiry", "passport_no", "passport_expiry", "nationality", "gender",
  "birth_date", "marital_status", "religion", "phone", "email", "address", "emergency_contact", "emergency_phone",
  "education", "bank_name", "iban", "contract_type", "contract_end", "last_leave_return_date", "notes",
] as const;

function readEmployee(fd: FormData) {
  const managerId = intOrNull(fd, "manager_id");
  return {
    employee_no: req(fd, "employee_no", "الرقم الوظيفي"),
    full_name: req(fd, "full_name", "الاسم الكامل"),
    hire_date: req(fd, "hire_date", "تاريخ المباشرة"),
    department_id: intOrNull(fd, "department_id"),
    position_id: intOrNull(fd, "position_id"),
    manager_id: managerId,
    schedule_id: intOrNull(fd, "schedule_id"),
    basic_salary: numOr(fd, "basic_salary"),
    housing_allowance: numOr(fd, "housing_allowance"),
    transport_allowance: numOr(fd, "transport_allowance"),
    other_allowance: numOr(fd, "other_allowance"),
    prior_leave_used: numOr(fd, "prior_leave_used"),
    status: str(fd, "status") ?? "active",
    ...Object.fromEntries(TEXT_FIELDS.map((k) => [k, str(fd, k)])),
  };
}

async function saveFiles(fd: FormData, id: number, userId: number) {
  const cv = await saveUpload(fd.get("cv"), { entity_type: "employee", entity_id: id, category: "cv", title: "السيرة الذاتية", uploaded_by: userId });
  if (cv) run("UPDATE employees SET cv_file_id = ? WHERE id = ?", cv, id);
  const photo = await saveUpload(fd.get("photo"), { entity_type: "employee", entity_id: id, category: "photo", title: "الصورة الشخصية", uploaded_by: userId });
  if (photo) run("UPDATE employees SET photo_file_id = ? WHERE id = ?", photo, id);
  const locs = fd.getAll("location_ids").map(Number).filter(Boolean);
  run("DELETE FROM employee_locations WHERE employee_id = ?", id);
  for (const l of locs) run("INSERT OR IGNORE INTO employee_locations(employee_id, location_id) VALUES (?,?)", id, l);
}

export async function createEmployee(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireRole("hr");
  let newId = 0;
  const r = await safe(async () => {
    const e = readEmployee(fd);
    const cols = Object.keys(e);
    newId = tx(() => {
      const id = run(`INSERT INTO employees(${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`, ...Object.values(e)).id;
      if (fd.get("create_account")) {
        const pw = str(fd, "account_password") ?? e.employee_no;
        if (pw.length < 6) throw new UserError("كلمة مرور حساب الموظف يجب ألا تقل عن 6 أحرف");
        run(
          "INSERT INTO users(username, password_hash, display_name, role, employee_id) VALUES (?,?,?,?,?)",
          e.employee_no,
          hashPassword(pw),
          e.full_name,
          str(fd, "account_role") ?? "employee",
          id,
        );
      }
      return id;
    });
    await saveFiles(fd, newId, u.id);
    logEvent("employee", newId, "create", "إضافة الموظف للنظام", u);
    return { ok: "done" };
  });
  if (r?.ok) redirect(`/employees/${newId}?created=1`);
  return r;
}

export async function updateEmployee(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireRole("hr");
  const id = Number(fd.get("id"));
  const r = await safe(async () => {
    const e = readEmployee(fd);
    if (e.manager_id === id) throw new UserError("لا يمكن أن يكون الموظف مديراً لنفسه");
    run(`UPDATE employees SET ${Object.keys(e).map((k) => `${k} = ?`).join(", ")} WHERE id = ?`, ...Object.values(e), id);
    run("UPDATE users SET display_name = ? WHERE employee_id = ?", e.full_name, id);
    await saveFiles(fd, id, u.id);
    logEvent("employee", id, "update", "تحديث بيانات الموظف", u);
    return { ok: "done" };
  });
  if (r?.ok) redirect(`/employees/${id}`);
  return r;
}

export async function uploadEmployeeDocs(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireRole("hr");
  return safe(async () => {
    const id = Number(fd.get("employee_id"));
    const ids = await saveUploads(fd.getAll("files"), {
      entity_type: "employee",
      entity_id: id,
      category: str(fd, "category") ?? "document",
      title: str(fd, "title") ?? undefined,
      uploaded_by: u.id,
    });
    if (!ids.length) throw new UserError("اختر ملفاً للرفع");
    revalidatePath(`/employees/${id}`);
    return { ok: "تم رفع المستند" };
  });
}

export async function createEmployeeAccount(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("hr");
  return safe(() => {
    const id = Number(fd.get("employee_id"));
    const e = get<{ employee_no: string; full_name: string }>("SELECT employee_no, full_name FROM employees WHERE id = ?", id);
    if (!e) throw new UserError("الموظف غير موجود");
    const pw = req(fd, "password", "كلمة المرور");
    if (pw.length < 6) throw new UserError("كلمة المرور يجب ألا تقل عن 6 أحرف");
    run("INSERT INTO users(username, password_hash, display_name, role, employee_id) VALUES (?,?,?, 'employee', ?)", e.employee_no, hashPassword(pw), e.full_name, id);
    revalidatePath(`/employees/${id}`);
    return { ok: `تم إنشاء الحساب. اسم المستخدم: ${e.employee_no}` };
  });
}
