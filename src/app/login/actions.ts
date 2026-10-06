"use server";
import { redirect } from "next/navigation";
import { createSession, destroySession, verifyPassword } from "@/lib/auth";
import { get } from "@/lib/db";
import type { ActionState } from "@/components/forms";

export async function login(_: ActionState, fd: FormData): Promise<ActionState> {
  const username = String(fd.get("username") || "").trim();
  const password = String(fd.get("password") || "");
  const u = get<{ id: number; password_hash: string; active: number }>(
    "SELECT id, password_hash, active FROM users WHERE username = ? COLLATE NOCASE",
    username,
  );
  if (!u || !u.active || !verifyPassword(password, u.password_hash)) {
    return { error: "اسم المستخدم أو كلمة المرور غير صحيحة" };
  }
  await createSession(u.id);
  redirect("/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
