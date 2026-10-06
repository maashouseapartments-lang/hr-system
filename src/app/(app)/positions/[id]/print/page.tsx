import Link from "next/link";
import { notFound } from "next/navigation";
import { get } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PrintSheet, Signatures } from "@/components/print-sheet";

export default async function PositionPrint({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const p = get<Record<string, string | null>>(
    "SELECT p.*, d.name AS dept, r.title AS reports_to FROM positions p LEFT JOIN departments d ON d.id = p.department_id LEFT JOIN positions r ON r.id = p.reports_to_position_id WHERE p.id = ?",
    Number((await params).id),
  );
  if (!p) notFound();
  const sections: [string, string][] = [["summary", "الهدف العام للوظيفة"], ["duties", "المهام والمسؤوليات"], ["qualifications", "المؤهلات العلمية"], ["experience", "الخبرات"], ["skills", "المهارات"], ["kpis", "مؤشرات الأداء"], ["work_conditions", "ظروف العمل"]];
  return (
    <PrintSheet title="بطاقة الوصف الوظيفي" back={<Link href="/positions" className="btn-secondary">→ رجوع</Link>}>
      <table className="doc mb-6">
        <tbody>
          <tr><th>المسمى الوظيفي</th><td>{p.title}</td></tr>
          <tr><th>القسم</th><td>{p.dept ?? "—"}</td></tr>
          <tr><th>يرفع تقاريره إلى</th><td>{p.reports_to ?? "—"}</td></tr>
          <tr><th>الدرجة</th><td>{p.grade ?? "—"}</td></tr>
        </tbody>
      </table>
      {sections.filter(([k]) => p[k]).map(([k, label]) => (
        <section key={k} className="mb-5">
          <h2 className="mb-1 border-b border-slate-200 pb-1 font-bold text-brand-800">{label}</h2>
          <ul className="list-disc space-y-0.5 ps-6">
            {String(p[k]).split("\n").filter(Boolean).map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </section>
      ))}
      <Signatures items={[{ role: "الموظف" }, { role: "المدير المباشر" }, { role: "الموارد البشرية" }]} />
    </PrintSheet>
  );
}
