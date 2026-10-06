import Link from "next/link";
import { Plus } from "lucide-react";
import { all } from "@/lib/db";
import { requireUser, isStaff } from "@/lib/auth";
import { teamIds } from "@/lib/permissions";
import { PERFORMANCE_STATUS } from "@/lib/labels";
import { num } from "@/lib/time";
import { Avatar, Card, Empty, PageHeader, StatusBadge } from "@/components/ui";

export default async function PerformancePage() {
  const u = await requireUser();
  const team = teamIds(u);
  const ids = isStaff(u) ? null : [...team, u.employee_id ?? 0];
  const rows = all<{ id: number; full_name: string; photo_file_id: number | null; period: string; total_score: number; rating: string; status: string; reviewer_name: string | null }>(
    `SELECT p.*, e.full_name, e.photo_file_id FROM performance_reviews p JOIN employees e ON e.id = p.employee_id
      ${ids ? `WHERE p.employee_id IN (${ids.join(",")})` : ""} ORDER BY p.id DESC LIMIT 300`,
  );
  const canCreate = isStaff(u) || team.length > 0;
  return (
    <>
      <PageHeader title="تقييم الأداء" actions={canCreate && <Link href="/performance/new" className="btn-primary"><Plus className="size-4" /> تقييم جديد</Link>} />
      <Card pad={false}>
        {rows.length ? (
          <table className="table">
            <thead><tr><th>الموظف</th><th>الفترة</th><th>الدرجة</th><th>التقدير</th><th>المقيّم</th><th>الحالة</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/performance/${r.id}`} className="flex items-center gap-2 font-bold hover:text-brand-700"><Avatar name={r.full_name} fileId={r.photo_file_id} size={30} />{r.full_name}</Link></td>
                <td>{r.period}</td>
                <td><div className="flex items-center gap-2"><div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-brand-500" style={{ width: `${r.total_score}%` }} /></div><b>{num(r.total_score, 1)}%</b></div></td>
                <td>{r.rating}</td><td>{r.reviewer_name}</td><td><StatusBadge map={PERFORMANCE_STATUS} value={r.status} /></td>
              </tr>
            ))}</tbody>
          </table>
        ) : <Empty title="لا توجد تقييمات بعد" />}
      </Card>
    </>
  );
}
