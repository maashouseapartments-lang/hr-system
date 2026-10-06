"use server";
import { revalidatePath } from "next/cache";
import { run } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function markAllRead() {
  const u = await requireUser();
  run("UPDATE notifications SET read_at = datetime('now') WHERE read_at IS NULL AND (user_id = ? OR (user_id IS NULL AND (',' || roles || ',') LIKE ?))", u.id, `%,${u.role},%`);
  revalidatePath("/dashboard");
}
