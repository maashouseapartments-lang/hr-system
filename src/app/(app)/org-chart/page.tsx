import Link from "next/link";
import { getCompany } from "@/lib/company";
import { all } from "@/lib/db";
import { requireUser, isHR } from "@/lib/auth";
import { Avatar, Card, Empty, PageHeader } from "@/components/ui";

type D = { id: number; name: string; parent_id: number | null; head_id: number | null; head_name: string | null; head_photo: number | null; head_title: string | null };
type E = { id: number; full_name: string; department_id: number; title: string | null; photo_file_id: number | null };

export default async function OrgChartPage({ searchParams }: { searchParams: Promise<{ people?: string }> }) {
  const u = await requireUser();
  const { people } = await searchParams;
  const company = getCompany();
  const depts = all<D>(
    `SELECT d.id, d.name, d.parent_id, e.id AS head_id, e.full_name AS head_name, e.photo_file_id AS head_photo, p.title AS head_title
       FROM departments d LEFT JOIN employees e ON e.id = d.head_employee_id LEFT JOIN positions p ON p.id = e.position_id ORDER BY d.sort_order, d.name`,
  );
  const emps = people
    ? all<E>("SELECT e.id, e.full_name, e.department_id, p.title, e.photo_file_id FROM employees e LEFT JOIN positions p ON p.id = e.position_id WHERE e.status != 'terminated' AND e.department_id IS NOT NULL ORDER BY e.full_name")
    : [];
  const counts = Object.fromEntries(all<{ d: number; c: number }>("SELECT department_id AS d, COUNT(*) AS c FROM employees WHERE status != 'terminated' GROUP BY department_id").map((r) => [r.d, r.c]));

  const Node = ({ d }: { d: D }) => {
    const kids = depts.filter((x) => x.parent_id === d.id);
    const members = emps.filter((e) => e.department_id === d.id && e.id !== d.head_id);
    return (
      <li>
        <div className="org-node">
          <div className="text-[15px] font-extrabold text-brand-800">{d.name}</div>
          {d.head_name ? (
            <div className="mt-2 flex items-center justify-center gap-2">
              <Avatar name={d.head_name} fileId={d.head_photo} size={30} />
              <div className="text-start">
                <div className="text-xs font-bold">{d.head_name}</div>
                <div className="text-[11px] text-slate-500">{d.head_title ?? "مدير القسم"}</div>
              </div>
            </div>
          ) : <div className="mt-1 text-xs text-amber-600">لم يُحدد مدير</div>}
          <div className="mt-2 text-[11px] text-slate-500">{counts[d.id] ?? 0} موظف</div>
          {members.length > 0 && (
            <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-start">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-1.5 text-[11.5px]"><Avatar name={m.full_name} fileId={m.photo_file_id} size={20} /> {m.full_name}</li>
              ))}
            </ul>
          )}
        </div>
        {kids.length > 0 && <ul>{kids.map((k) => <Node key={k.id} d={k} />)}</ul>}
      </li>
    );
  };

  const roots = depts.filter((d) => !d.parent_id);
  return (
    <>
      <PageHeader
        title="الهيكل التنظيمي"
        subtitle={company?.name_ar}
        actions={<>
          <Link href={people ? "/org-chart" : "?people=1"} className="btn-secondary">{people ? "إخفاء الموظفين" : "إظهار الموظفين"}</Link>
          {isHR(u) && <Link href="/settings/departments" className="btn-primary">تعديل الأقسام</Link>}
        </>}
      />
      <style>{`
        .org ul { display:flex; justify-content:center; padding-top:22px; position:relative; }
        .org li { list-style:none; position:relative; padding:22px 8px 0; display:flex; flex-direction:column; align-items:center; }
        .org li::before, .org li::after { content:''; position:absolute; top:0; right:50%; width:50%; height:22px; border-top:2px solid #a7f3da; }
        .org li::after { right:auto; left:50%; border-right:2px solid #a7f3da; }
        .org li:only-child::before, .org li:only-child::after { display:none; }
        .org li:only-child { padding-top:0; }
        .org li:first-child::before, .org li:last-child::after { border:0 none; }
        .org li:last-child::before { border-left:2px solid #a7f3da; border-radius:0 0 0 0; }
        .org ul ul::before { content:''; position:absolute; top:0; left:50%; height:22px; border-left:2px solid #a7f3da; }
        .org-node { background:#fff; border:1px solid #e2e8f0; border-top:4px solid #059673; border-radius:16px; padding:12px 14px; min-width:170px; text-align:center; box-shadow:0 1px 3px rgba(0,0,0,.05); }
      `}</style>
      <Card>
        {roots.length ? (
          <div className="org overflow-x-auto pb-6">
            <div className="flex justify-center">
              <div className="rounded-2xl bg-brand-700 px-8 py-3 text-lg font-extrabold text-white shadow">{company?.name_ar}</div>
            </div>
            <ul>{roots.map((d) => <Node key={d.id} d={d} />)}</ul>
          </div>
        ) : <Empty title="لا توجد أقسام بعد" />}
      </Card>
    </>
  );
}
