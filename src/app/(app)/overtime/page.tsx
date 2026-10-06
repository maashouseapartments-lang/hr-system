import Link from "next/link";
import { Plus } from "lucide-react";
import { all } from "@/lib/db";
import { requireUser, isStaff } from "@/lib/auth";
import { OVERTIME_STATUS } from "@/lib/labels";
import { fmtDate, time12, money } from "@/lib/time";
import { Alert, Card, Empty, PageHeader, StatusBadge } from "@/components/ui";

export default async function OvertimePage() {
  const u = await requireUser();
  const mine = !isStaff(u);
  const rows = all<{ id: number; ref_no: string; dept: string | null; work_date: string; start_time: string; end_time: string; status: string; reason: string; emp_count: number; total: number }>(
    `SELECT o.*, d.name AS dept, (SELECT COUNT(*) FROM overtime_assignments a WHERE a.overtime_id = o.id) AS emp_count,
            (SELECT COALESCE(SUM(amount),0) FROM overtime_assignments a WHERE a.overtime_id = o.id) AS total
       FROM overtime_requests o LEFT JOIN departments d ON d.id = o.department_id
      ${mine ? "WHERE o.created_by = ? OR o.id IN (SELECT overtime_id FROM overtime_assignments WHERE employee_id = ?)" : ""}
      ORDER BY o.work_date DESC, o.id DESC LIMIT 300`,
    ...(mine ? [u.id, u.employee_id ?? 0] : []),
  );
  return (
    <>
      <PageHeader title="العمل الإضافي" subtitle="بطلب معتمد من القسم فقط — الخروج المتأخر لا يُحتسب عملاً إضافياً" actions={<Link href="/overtime/new" className="btn-primary"><Plus className="size-4" /> طلب عمل إضافي</Link>} />
      <div className="mb-4"><Alert tone="sky">يُحتسب أجر العمل الإضافي وفق المادة 107: <b>أجر الساعة + 50% من أجر الساعة الأساسي</b> لكل ساعة عمل إضافية.</Alert></div>
      <Card pad={false}>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>الرقم</th><th>القسم</th><th>التاريخ</th><th>الوقت</th><th>السبب</th><th>الموظفون</th><th>الإجمالي</th><th>الحالة</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/overtime/${r.id}`} className="font-bold text-brand-700 hover:underline">{r.ref_no}</Link></td>
                  <td>{r.dept ?? "—"}</td><td className="whitespace-nowrap">{fmtDate(r.work_date)}</td>
                  <td className="whitespace-nowrap">{time12(r.start_time)} ← {time12(r.end_time)}</td>
                  <td className="max-w-xs truncate">{r.reason}</td><td>{r.emp_count}</td><td>{r.total ? money(r.total) : "—"}</td>
                  <td><StatusBadge map={OVERTIME_STATUS} value={r.status} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <Empty title="لا توجد طلبات عمل إضافي" />}
      </Card>
    </>
  );
}
