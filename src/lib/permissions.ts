import "server-only";
import { all, get } from "./db";
import { isFinance, isGM, isHR, type SessionUser } from "./auth";

export type LeaveCtx = {
  id: number;
  status: string;
  employee_id: number;
  emp_manager_id: number | null;
  emp_department_id: number | null;
  dept_head_id: number | null;
};

export const leaveCtx = (id: number) =>
  get<LeaveCtx>(
    `SELECT lr.id, lr.status, lr.employee_id, e.manager_id AS emp_manager_id, e.department_id AS emp_department_id,
            d.head_employee_id AS dept_head_id
       FROM leave_requests lr JOIN employees e ON e.id = lr.employee_id
       LEFT JOIN departments d ON d.id = e.department_id WHERE lr.id = ?`,
    id,
  );

/** من يحق له التصرف في المرحلة الحالية من طلب الإجازة */
export function canActLeave(u: SessionUser, l: LeaveCtx): boolean {
  if (u.role === "admin") return !["completed", "rejected", "cancelled"].includes(l.status);
  switch (l.status) {
    case "hr_review":
    case "settlement":
    case "visa":
    case "hr_archive":
      return isHR(u);
    case "direct_manager":
      return !!u.employee_id && u.employee_id === l.emp_manager_id;
    case "dept_manager":
      return !!u.employee_id && u.employee_id === l.dept_head_id;
    case "substitute":
      return isHR(u) || (!!u.employee_id && (u.employee_id === l.dept_head_id || u.employee_id === l.emp_manager_id));
    case "clearance":
      return isHR(u) || clearanceDeptsFor(u, l.id).length > 0;
    case "gm_signature":
    case "settlement_gm":
      return isGM(u);
    case "employee_sign":
      return isHR(u) || u.employee_id === l.employee_id;
    case "finance":
      return isFinance(u);
    default:
      return false;
  }
}

/** أقسام إخلاء الطرف التي يرأسها المستخدم ولم توقّع بعد */
export function clearanceDeptsFor(u: SessionUser, leaveId: number) {
  if (!u.headed_departments.length) return [];
  return all<{ department_id: number }>(
    `SELECT department_id FROM clearance_signatures WHERE leave_request_id = ? AND status = 'pending'
       AND department_id IN (${u.headed_departments.map(() => "?").join(",")})`,
    leaveId,
    ...u.headed_departments,
  ).map((r) => r.department_id);
}

/** هل يحق للمستخدم رؤية بيانات هذا الموظف */
export function canViewEmployee(u: SessionUser, employeeId: number) {
  if (u.role !== "employee") return true;
  if (u.employee_id === employeeId) return true;
  return teamIds(u).includes(employeeId);
}

/** الموظفون تحت إدارة المستخدم (مباشرة أو عبر رئاسة القسم) */
export function teamIds(u: SessionUser): number[] {
  if (!u.employee_id) return [];
  const rows = all<{ id: number }>(
    `SELECT id FROM employees WHERE manager_id = ?
     ${u.headed_departments.length ? `OR department_id IN (${u.headed_departments.map(() => "?").join(",")})` : ""}`,
    u.employee_id,
    ...u.headed_departments,
  );
  return rows.map((r) => r.id).filter((id) => id !== u.employee_id);
}
