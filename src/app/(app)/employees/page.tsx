import Link from "next/link";
import { Plus, Search, FileText } from "lucide-react";
import { all } from "@/lib/db";
import { requireUser, isHR } from "@/lib/auth";
import { teamIds } from "@/lib/permissions";
import { EMPLOYEE_STATUS } from "@/lib/labels";
import { Avatar, Card, Empty, PageHeader, StatusBadge } from "@/components/ui";

type Row = { id: number; employee_no: string; full_name: string; photo_file_id: number | null; cv_file_id: number | null; status: string; dept: string | null; position: string | null; phone: string | null; nationality: string | null };

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ q?: string; dept?: string; status?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const where: string[] = [];
  const params: unknown[] = [];
  if (u.role === "employee") {
    const ids = teamIds(u);
    where.push(`e.id IN (${ids.length ? ids.join(",") : "0"})`);
  }
  if (sp.q) { where.push("(e.full_name LIKE ? OR e.employee_no LIKE ? OR e.national_id LIKE ? OR e.phone LIKE ?)"); params.push(...Array(4).fill(`%${sp.q}%`)); }
  if (sp.dept) { where.push("e.department_id = ?"); params.push(Number(sp.dept)); }
  if (sp.status) { where.push("e.status = ?"); params.push(sp.status); } else where.push("e.status != 'terminated'");
  const rows = all<Row>(
    `SELECT e.id, e.employee_no, e.full_name, e.photo_file_id, e.cv_file_id, e.status, e.phone, e.nationality, d.name AS dept, p.title AS position
       FROM employees e LEFT JOIN departments d ON d.id = e.department_id LEFT JOIN positions p ON p.id = e.position_id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY e.full_name`,
    ...params,
  );
  const depts = all<{ id: number; name: string }>("SELECT id, name FROM departments ORDER BY name");
  return (
    <>
      <PageHeader
        title={u.role === "employee" ? "فريقي" : "الموظفون"}
        subtitle={`${rows.length} موظف`}
        actions={isHR(u) && <Link href="/employees/new" className="btn-primary"><Plus className="size-4" /> إضافة موظف</Link>}
      />
      <Card pad={false}>
        <form className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <div className="relative min-w-60 flex-1">
            <Search className="absolute start-3 top-3 size-4 text-slate-400" />
            <input name="q" defaultValue={sp.q} className="input ps-9" placeholder="بحث بالاسم، الرقم الوظيفي، الهوية، الجوال…" />
          </div>
          <select name="dept" defaultValue={sp.dept} className="input w-auto">
            <option value="">كل الأقسام</option>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select name="status" defaultValue={sp.status} className="input w-auto">
            <option value="">على رأس العمل والإجازات</option>
            {Object.entries(EMPLOYEE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button className="btn-secondary">تصفية</button>
        </form>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>الموظف</th><th>الرقم</th><th>القسم</th><th>المسمى</th><th>الجنسية</th><th>الجوال</th><th>الحالة</th><th>السيرة</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/employees/${r.id}`} className="flex items-center gap-3 font-bold text-slate-800 hover:text-brand-700">
                        <Avatar name={r.full_name} fileId={r.photo_file_id} size={36} /> {r.full_name}
                      </Link>
                    </td>
                    <td className="font-mono text-xs">{r.employee_no}</td>
                    <td>{r.dept ?? "—"}</td>
                    <td>{r.position ?? "—"}</td>
                    <td>{r.nationality ?? "—"}</td>
                    <td dir="ltr" className="text-end">{r.phone ?? "—"}</td>
                    <td><StatusBadge map={EMPLOYEE_STATUS} value={r.status} /></td>
                    <td>{r.cv_file_id ? <a href={`/api/files/${r.cv_file_id}`} target="_blank" className="text-rose-600"><FileText className="size-5" /></a> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="لا يوجد موظفون">{isHR(u) && <Link href="/employees/new" className="font-bold text-brand-700">أضف أول موظف</Link>}</Empty>
        )}
      </Card>
    </>
  );
}
