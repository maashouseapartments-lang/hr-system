import "server-only";
import { all } from "./db";
import { isGM, isHR, type SessionUser } from "./auth";
import { canActLeave, type LeaveCtx } from "./permissions";
import { LEAVE_STATUS, VIOLATION_STATUS, OVERTIME_STATUS } from "./labels";

export type Task = {
  kind: "leave" | "violation" | "overtime" | "performance" | "device";
  id: number;
  title: string;
  subtitle: string;
  stage: string;
  href: string;
  created_at: string;
};

/** صندوق المهام: كل معاملة تنتظر إجراء من المستخدم الحالي */
export function myTasks(u: SessionUser): Task[] {
  const tasks: Task[] = [];

  const leaves = all<LeaveCtx & { ref_no: string; full_name: string; type_name: string; updated_at: string }>(
    `SELECT lr.id, lr.status, lr.employee_id, lr.ref_no, lr.updated_at, e.full_name, e.manager_id AS emp_manager_id,
            e.department_id AS emp_department_id, d.head_employee_id AS dept_head_id, lt.name AS type_name
       FROM leave_requests lr JOIN employees e ON e.id = lr.employee_id
       LEFT JOIN departments d ON d.id = e.department_id LEFT JOIN leave_types lt ON lt.id = lr.leave_type_id
      WHERE lr.status NOT IN ('completed','rejected','cancelled') ORDER BY lr.updated_at`,
  );
  for (const l of leaves) {
    if (canActLeave(u, l))
      tasks.push({
        kind: "leave",
        id: l.id,
        title: `${l.type_name ?? "إجازة"} — ${l.full_name}`,
        subtitle: l.ref_no,
        stage: LEAVE_STATUS[l.status]?.label ?? l.status,
        href: `/leaves/${l.id}`,
        created_at: l.updated_at,
      });
  }

  if (isHR(u) || isGM(u)) {
    const statuses = [...(isHR(u) ? ["investigation", "statement", "decision"] : []), ...(isGM(u) ? ["approval"] : [])];
    const vs = all<{ id: number; ref_no: string; status: string; full_name: string; updated_at: string }>(
      `SELECT v.id, v.ref_no, v.status, v.updated_at, e.full_name FROM violations v JOIN employees e ON e.id = v.employee_id
        WHERE v.status IN (${statuses.map(() => "?").join(",")}) ORDER BY v.updated_at`,
      ...statuses,
    );
    for (const v of vs)
      tasks.push({
        kind: "violation",
        id: v.id,
        title: `مخالفة — ${v.full_name}`,
        subtitle: v.ref_no,
        stage: VIOLATION_STATUS[v.status].label,
        href: `/violations/${v.id}`,
        created_at: v.updated_at,
      });

    const otStatuses = [...(isGM(u) || isHR(u) ? ["pending"] : []), ...(isHR(u) ? ["approved", "assigned"] : [])];
    const ots = all<{ id: number; ref_no: string; status: string; dept: string | null; work_date: string; updated_at: string }>(
      `SELECT o.id, o.ref_no, o.status, o.work_date, o.updated_at, d.name AS dept FROM overtime_requests o
         LEFT JOIN departments d ON d.id = o.department_id WHERE o.status IN (${otStatuses.map(() => "?").join(",")})`,
      ...otStatuses,
    );
    for (const o of ots)
      tasks.push({
        kind: "overtime",
        id: o.id,
        title: `عمل إضافي — ${o.dept ?? ""} (${o.work_date})`,
        subtitle: o.ref_no,
        stage: OVERTIME_STATUS[o.status].label,
        href: `/overtime/${o.id}`,
        created_at: o.updated_at,
      });

    const alerts = all<{ id: number; full_name: string; created_at: string }>(
      `SELECT a.id, e.full_name, a.created_at FROM device_alerts a JOIN employees e ON e.id = a.employee_id WHERE a.resolved = 0`,
    );
    for (const a of alerts)
      tasks.push({
        kind: "device",
        id: a.id,
        title: `تنبيه جهاز مشترك — ${a.full_name}`,
        subtitle: "تسجيل حضور من جهاز موظف آخر",
        stage: "بحاجة لمراجعة",
        href: `/attendance/alerts`,
        created_at: a.created_at,
      });
  }

  if (u.employee_id) {
    const prs = all<{ id: number; period: string; created_at: string }>(
      "SELECT id, period, created_at FROM performance_reviews WHERE employee_id = ? AND status = 'submitted'",
      u.employee_id,
    );
    for (const p of prs)
      tasks.push({
        kind: "performance",
        id: p.id,
        title: `تقييم أدائك — ${p.period}`,
        subtitle: "اطلع على التقييم وأضف ملاحظتك",
        stage: "بانتظار اطلاعك",
        href: `/performance/${p.id}`,
        created_at: p.created_at,
      });
  }

  return tasks;
}
