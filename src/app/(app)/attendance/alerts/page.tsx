import { all } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fmtDateTime } from "@/lib/time";
import { Alert, Badge, Card, Empty, PageHeader } from "@/components/ui";
import { resolveAlert } from "../actions";

type A = { id: number; device_id: string; employee_id: number; full_name: string; other_employee_ids: string; action: string; blocked: number; user_agent: string | null; resolved: number; resolution_note: string | null; created_at: string };

export default async function AlertsPage() {
  await requireRole("hr");
  const alerts = all<A>("SELECT a.*, e.full_name FROM device_alerts a JOIN employees e ON e.id = a.employee_id ORDER BY a.resolved, a.id DESC LIMIT 200");
  const names = Object.fromEntries(all<{ id: number; full_name: string }>("SELECT id, full_name FROM employees").map((e) => [e.id, e.full_name]));
  return (
    <>
      <PageHeader title="تنبيهات الأجهزة المشتركة" subtitle="محاولات تسجيل حضور أو انصراف من جهاز سبق أن استخدمه موظف آخر" />
      <div className="mb-4">
        <Alert tone="amber">
          كل موظف يجب أن يسجل من جهازه الخاص. عند رصد جهاز مشترك يُرسل تنبيه هنا. يمكنك تسجيل مخالفة للموظف (البند B16) أو تصفير ارتباط الجهاز إن كان مبرراً (مثلاً: استبدال جوال).
        </Alert>
      </div>
      {alerts.length ? (
        <div className="space-y-3">
          {alerts.map((a) => (
            <div key={a.id} className={`card p-5 ${a.resolved ? "opacity-60" : "border-rose-200"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-bold">{a.full_name}</div>
                  <div className="text-sm text-slate-600">
                    حاول {a.action === "check_in" ? "تسجيل الحضور" : "تسجيل الانصراف"} من جهاز مسجل باسم:{" "}
                    <b>{a.other_employee_ids.split(",").map((id) => names[Number(id)] ?? id).join("، ")}</b>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">{fmtDateTime(a.created_at)} • <span dir="ltr">{a.user_agent?.slice(0, 90)}</span></div>
                  {a.resolution_note && <div className="mt-2 text-sm text-slate-600">✔ {a.resolution_note}</div>}
                </div>
                <div className="flex gap-2">{a.blocked ? <Badge tone="rose">تم المنع</Badge> : <Badge tone="amber">سُمح وتم التنبيه</Badge>}{a.resolved ? <Badge tone="slate">تمت المراجعة</Badge> : null}</div>
              </div>
              {!a.resolved && (
                <form action={resolveAlert} className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="device_id" value={a.device_id} />
                  <input name="note" className="input max-w-sm" placeholder="ملاحظة المراجعة" />
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="reset_device" className="accent-brand-600" /> تصفير ارتباط الجهاز</label>
                  <button className="btn-secondary btn-sm">تمت المراجعة</button>
                  <a href={`/violations/new?employee=${a.employee_id}`} className="btn-danger btn-sm">تسجيل مخالفة</a>
                </form>
              )}
            </div>
          ))}
        </div>
      ) : <Card><Empty title="لا توجد تنبيهات 👍" /></Card>}
    </>
  );
}
