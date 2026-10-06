import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { all, get, run } from "./db";

export type Role = "admin" | "hr" | "gm" | "finance" | "employee";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "مدير النظام",
  hr: "الموارد البشرية",
  gm: "المدير الإداري",
  finance: "القسم المالي",
  employee: "موظف",
};

export type SessionUser = {
  id: number;
  username: string;
  display_name: string;
  role: Role;
  employee_id: number | null;
  /** أقسام يرأسها هذا المستخدم (عبر ملفه الوظيفي) */
  headed_departments: number[];
};

const COOKIE = "hr_session";

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(password, salt, 64);
  const known = Buffer.from(hash, "hex");
  return known.length === test.length && crypto.timingSafeEqual(known, test);
}

export async function createSession(userId: number) {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
  run("INSERT INTO sessions(token, user_id, expires_at) VALUES (?,?,?)", token, userId, expires.toISOString());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.HR_INSECURE_COOKIE !== "1",
    path: "/",
    expires,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) run("DELETE FROM sessions WHERE token = ?", token);
  jar.delete(COOKIE);
}

export const getUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = get<Omit<SessionUser, "headed_departments"> & { expires_at: string; active: number }>(
    `SELECT u.id, u.username, u.display_name, u.role, u.employee_id, u.active, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`,
    token,
  );
  if (!row || !row.active || new Date(row.expires_at) < new Date()) return null;
  const headed = row.employee_id
    ? all<{ id: number }>("SELECT id FROM departments WHERE head_employee_id = ?", row.employee_id)
    : [];
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    role: row.role,
    employee_id: row.employee_id,
    headed_departments: headed.map((d) => d.id),
  };
});

export async function requireUser(): Promise<SessionUser> {
  const u = await getUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const u = await requireUser();
  if (u.role !== "admin" && !roles.includes(u.role)) redirect("/dashboard?denied=1");
  return u;
}

export const isHR = (u: SessionUser) => u.role === "admin" || u.role === "hr";
export const isGM = (u: SessionUser) => u.role === "admin" || u.role === "gm";
export const isFinance = (u: SessionUser) => u.role === "admin" || u.role === "finance";
export const isStaff = (u: SessionUser) => u.role !== "employee";
export const isManager = (u: SessionUser) =>
  !!u.employee_id &&
  (u.headed_departments.length > 0 ||
    !!get("SELECT 1 FROM employees WHERE manager_id = ? LIMIT 1", u.employee_id));
