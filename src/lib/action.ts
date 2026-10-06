import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { ActionState } from "@/components/forms";

export class UserError extends Error {}

/** يغلف منطق الـ Server Action: يعيد رسالة خطأ واضحة بدل انهيار الصفحة */
export async function safe(fn: () => Promise<ActionState | void> | ActionState | void): Promise<ActionState> {
  try {
    return (await fn()) ?? { ok: "تم الحفظ بنجاح" };
  } catch (e) {
    unstable_rethrow(e);
    console.error(e);
    const msg = e instanceof Error ? e.message : "حدث خطأ غير متوقع";
    if (/UNIQUE constraint failed: employees.employee_no/.test(msg)) return { error: "الرقم الوظيفي مستخدم لموظف آخر" };
    if (/UNIQUE constraint failed: users.username/.test(msg)) return { error: "اسم المستخدم مستخدم مسبقاً" };
    return { error: msg };
  }
}

export const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
};

export const req = (fd: FormData, k: string, label: string) => {
  const v = str(fd, k);
  if (!v) throw new UserError(`الحقل «${label}» مطلوب`);
  return v;
};

export const numOr = (fd: FormData, k: string, fallback = 0) => {
  const v = str(fd, k);
  if (v == null) return fallback;
  const n = Number(v.replace(/,/g, ""));
  return Number.isFinite(n) ? n : fallback;
};

export const intOrNull = (fd: FormData, k: string) => {
  const v = str(fd, k);
  return v == null ? null : Number(v);
};

export const bool = (fd: FormData, k: string) => (fd.get(k) ? 1 : 0);
