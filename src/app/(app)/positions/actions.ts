"use server";
import { redirect } from "next/navigation";
import { run } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { safe, str, req, intOrNull } from "@/lib/action";
import type { ActionState } from "@/components/forms";

const FIELDS = ["grade", "summary", "duties", "qualifications", "skills", "experience", "work_conditions", "kpis"] as const;

export async function savePosition(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("hr");
  const r = await safe(() => {
    const id = intOrNull(fd, "id");
    const vals = [req(fd, "title", "المسمى الوظيفي"), intOrNull(fd, "department_id"), intOrNull(fd, "reports_to_position_id"), ...FIELDS.map((k) => str(fd, k))];
    const cols = ["title", "department_id", "reports_to_position_id", ...FIELDS];
    if (id) run(`UPDATE positions SET ${cols.map((c) => `${c} = ?`).join(", ")}, updated_at = datetime('now') WHERE id = ?`, ...vals, id);
    else run(`INSERT INTO positions(${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`, ...vals);
    return { ok: "saved" };
  });
  if (r?.ok) redirect("/positions");
  return r;
}

export async function deletePosition(fd: FormData) {
  await requireRole("hr");
  run("DELETE FROM positions WHERE id = ?", Number(fd.get("id")));
  redirect("/positions");
}
