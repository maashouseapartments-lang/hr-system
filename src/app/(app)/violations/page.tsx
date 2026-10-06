import Link from "next/link";
import { Plus } from "lucide-react";
import { all } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { penaltyLabel } from "@/lib/hr";
import { myTasks } from "@/lib/tasks";
import { VIOLATION_STATUS } from "@/lib/labels";
import { fmtDate, money } from "@/lib/time";
import { Avatar, Card, Empty, PageHeader, StatusBadge, Tabs } from "@/components/ui";

export default async function ViolationsPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string }> }) {
  const u = await requireRole("hr", "gm");
  const sp = await searchParams;
  const tasks = myTasks(u).filter((t) => t.kind === "violation").map((t) => t.id);
  const view = sp.view ?? (tasks.length ? "mine" : "all");
  const where: string[] = [];
  const params: unknown[] = [];
  if (view === "mine") where.push(`v.id IN (${tasks.join(",") || 0})`);
  if (view === "applied") where.push("v.status = 'applied'");
  if (sp.q) { where.push("(e.full_name LIKE ? OR v.ref_no LIKE ?)"); params.push(`%${sp.q}%`, `%${sp.q}%`); }
  const rows = all<{ id: number; ref_no: string; full_name: string; photo_file_id: number | null; incident_date: string; description: string; status: string; penalty_code: string | null; deduction_amount: number | null; code: string | null }>(
    `SELECT v.*, e.full_name, e.photo_file_id, vt.code FROM violations v JOIN employees e ON e.id = v.employee_id LEFT JOIN violation_types vt ON vt.id = v.violation_type_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY v.id DESC LIMIT 300`,
    ...params,
  );
  return (
    <>
      <PageHeader title="المخالفات والجزاءات" subtitle="تحقيق ← إفادة ← تحديد البند ← اعتماد وتطبيق" actions={<Link href="/violations/new" className="btn-primary"><Plus className="size-4" /> تسجيل مخالفة</Link>} />
      <Tabs active={view} tabs={[{ key: "mine", label: "بانتظار إجرائي", href: "?view=mine", count: tasks.length }, { key: "applied", label: "المطبقة", href: "?view=applied" }, { key: "all", label: "الكل", href: "?view=all" }]} />
      <Card pad={false}>
        <form className="border-b border-slate-100 p-4"><input type="hidden" name="view" value={view} /><input name="q" defaultValue={sp.q} className="input max-w-sm" placeholder="بحث بالاسم أو الرقم" /></form>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>الرقم</th><th>الموظف</th><th>التاريخ</th><th>الوصف</th><th>البند</th><th>الجزاء</th><th>الخصم</th><th>الحالة</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/violations/${r.id}`} className="font-bold text-brand-700 hover:underline">{r.ref_no}</Link></td>
                  <td><div className="flex items-center gap-2"><Avatar name={r.full_name} fileId={r.photo_file_id} size={30} />{r.full_name}</div></td>
                  <td className="whitespace-nowrap">{fmtDate(r.incident_date)}</td>
                  <td className="max-w-xs truncate">{r.description}</td>
                  <td>{r.code ?? "—"}</td>
                  <td className="text-xs">{penaltyLabel(r.penalty_code)}</td>
                  <td>{r.deduction_amount ? money(r.deduction_amount) : "—"}</td>
                  <td><StatusBadge map={VIOLATION_STATUS} value={r.status} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <Empty title="لا توجد مخالفات" />}
      </Card>
    </>
  );
}
