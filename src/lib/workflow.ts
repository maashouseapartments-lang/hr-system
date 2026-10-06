import "server-only";
import { all, run } from "./db";
import type { Role, SessionUser } from "./auth";

export type EntityType = "leave" | "violation" | "overtime" | "performance" | "employee";

export function logEvent(
  entity: EntityType,
  id: number,
  stage: string,
  action: string,
  user: SessionUser | null,
  note?: string | null,
) {
  run(
    "INSERT INTO workflow_events(entity_type, entity_id, stage, action, note, user_id, user_name) VALUES (?,?,?,?,?,?,?)",
    entity,
    id,
    stage,
    action,
    note || null,
    user?.id ?? null,
    user?.display_name ?? "النظام",
  );
}

export type WfEvent = {
  id: number;
  stage: string;
  action: string;
  note: string | null;
  user_name: string | null;
  created_at: string;
};

export const eventsFor = (entity: EntityType, id: number) =>
  all<WfEvent>("SELECT * FROM workflow_events WHERE entity_type = ? AND entity_id = ? ORDER BY id", entity, id);

/** إشعار لمستخدم محدد أو لمجموعة أدوار */
export function notify(opts: {
  userId?: number | null;
  roles?: Role[];
  employeeId?: number | null;
  title: string;
  body?: string;
  link?: string;
  level?: "info" | "warning" | "danger" | "success";
}) {
  let userId = opts.userId ?? null;
  if (!userId && opts.employeeId) {
    userId = all<{ id: number }>("SELECT id FROM users WHERE employee_id = ? AND active = 1", opts.employeeId)[0]?.id ?? null;
    if (!userId && !opts.roles) return;
  }
  run(
    "INSERT INTO notifications(user_id, roles, title, body, link, level) VALUES (?,?,?,?,?,?)",
    userId,
    opts.roles ? opts.roles.join(",") : null,
    opts.title,
    opts.body ?? null,
    opts.link ?? null,
    opts.level ?? "info",
  );
}

export function notificationsFor(u: SessionUser, limit = 30) {
  return all<{
    id: number;
    title: string;
    body: string | null;
    link: string | null;
    level: string;
    read_at: string | null;
    created_at: string;
  }>(
    `SELECT * FROM notifications
      WHERE user_id = ? OR (user_id IS NULL AND (',' || roles || ',') LIKE ?) OR (user_id IS NULL AND ? = 'admin' AND roles IS NOT NULL)
      ORDER BY id DESC LIMIT ?`,
    u.id,
    `%,${u.role},%`,
    u.role,
    limit,
  );
}
