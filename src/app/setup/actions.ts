"use server";
import { redirect } from "next/navigation";
import { get, run, tx } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { safe, req, UserError } from "@/lib/action";
import { saveCompany, scheduleFromForm, insertSchedule } from "@/lib/company";
import type { ActionState } from "@/components/forms";

export async function setupSystem(_: ActionState, fd: FormData): Promise<ActionState> {
  const r = await safe(async () => {
    if (get("SELECT 1 FROM users LIMIT 1")) throw new UserError("تمت تهيئة النظام مسبقاً");
    const username = req(fd, "admin_username", "اسم المستخدم");
    const password = req(fd, "admin_password", "كلمة المرور");
    if (password.length < 8) throw new UserError("كلمة المرور يجب ألا تقل عن 8 أحرف");
    if (password !== fd.get("admin_password2")) throw new UserError("كلمتا المرور غير متطابقتين");
    const schedule = scheduleFromForm(fd);
    await saveCompany(fd);
    const userId = tx(() => {
      insertSchedule(schedule, true);
      return run(
        "INSERT INTO users(username, password_hash, display_name, role) VALUES (?,?,?, 'admin')",
        username,
        hashPassword(password),
        req(fd, "admin_name", "اسم مدير النظام"),
      ).id;
    });
    await createSession(userId);
    return { ok: "done" };
  });
  if (r?.ok) redirect("/settings?welcome=1");
  return r;
}
