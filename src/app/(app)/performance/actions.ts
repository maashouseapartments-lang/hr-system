"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { get, run } from "@/lib/db";
import { requireUser, isHR } from "@/lib/auth";
import { teamIds } from "@/lib/permissions";
import { safe, str, req, UserError } from "@/lib/action";
import { logEvent, notify } from "@/lib/workflow";
import { PERFORMANCE_CRITERIA, ratingFor } from "@/lib/labels";
import type { ActionState } from "@/components/forms";

export async function saveReview(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  let id = 0;
  const r = await safe(() => {
    const employeeId = Number(req(fd, "employee_id", "الموظف"));
    if (!isHR(u) && !teamIds(u).includes(employeeId)) throw new UserError("يمكنك تقييم أعضاء فريقك فقط");
    const scores: Record<string, number> = {};
    let total = 0;
    for (const c of PERFORMANCE_CRITERIA) {
      const s = Number(fd.get(`score_${c.key}`));
      if (!(s >= 1 && s <= 5)) throw new UserError(`اختر درجة «${c.label}»`);
      scores[c.key] = s;
      total += (s / 5) * c.weight;
    }
    const status = fd.get("submit") === "draft" ? "draft" : "submitted";
    id = run(
      `INSERT INTO performance_reviews(employee_id, period, reviewer_name, scores_json, total_score, rating, strengths, improvements, goals, status, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      employeeId, req(fd, "period", "فترة التقييم"), u.display_name, JSON.stringify(scores), Math.round(total * 10) / 10, ratingFor(total),
      str(fd, "strengths"), str(fd, "improvements"), str(fd, "goals"), status, u.id,
    ).id;
    logEvent("performance", id, status, status === "draft" ? "حفظ مسودة التقييم" : "اعتماد التقييم وإرساله للموظف", u);
    if (status === "submitted") notify({ employeeId, title: "تقييم أداء جديد بانتظار اطلاعك", link: `/performance/${id}` });
    return { ok: "done" };
  });
  if (r?.ok) redirect(`/performance/${id}`);
  return r;
}

export async function reviewStep(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const id = Number(fd.get("id"));
  return safe(() => {
    const p = get<{ employee_id: number; status: string; created_by: number }>("SELECT employee_id, status, created_by FROM performance_reviews WHERE id = ?", id);
    if (!p) throw new UserError("غير موجود");
    const op = String(fd.get("op"));
    if (op === "submit") {
      if (p.status !== "draft" || (!isHR(u) && p.created_by !== u.id)) throw new UserError("غير مصرح");
      run("UPDATE performance_reviews SET status = 'submitted' WHERE id = ?", id);
      logEvent("performance", id, "submitted", "اعتماد التقييم وإرساله للموظف", u);
      notify({ employeeId: p.employee_id, title: "تقييم أداء جديد بانتظار اطلاعك", link: `/performance/${id}` });
    } else if (op === "ack") {
      if (p.status !== "submitted" || u.employee_id !== p.employee_id) throw new UserError("غير مصرح");
      run("UPDATE performance_reviews SET status = 'acknowledged', employee_comment = ?, acknowledged_at = datetime('now') WHERE id = ?", str(fd, "employee_comment"), id);
      logEvent("performance", id, "acknowledged", "اطلاع الموظف على التقييم", u, str(fd, "employee_comment"));
    } else throw new UserError("إجراء غير معروف");
    revalidatePath(`/performance/${id}`);
    return { ok: "تم" };
  });
}
