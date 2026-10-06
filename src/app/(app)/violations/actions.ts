"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { get, run } from "@/lib/db";
import { requireRole, isHR, isGM } from "@/lib/auth";
import { safe, str, req, numOr, UserError } from "@/lib/action";
import { saveUploads } from "@/lib/files";
import { logEvent, notify } from "@/lib/workflow";
import { dailyWage, getEmployee, nextRef, penaltyAmount, penaltyLabel, round2, today, violationOccurrence } from "@/lib/hr";
import type { ActionState } from "@/components/forms";

export async function createViolation(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireRole("hr");
  let id = 0;
  const r = await safe(async () => {
    const employeeId = Number(req(fd, "employee_id", "الموظف"));
    const ref = nextRef("violations", "VL");
    id = run(
      `INSERT INTO violations(ref_no, employee_id, incident_date, incident_time, incident_place, description, evidence_notes, created_by)
       VALUES (?,?,?,?,?,?,?,?)`,
      ref, employeeId, req(fd, "incident_date", "تاريخ المخالفة"), str(fd, "incident_time"), str(fd, "incident_place"),
      req(fd, "description", "وصف المخالفة"), str(fd, "evidence_notes"), u.id,
    ).id;
    await saveUploads(fd.getAll("files"), { entity_type: "violation", entity_id: id, category: "evidence", uploaded_by: u.id });
    logEvent("violation", id, "investigation", "تسجيل المخالفة وفتح التحقيق", u, str(fd, "description"));
    return { ok: "done" };
  });
  if (r?.ok) redirect(`/violations/${id}`);
  return r;
}

type V = { id: number; ref_no: string; employee_id: number; status: string; incident_date: string; violation_type_id: number | null; penalty_code: string | null; deduction_amount: number | null };

export async function violationStep(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireRole("hr", "gm");
  const id = Number(fd.get("id"));
  return safe(async () => {
    const v = get<V>("SELECT * FROM violations WHERE id = ?", id);
    if (!v) throw new UserError("المخالفة غير موجودة");
    const op = String(fd.get("op"));
    const note = str(fd, "note");
    if (!["upload", "cancel"].includes(op) && fd.get("expected") !== v.status) throw new UserError("تغيرت حالة المخالفة، حدّث الصفحة");
    const setStatus = (s: string) => run("UPDATE violations SET status = ?, updated_at = datetime('now') WHERE id = ?", s, id);
    const hrOnly = () => { if (!isHR(u)) throw new UserError("هذه المرحلة من صلاحية الموارد البشرية"); };

    switch (op) {
      case "investigation": {
        hrOnly();
        await saveUploads(fd.getAll("files"), { entity_type: "violation", entity_id: id, category: "evidence", uploaded_by: u.id });
        if (str(fd, "evidence_notes")) run("UPDATE violations SET evidence_notes = ? WHERE id = ?", str(fd, "evidence_notes"), id);
        logEvent("violation", id, "investigation", "اكتمال جمع الأدلة — الانتقال لسماع إفادة الموظف", u, note);
        setStatus("statement");
        notify({ employeeId: v.employee_id, title: `استدعاء للتحقيق — ${v.ref_no}`, body: "يرجى مراجعة الموارد البشرية لسماع إفادتك", level: "warning", link: `/violations/${id}` });
        break;
      }
      case "statement": {
        hrOnly();
        const mode = String(fd.get("statement_mode"));
        if (mode === "given") {
          run("UPDATE violations SET statement_mode = 'given', employee_statement = ?, statement_date = ? WHERE id = ?", req(fd, "employee_statement", "إفادة الموظف"), str(fd, "statement_date") ?? today(), id);
          await saveUploads(fd.getAll("files"), { entity_type: "violation", entity_id: id, category: "statement", title: "إفادة الموظف الموقعة", uploaded_by: u.id });
          logEvent("violation", id, "statement", "سماع إفادة الموظف وتوثيقها", u, note);
        } else if (mode === "refused") {
          const files = await saveUploads(fd.getAll("files"), { entity_type: "violation", entity_id: id, category: "witness", title: "محضر رفض التوقيع بشهادة الشهود", uploaded_by: u.id });
          if (!files.length) throw new UserError("أرفق المحضر الموقع من الشاهدين");
          run(
            "UPDATE violations SET statement_mode = 'refused', witness1_name = ?, witness1_id = ?, witness2_name = ?, witness2_id = ?, statement_date = ? WHERE id = ?",
            req(fd, "witness1_name", "اسم الشاهد الأول"), str(fd, "witness1_id"), req(fd, "witness2_name", "اسم الشاهد الثاني"), str(fd, "witness2_id"), str(fd, "statement_date") ?? today(), id,
          );
          logEvent("violation", id, "statement", "رفض الموظف الإفادة/التوقيع — تم التوثيق بشهادة شاهدين", u, note);
        } else if (mode === "absent") {
          const files = await saveUploads(fd.getAll("files"), { entity_type: "violation", entity_id: id, category: "email_proof", title: "إثبات المراسلات للموظف", uploaded_by: u.id });
          if (!files.length) throw new UserError("أرفق ما يثبت مراسلة الموظف (الإيميلات/الرسائل)");
          run("UPDATE violations SET statement_mode = 'absent', absence_notes = ?, statement_date = ? WHERE id = ?", req(fd, "absence_notes", "تفاصيل المراسلات"), str(fd, "statement_date") ?? today(), id);
          logEvent("violation", id, "statement", "تعذر سماع الإفادة لتغيب الموظف — تم إرفاق إثبات المراسلات", u, note);
        } else throw new UserError("اختر حالة الإفادة");
        setStatus("decision");
        break;
      }
      case "decision": {
        hrOnly();
        if (fd.get("decision") === "cancel") {
          if (!note) throw new UserError("اكتب سبب حفظ التحقيق");
          logEvent("violation", id, "decision", "حفظ التحقيق — لم تثبت المخالفة", u, note);
          setStatus("cancelled");
          break;
        }
        const typeId = Number(req(fd, "violation_type_id", "بند المخالفة"));
        const t = get<{ code: string; penalty1: string; penalty2: string; penalty3: string; penalty4: string }>("SELECT * FROM violation_types WHERE id = ?", typeId);
        if (!t) throw new UserError("البند غير موجود");
        const occ = violationOccurrence(v.employee_id, typeId, v.incident_date, id);
        const code = [t.penalty1, t.penalty2, t.penalty3, t.penalty4][occ - 1];
        const e = getEmployee(v.employee_id)!;
        const daily = round2(dailyWage(e));
        let amount = penaltyAmount(code, daily);
        if (code === "warning_time") amount = round2(numOr(fd, "manual_amount", 0));
        run(
          "UPDATE violations SET violation_type_id = ?, occurrence = ?, penalty_code = ?, daily_wage = ?, deduction_amount = ?, decision_notes = ? WHERE id = ?",
          typeId, occ, code, daily, amount, note, id,
        );
        logEvent("violation", id, "decision", `تحديد البند ${t.code} — المرة ${occ}: ${penaltyLabel(code)}${amount ? ` (${amount.toFixed(2)} ر.س)` : ""}`, u, note);
        setStatus("approval");
        notify({ roles: ["gm"], title: `قرار جزاء بانتظار الاعتماد — ${v.ref_no}`, body: e.full_name, link: `/violations/${id}` });
        break;
      }
      case "approval": {
        if (!isGM(u)) throw new UserError("الاعتماد من صلاحية المدير الإداري");
        if (fd.get("decision") === "return") {
          if (!note) throw new UserError("اكتب سبب الإعادة");
          logEvent("violation", id, "approval", "إعادة القرار للموارد البشرية للمراجعة", u, note);
          setStatus("decision");
          break;
        }
        const period = today().slice(0, 7);
        if (v.deduction_amount && v.deduction_amount > 0)
          run(
            "INSERT INTO payroll_adjustments(employee_id, kind, source, source_id, amount, period, description) VALUES (?, 'deduction', 'violation', ?, ?, ?, ?)",
            v.employee_id, id, v.deduction_amount, period, `جزاء مخالفة ${v.ref_no}`,
          );
        run("UPDATE violations SET applied_at = datetime('now') WHERE id = ?", id);
        logEvent("violation", id, "approval", `اعتماد القرار وتطبيق الجزاء: ${penaltyLabel(v.penalty_code)}`, u, note);
        setStatus("applied");
        notify({ employeeId: v.employee_id, title: `قرار جزاء — ${v.ref_no}`, body: penaltyLabel(v.penalty_code), level: "danger", link: `/violations/${id}` });
        break;
      }
      case "upload": {
        const ids = await saveUploads(fd.getAll("files"), { entity_type: "violation", entity_id: id, category: str(fd, "category") ?? "evidence", title: str(fd, "title") ?? undefined, uploaded_by: u.id });
        if (!ids.length) throw new UserError("اختر ملفاً");
        logEvent("violation", id, v.status, "إرفاق مستند", u, str(fd, "title"));
        break;
      }
      case "cancel": {
        hrOnly();
        if (["applied", "cancelled"].includes(v.status)) throw new UserError("لا يمكن الإلغاء في هذه المرحلة");
        logEvent("violation", id, v.status, "إلغاء / حفظ المخالفة", u, note);
        setStatus("cancelled");
        break;
      }
      default:
        throw new UserError("إجراء غير معروف");
    }
    revalidatePath(`/violations/${id}`);
    return { ok: "تم تنفيذ الإجراء" };
  });
}
