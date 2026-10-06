"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { all, get, run } from "@/lib/db";
import { requireUser, isHR, type SessionUser } from "@/lib/auth";
import { safe, str, req, intOrNull, UserError } from "@/lib/action";
import { saveUpload, saveUploads } from "@/lib/files";
import { logEvent, notify } from "@/lib/workflow";
import { annualEligibility, getEmployee, nextRef, today } from "@/lib/hr";
import { canActLeave, clearanceDeptsFor, leaveCtx, canViewEmployee } from "@/lib/permissions";
import { clearanceRows, getLeave, getLeaveType, nextStatus, settlementTotal, type Leave, type SettlementLine } from "@/lib/leave";
import { EXTRA_STAGE_LABELS, LEAVE_STAGES, LEAVE_STATUS } from "@/lib/labels";
import { addDays, daysBetween } from "@/lib/time";
import type { ActionState } from "@/components/forms";

const stageLabel = (s: string) => LEAVE_STAGES.find((x) => x.key === s)?.label ?? LEAVE_STATUS[s]?.label ?? EXTRA_STAGE_LABELS[s] ?? s;

/** ينقل الطلب للمرحلة التالية ويبلغ المسؤول عنها */
function advance(l: Leave, u: SessionUser, action: string, note?: string | null) {
  logEvent("leave", l.id, l.status, action, u, note);
  const next = nextStatus(l);
  run("UPDATE leave_requests SET status = ?, updated_at = datetime('now') WHERE id = ?", next, l.id);
  const e = getEmployee(l.employee_id)!;
  const link = `/leaves/${l.id}`;
  const title = `${l.ref_no} — ${e.full_name}`;
  if (next === "clearance") {
    // إنشاء نموذج إخلاء الطرف لكل الأقسام المشمولة
    const depts = all<{ id: number; head_employee_id: number | null }>("SELECT id, head_employee_id FROM departments WHERE in_clearance = 1");
    for (const d of depts) {
      run("INSERT OR IGNORE INTO clearance_signatures(leave_request_id, department_id) VALUES (?,?)", l.id, d.id);
      if (d.head_employee_id) notify({ employeeId: d.head_employee_id, title: `إخلاء طرف: ${title}`, body: "يرجى التأكد من استلام العهد والتوقيع", link });
    }
    if (!depts.length) return advance({ ...l, status: "clearance" }, u, "لا توجد أقسام مشمولة بإخلاء الطرف — تخطي");
  }
  if (next === "direct_manager") notify({ employeeId: e.manager_id, title: `طلب إجازة بانتظار موافقتك: ${title}`, link });
  if (next === "dept_manager") {
    const h = get<{ h: number | null }>("SELECT head_employee_id AS h FROM departments WHERE id = ?", e.department_id ?? 0)?.h;
    notify({ employeeId: h, title: `طلب إجازة بانتظار موافقتك: ${title}`, link });
  }
  if (["substitute", "settlement", "visa", "hr_archive"].includes(next)) notify({ roles: ["hr"], title: `${stageLabel(next)}: ${title}`, link });
  if (["gm_signature", "settlement_gm"].includes(next)) notify({ roles: ["gm"], title: `${stageLabel(next)}: ${title}`, link });
  if (next === "finance") notify({ roles: ["finance"], title: `تحويل مستحقات إجازة: ${title}`, link, level: "warning" });
  if (next === "employee_sign") notify({ employeeId: e.id, title: "تسوية مستحقات إجازتك جاهزة للتوقيع", link });
  if (next === "completed") {
    logEvent("leave", l.id, "completed", "اكتمال جميع مراحل الطلب", null);
    notify({ employeeId: e.id, title: "اكتملت إجراءات إجازتك ✅", body: "نتمنى لك إجازة سعيدة", link, level: "success" });
  }
}

export async function createLeave(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  let id = 0;
  const r = await safe(async () => {
    const employeeId = isHR(u) ? Number(req(fd, "employee_id", "الموظف")) : u.employee_id;
    if (!employeeId) throw new UserError("حسابك غير مرتبط بملف موظف");
    if (!isHR(u) && !canViewEmployee(u, employeeId)) throw new UserError("غير مصرح");
    const start = req(fd, "start_date", "تاريخ البداية");
    const end = req(fd, "end_date", "تاريخ النهاية");
    const days = daysBetween(start, end) + 1;
    if (days < 1) throw new UserError("تاريخ النهاية يجب أن يكون بعد تاريخ البداية");
    const overlap = get(
      "SELECT 1 FROM leave_requests WHERE employee_id = ? AND status NOT IN ('rejected','cancelled') AND start_date <= ? AND end_date >= ?",
      employeeId,
      end,
      start,
    );
    if (overlap) throw new UserError("يوجد طلب إجازة آخر في نفس الفترة");
    const ref = nextRef("leave_requests", "LV");
    id = run(
      `INSERT INTO leave_requests(ref_no, employee_id, leave_type_id, start_date, end_date, days, return_date, reason, destination, needs_visa, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      ref, employeeId, intOrNull(fd, "leave_type_id"), start, end, days, addDays(end, 1), str(fd, "reason"), str(fd, "destination"),
      fd.get("needs_visa") ? 1 : 0, u.id,
    ).id;
    await saveUploads(fd.getAll("files"), { entity_type: "leave", entity_id: id, category: "request_form", uploaded_by: u.id });
    logEvent("leave", id, "request", "تقديم طلب الإجازة", u, str(fd, "reason"));
    notify({ roles: ["hr"], title: `طلب إجازة جديد ${ref}`, body: getEmployee(employeeId)?.full_name, link: `/leaves/${id}` });
    return { ok: "done" };
  });
  if (r?.ok) redirect(`/leaves/${id}`);
  return r;
}

/** إجراء على مرحلة من مراحل سير العمل */
export async function leaveStep(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const id = Number(fd.get("id"));
  const r = await safe(async () => {
    const l = getLeave(id);
    const ctx = leaveCtx(id);
    if (!l || !ctx) throw new UserError("الطلب غير موجود");
    const op = String(fd.get("op"));
    const note = str(fd, "note");
    if (op !== "upload" && op !== "return" && op !== "cancel" && !canActLeave(u, ctx)) throw new UserError("ليست لديك صلاحية على هذه المرحلة");
    if (op !== "upload" && op !== "return" && op !== "cancel" && fd.get("expected") !== l.status) throw new UserError("تغيرت حالة الطلب، حدّث الصفحة");

    const reject = (by: string) => {
      if (!note) throw new UserError("اكتب سبب الرفض");
      logEvent("leave", l.id, l.status, `رفض الطلب — ${by}`, u, note);
      run("UPDATE leave_requests SET status = 'rejected', updated_at = datetime('now') WHERE id = ?", l.id);
      notify({ employeeId: l.employee_id, title: `تم رفض طلب الإجازة ${l.ref_no}`, body: note, link: `/leaves/${l.id}`, level: "danger" });
    };

    switch (op) {
      case "hr_review": {
        if (fd.get("decision") === "reject") { reject("الموارد البشرية"); break; }
        const typeId = Number(req(fd, "leave_type_id", "نوع الإجازة"));
        const start = req(fd, "start_date", "تاريخ البداية");
        const end = req(fd, "end_date", "تاريخ النهاية");
        const days = daysBetween(start, end) + 1;
        if (days < 1) throw new UserError("التواريخ غير صحيحة");
        const lt = getLeaveType(typeId)!;
        const e = getEmployee(l.employee_id)!;
        const elig = { ...annualEligibility(e, start, l.id), requestedDays: days };
        elig.exceedsBalance = lt.deducts_balance ? days > elig.balance : false;
        if (elig.exceedsBalance && !fd.get("override")) throw new UserError(`الأيام المطلوبة (${days}) أكثر من الرصيد المتاح (${elig.balance}). فعّل «اعتماد رغم تجاوز الرصيد» إن كان ذلك مقصوداً`);
        run(
          "UPDATE leave_requests SET leave_type_id = ?, start_date = ?, end_date = ?, days = ?, return_date = ?, needs_visa = ?, eligibility_snapshot = ? WHERE id = ?",
          typeId, start, end, days, addDays(end, 1), fd.get("needs_visa") ? 1 : 0, JSON.stringify(elig), l.id,
        );
        advance({ ...getLeave(l.id)! }, u, `إصدار طلب ${lt.name} (${days} يوم)`, note);
        break;
      }
      case "approve": {
        if (fd.get("decision") === "reject") { reject(stageLabel(l.status)); break; }
        advance(l, u, `موافقة — ${stageLabel(l.status)}`, note);
        break;
      }
      case "substitute": {
        const sub = Number(req(fd, "substitute_employee_id", "الموظف البديل"));
        if (sub === l.employee_id) throw new UserError("لا يمكن أن يكون البديل هو نفس الموظف");
        const sname = getEmployee(sub)?.full_name;
        run("UPDATE leave_requests SET substitute_employee_id = ?, substitute_notes = ? WHERE id = ?", sub, note, l.id);
        notify({ employeeId: sub, title: `تم تعيينك بديلاً عن ${getEmployee(l.employee_id)?.full_name}`, body: `خلال الفترة ${l.start_date} إلى ${l.end_date}`, link: `/leaves/${l.id}` });
        advance(l, u, `تعيين البديل: ${sname}`, note);
        break;
      }
      case "clearance": {
        const deptId = Number(req(fd, "department_id", "القسم"));
        if (!isHR(u) && !clearanceDeptsFor(u, l.id).includes(deptId)) throw new UserError("لا يمكنك التوقيع عن هذا القسم");
        const status = fd.get("status") === "has_custody" ? "has_custody" : "cleared";
        run(
          "UPDATE clearance_signatures SET status = ?, items = ?, notes = ?, signed_by = ?, signed_by_name = ?, signed_at = datetime('now') WHERE leave_request_id = ? AND department_id = ?",
          status, str(fd, "items"), note, u.id, u.display_name, l.id, deptId,
        );
        const dname = get<{ name: string }>("SELECT name FROM departments WHERE id = ?", deptId)?.name;
        logEvent("leave", l.id, "clearance", status === "cleared" ? `توقيع إخلاء طرف — ${dname}: تم استلام العهد` : `${dname}: توجد عهدة لم تُسلّم`, u, note);
        const rows = clearanceRows(l.id);
        if (rows.every((x) => x.status === "cleared")) advance(l, u, "اكتمال توقيعات إخلاء الطرف من جميع الأقسام");
        break;
      }
      case "gm_signature": {
        if (fd.get("decision") === "reject") { reject("المدير الإداري"); break; }
        advance(l, u, "توقيع المدير الإداري على طلب الإجازة", note);
        break;
      }
      case "settlement": {
        const labels = fd.getAll("line_label").map(String);
        const kinds = fd.getAll("line_kind").map(String);
        const amounts = fd.getAll("line_amount").map((x) => Number(String(x).replace(/,/g, "")));
        const lines: SettlementLine[] = labels
          .map((label, i) => ({ label: label.trim(), kind: (kinds[i] === "deduction" ? "deduction" : "addition") as SettlementLine["kind"], amount: Math.abs(amounts[i] || 0) }))
          .filter((x) => x.label && x.amount);
        if (!lines.length) throw new UserError("أضف بنود التسوية");
        const total = settlementTotal(lines);
        run("UPDATE leave_requests SET settlement_json = ?, settlement_total = ? WHERE id = ?", JSON.stringify(lines), total, l.id);
        if (fd.get("submit") === "draft") return { ok: "تم حفظ مسودة التسوية" };
        advance(l, u, `إعداد تسوية المستحقات ورفعها للمدير الإداري — الصافي ${total.toFixed(2)} ر.س`, note);
        break;
      }
      case "settlement_gm": {
        if (fd.get("decision") === "return") {
          if (!note) throw new UserError("اكتب سبب الإعادة");
          logEvent("leave", l.id, l.status, "إعادة التسوية للموارد البشرية للتعديل", u, note);
          run("UPDATE leave_requests SET status = 'settlement', updated_at = datetime('now') WHERE id = ?", l.id);
          notify({ roles: ["hr"], title: `أُعيدت تسوية ${l.ref_no} للتعديل`, body: note, link: `/leaves/${l.id}` });
          break;
        }
        advance(l, u, "اعتماد تسوية المستحقات من المدير الإداري", note);
        break;
      }
      case "employee_sign": {
        const signed = await saveUpload(fd.get("signed_copy"), { entity_type: "leave", entity_id: l.id, category: "signed_copy", title: "التسوية موقعة من الموظف", uploaded_by: u.id });
        if (u.employee_id !== l.employee_id && !signed) throw new UserError("ارفع نسخة التسوية الموقعة من الموظف");
        if (!fd.get("ack")) throw new UserError("يجب تأكيد الاطلاع والموافقة على التسوية");
        advance(l, u, u.employee_id === l.employee_id ? "توقيع الموظف إلكترونياً على التسوية" : "توقيع الموظف على التسوية (نسخة ورقية مرفقة)", note);
        break;
      }
      case "visa": {
        run(
          "UPDATE leave_requests SET visa_number = ?, visa_type = ?, visa_issue_date = ?, visa_expiry_date = ? WHERE id = ?",
          req(fd, "visa_number", "رقم التأشيرة"), str(fd, "visa_type"), str(fd, "visa_issue_date"), str(fd, "visa_expiry_date"), l.id,
        );
        await saveUpload(fd.get("visa_file"), { entity_type: "leave", entity_id: l.id, category: "visa", title: "تأشيرة الخروج والعودة", uploaded_by: u.id });
        advance(l, u, `استخراج تأشيرة ${str(fd, "visa_type") ?? "خروج وعودة"} رقم ${str(fd, "visa_number")}`, note);
        break;
      }
      case "finance": {
        const receipt = await saveUpload(fd.get("receipt"), { entity_type: "leave", entity_id: l.id, category: "receipt", title: "إيصال تحويل المستحقات", uploaded_by: u.id });
        if (!receipt) throw new UserError("أرفق إيصال التحويل");
        run("UPDATE leave_requests SET transfer_reference = ?, transfer_date = ? WHERE id = ?", req(fd, "transfer_reference", "رقم الحوالة"), str(fd, "transfer_date") ?? today(), l.id);
        advance(l, u, `تحويل المستحقات للموظف — حوالة رقم ${str(fd, "transfer_reference")}`, note);
        break;
      }
      case "hr_archive": {
        await saveUploads(fd.getAll("files"), { entity_type: "leave", entity_id: l.id, category: "signed_copy", title: "نسخة ورقية مؤرشفة", uploaded_by: u.id });
        advance(l, u, "استلام إيصال التحويل وأرشفة الملف (نسخة ورقية وإلكترونية)", note);
        break;
      }
      case "upload": {
        if (!isHR(u) && u.employee_id !== l.employee_id && !canActLeave(u, ctx)) throw new UserError("غير مصرح");
        const ids = await saveUploads(fd.getAll("files"), { entity_type: "leave", entity_id: l.id, category: str(fd, "category") ?? "signed_copy", title: str(fd, "title") ?? undefined, uploaded_by: u.id });
        if (!ids.length) throw new UserError("اختر ملفاً");
        logEvent("leave", l.id, l.status, "إرفاق مستند", u, str(fd, "title"));
        break;
      }
      case "return": {
        if (!isHR(u)) throw new UserError("غير مصرح");
        run("UPDATE leave_requests SET actual_return_date = ? WHERE id = ?", req(fd, "actual_return_date", "تاريخ المباشرة"), l.id);
        logEvent("leave", l.id, "return", `مباشرة الموظف بعد الإجازة بتاريخ ${str(fd, "actual_return_date")}`, u, note);
        break;
      }
      case "cancel": {
        if (["completed", "rejected", "cancelled"].includes(l.status)) throw new UserError("لا يمكن إلغاء هذا الطلب");
        if (!isHR(u) && !(u.employee_id === l.employee_id && l.status === "hr_review")) throw new UserError("غير مصرح بالإلغاء");
        run("UPDATE leave_requests SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?", l.id);
        logEvent("leave", l.id, l.status, "إلغاء الطلب", u, note);
        break;
      }
      default:
        throw new UserError("إجراء غير معروف");
    }
    revalidatePath(`/leaves/${id}`);
    return { ok: "تم تنفيذ الإجراء" };
  });
  return r;
}
