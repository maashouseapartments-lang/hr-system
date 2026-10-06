import Link from "next/link";
import { Plus } from "lucide-react";
import { all } from "@/lib/db";
import { requireUser, isStaff } from "@/lib/auth";
import { teamIds } from "@/lib/permissions";
import { myTasks } from "@/lib/tasks";
import { LEAVE_STATUS } from "@/lib/labels";
import { fmtDate } from "@/lib/time";
import { Avatar, Card, Empty, PageHeader, StatusBadge, Tabs } from "@/components/ui";

type Row = { id: number; ref_no: string; full_name: string; photo_file_id: number | null; employee_id: number; type: string | null; start_date: string; end_date: string; days: number; status: string; dept: string | null };

export default async function LeavesPage({ searchParams }: { searchParams: Promise<{ view?: string; status?: string; q?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const tasks = myTasks(u).filter((t) => t.kind === "leave").map((t) => t.id);
  const view = sp.view ?? (tasks.length ? "mine" : "all");
  const where: string[] = [];
  const params: unknown[] = [];
  if (!isStaff(u)) {
    const ids = [...teamIds(u), u.employee_id ?? 0];
    where.push(`(lr.employee_id IN (${ids.join(",")}) OR lr.id IN (${tasks.join(",") || 0}))`);
  }
  if (view === "mine") where.push(`lr.id IN (${tasks.join(",") || 0})`);
  if (view === "open") where.push("lr.status NOT IN ('completed','rejected','cancelled')");
  if (sp.status) { where.push("lr.status = ?"); params.push(sp.status); }
  if (sp.q) { where.push("(e.full_name LIKE ? OR lr.ref_no LIKE ?)"); params.push(`%${sp.q}%`, `%${sp.q}%`); }
  const rows = all<Row>(
    `SELECT lr.id, lr.ref_no, lr.employee_id, lr.start_date, lr.end_date, lr.days, lr.status, e.full_name, e.photo_file_id, lt.name AS type, d.name AS dept
       FROM leave_requests lr JOIN employees e ON e.id = lr.employee_id LEFT JOIN leave_types lt ON lt.id = lr.leave_type_id
       LEFT JOIN departments d ON d.id = e.department_id ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY lr.id DESC LIMIT 300`,
    ...params,
  );
  return (
    <>
      <PageHeader title="الإجازات" subtitle="كل طلب يمر بمراحل واضحة حتى الأرشفة" actions={<Link href="/leaves/new" className="btn-primary"><Plus className="size-4" /> طلب إجازة</Link>} />
      <Tabs
        active={view}
        tabs={[
          { key: "mine", label: "بانتظار إجرائي", href: "?view=mine", count: tasks.length },
          { key: "open", label: "قيد الإجراء", href: "?view=open" },
          { key: "all", label: "كل الطلبات", href: "?view=all" },
        ]}
      />
      <Card pad={false}>
        <form className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <input type="hidden" name="view" value={view} />
          <input name="q" defaultValue={sp.q} className="input max-w-xs" placeholder="بحث بالاسم أو رقم الطلب" />
          <select name="status" defaultValue={sp.status} className="input w-auto">
            <option value="">كل الحالات</option>{Object.entries(LEAVE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button className="btn-secondary">تصفية</button>
        </form>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>رقم الطلب</th><th>الموظف</th><th>القسم</th><th>النوع</th><th>من</th><th>إلى</th><th>الأيام</th><th>المرحلة الحالية</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/leaves/${r.id}`} className="font-bold text-brand-700 hover:underline">{r.ref_no}</Link></td>
                  <td><div className="flex items-center gap-2"><Avatar name={r.full_name} fileId={r.photo_file_id} size={30} /> {r.full_name}</div></td>
                  <td>{r.dept ?? "—"}</td><td>{r.type ?? "يحدد لاحقاً"}</td>
                  <td className="whitespace-nowrap">{fmtDate(r.start_date)}</td><td className="whitespace-nowrap">{fmtDate(r.end_date)}</td>
                  <td className="font-bold">{r.days}</td>
                  <td><StatusBadge map={LEAVE_STATUS} value={r.status} />{tasks.includes(r.id) && <span className="ms-2 inline-block size-2 rounded-full bg-amber-500" title="بانتظار إجرائك" />}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <Empty title={view === "mine" ? "لا توجد طلبات بانتظار إجرائك 🎉" : "لا توجد طلبات"} />}
      </Card>
    </>
  );
}
