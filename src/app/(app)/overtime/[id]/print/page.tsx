import Link from "next/link";
import { notFound } from "next/navigation";
import { all, get } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { durationLabel, fmtDate, money, time12 } from "@/lib/time";
import { PrintSheet, Signatures } from "@/components/print-sheet";

export default async function OvertimePrint({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = Number((await params).id);
  const o = get<{ ref_no: string; work_date: string; start_time: string; end_time: string; reason: string; requested_by_name: string | null; dept: string | null; created_at: string }>(
    "SELECT o.*, d.name AS dept FROM overtime_requests o LEFT JOIN departments d ON d.id = o.department_id WHERE o.id = ?",
    id,
  );
  if (!o) notFound();
  const rows = all<{ full_name: string; employee_no: string; planned_minutes: number; actual_minutes: number | null; amount: number }>(
    "SELECT a.*, e.full_name, e.employee_no FROM overtime_assignments a JOIN employees e ON e.id = a.employee_id WHERE a.overtime_id = ?",
    id,
  );
  return (
    <PrintSheet title="تكليف بعمل إضافي" refNo={o.ref_no} date={o.created_at.slice(0, 10)} back={<Link href={`/overtime/${id}`} className="btn-secondary">→ رجوع</Link>}>
      <table className="doc mb-5"><tbody>
        <tr><th>القسم الطالب</th><td>{o.dept ?? "—"}</td><th>مقدم الطلب</th><td>{o.requested_by_name ?? "—"}</td></tr>
        <tr><th>التاريخ</th><td>{fmtDate(o.work_date)}</td><th>الوقت</th><td>{time12(o.start_time)} - {time12(o.end_time)}</td></tr>
        <tr><th>السبب</th><td colSpan={3}>{o.reason}</td></tr>
      </tbody></table>
      <table className="doc">
        <thead><tr><th>م</th><th>الموظف</th><th>الرقم</th><th>المدة</th><th>الأجر الإضافي</th><th>توقيع الموظف</th></tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i} style={{ height: 40 }}><td>{i + 1}</td><td>{r.full_name}</td><td>{r.employee_no}</td><td>{durationLabel(r.actual_minutes ?? r.planned_minutes)}</td><td>{money(r.amount)}</td><td /></tr>
        ))}</tbody>
      </table>
      <p className="mt-4 text-xs text-slate-600">يُحتسب الأجر الإضافي وفق المادة 107 من نظام العمل: أجر الساعة مضافاً إليه 50% من أجر الساعة الأساسي.</p>
      <Signatures items={[{ role: "مدير القسم", name: o.requested_by_name }, { role: "الموارد البشرية" }, { role: "المدير الإداري" }]} />
    </PrintSheet>
  );
}
