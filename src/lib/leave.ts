import "server-only";
import { all, get } from "./db";
import { getEmployee, round2, totalWage } from "./hr";
import { LEAVE_STAGES } from "./labels";

export type Leave = {
  id: number;
  ref_no: string;
  employee_id: number;
  leave_type_id: number | null;
  start_date: string;
  end_date: string;
  days: number;
  return_date: string | null;
  reason: string | null;
  destination: string | null;
  needs_visa: number;
  status: string;
  eligibility_snapshot: string | null;
  substitute_employee_id: number | null;
  substitute_notes: string | null;
  visa_number: string | null;
  visa_type: string | null;
  visa_issue_date: string | null;
  visa_expiry_date: string | null;
  settlement_json: string | null;
  settlement_total: number | null;
  transfer_reference: string | null;
  transfer_date: string | null;
  actual_return_date: string | null;
  created_at: string;
  updated_at: string;
};

export type LeaveType = { id: number; code: string; name: string; default_days: number | null; paid: number; full_cycle: number; deducts_balance: number; legal_reference: string | null };

export const getLeave = (id: number) => get<Leave>("SELECT * FROM leave_requests WHERE id = ?", id);
export const getLeaveType = (id: number | null) => (id ? get<LeaveType>("SELECT * FROM leave_types WHERE id = ?", id) : undefined);

/** المراحل الفعلية لهذا الطلب (تختلف حسب نوع الإجازة ووجود مدير/تأشيرة) */
export function stagesFor(l: Leave) {
  const lt = getLeaveType(l.leave_type_id);
  const e = getEmployee(l.employee_id);
  const head = e?.department_id ? get<{ h: number | null }>("SELECT head_employee_id AS h FROM departments WHERE id = ?", e.department_id)?.h : null;
  return LEAVE_STAGES.filter((s) => {
    if (s.fullOnly && !lt?.full_cycle) return false;
    if (s.key === "direct_manager" && !e?.manager_id) return false;
    if (s.key === "dept_manager" && (!head || head === e?.manager_id || head === e?.id)) return false;
    if (s.key === "visa" && !l.needs_visa) return false;
    return true;
  });
}

export function nextStatus(l: Leave): string {
  const stages = stagesFor(l);
  const i = stages.findIndex((s) => s.key === l.status);
  return stages[i + 1]?.key ?? "completed";
}

export type SettlementLine = { label: string; kind: "addition" | "deduction"; amount: number };

/** مسودة تسوية المستحقات قبل الإجازة */
export function draftSettlement(l: Leave): SettlementLine[] {
  const e = getEmployee(l.employee_id)!;
  const lt = getLeaveType(l.leave_type_id);
  const daily = totalWage(e) / 30;
  const month = l.start_date.slice(0, 7);
  const dayOfMonth = Number(l.start_date.slice(8, 10));
  const lines: SettlementLine[] = [];
  const workedDays = Math.max(0, dayOfMonth - 1);
  if (workedDays) lines.push({ label: `راتب ${workedDays} يوم عمل من شهر ${month} قبل الإجازة`, kind: "addition", amount: round2(daily * workedDays) });
  if (lt?.paid) lines.push({ label: `أجر الإجازة مقدماً (${l.days} يوم) — المادة 109`, kind: "addition", amount: round2(daily * l.days) });
  const ot = get<{ s: number }>(
    "SELECT COALESCE(SUM(amount),0) AS s FROM payroll_adjustments WHERE employee_id = ? AND kind = 'addition' AND period = ?",
    e.id,
    month,
  )!.s;
  if (ot) lines.push({ label: `العمل الإضافي المستحق لشهر ${month}`, kind: "addition", amount: round2(ot) });
  const vio = get<{ s: number }>(
    "SELECT COALESCE(SUM(amount),0) AS s FROM payroll_adjustments WHERE employee_id = ? AND kind = 'deduction' AND period = ?",
    e.id,
    month,
  )!.s;
  if (vio) lines.push({ label: `جزاءات المخالفات لشهر ${month}`, kind: "deduction", amount: round2(vio) });
  const late = get<{ s: number }>(
    "SELECT COALESCE(SUM(deduction_amount),0) AS s FROM attendance WHERE employee_id = ? AND work_date LIKE ?",
    e.id,
    `${month}%`,
  )!.s;
  if (late) lines.push({ label: `خصم التأخير والغياب لشهر ${month}`, kind: "deduction", amount: round2(late) });
  return lines;
}

export const settlementTotal = (lines: SettlementLine[]) =>
  round2(lines.reduce((s, x) => s + (x.kind === "addition" ? x.amount : -x.amount), 0));

export function clearanceRows(leaveId: number) {
  return all<{
    id: number;
    department_id: number;
    dept: string;
    head_employee_id: number | null;
    head_name: string | null;
    clearance_items: string | null;
    status: string;
    items: string | null;
    notes: string | null;
    signed_by_name: string | null;
    signed_at: string | null;
  }>(
    `SELECT c.*, d.name AS dept, d.head_employee_id, d.clearance_items, e.full_name AS head_name FROM clearance_signatures c
       JOIN departments d ON d.id = c.department_id LEFT JOIN employees e ON e.id = d.head_employee_id
      WHERE c.leave_request_id = ? ORDER BY d.sort_order, d.name`,
    leaveId,
  );
}
