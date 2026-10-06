import Link from "next/link";
import { notFound } from "next/navigation";
import { get } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getEmployee, penaltyLabel } from "@/lib/hr";
import { eventsFor } from "@/lib/workflow";
import { fmtDate, fmtDateTime, money } from "@/lib/time";
import { PrintSheet, Signatures } from "@/components/print-sheet";

export default async function ViolationPrint({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("hr", "gm");
  const id = Number((await params).id);
  const v = get<Record<string, string | number | null> & { employee_id: number; ref_no: string; violation_type_id: number | null }>("SELECT * FROM violations WHERE id = ?", id);
  if (!v) notFound();
  const e = getEmployee(v.employee_id)!;
  const vt = v.violation_type_id ? get<{ code: string; description: string }>("SELECT code, description FROM violation_types WHERE id = ?", v.violation_type_id) : undefined;
  const info = get<{ dept: string | null; position: string | null }>("SELECT d.name AS dept, p.title AS position FROM employees e LEFT JOIN departments d ON d.id = e.department_id LEFT JOIN positions p ON p.id = e.position_id WHERE e.id = ?", e.id)!;
  const events = eventsFor("violation", id);
  const approved = events.find((x) => /اعتماد القرار/.test(x.action));
  return (
    <PrintSheet title="محضر تحقيق وقرار جزاء" refNo={v.ref_no} date={String(v.created_at).slice(0, 10)} back={<Link href={`/violations/${id}`} className="btn-secondary">→ رجوع</Link>}>
      <table className="doc mb-5">
        <tbody>
          <tr><th>اسم الموظف</th><td>{e.full_name}</td><th>الرقم الوظيفي</th><td>{e.employee_no}</td></tr>
          <tr><th>القسم</th><td>{info.dept ?? "—"}</td><th>المسمى</th><td>{info.position ?? "—"}</td></tr>
          <tr><th>تاريخ المخالفة</th><td>{fmtDate(v.incident_date as string)} {v.incident_time ?? ""}</td><th>المكان</th><td>{v.incident_place ?? "—"}</td></tr>
        </tbody>
      </table>
      <h2 className="mb-1 font-bold text-brand-800">أولاً: وقائع المخالفة</h2>
      <p className="mb-4 whitespace-pre-wrap">{v.description}</p>
      {v.evidence_notes && <><h2 className="mb-1 font-bold text-brand-800">ثانياً: الأدلة</h2><p className="mb-4 whitespace-pre-wrap">{v.evidence_notes}</p></>}
      <h2 className="mb-1 font-bold text-brand-800">ثالثاً: إفادة الموظف</h2>
      <div className="mb-4 min-h-24 rounded border border-slate-300 p-3">
        {v.statement_mode === "given" && <p className="whitespace-pre-wrap">{v.employee_statement}</p>}
        {v.statement_mode === "refused" && <p>امتنع الموظف عن الإدلاء بإفادته / التوقيع، وذلك بحضور الشاهدين: <b>{v.witness1_name}</b> ({v.witness1_id ?? "—"}) و <b>{v.witness2_name}</b> ({v.witness2_id ?? "—"}).</p>}
        {v.statement_mode === "absent" && <p>تعذر سماع إفادة الموظف لتغيبه وعدم رده على المراسلات: {v.absence_notes}</p>}
      </div>
      {vt && (
        <>
          <h2 className="mb-1 font-bold text-brand-800">رابعاً: القرار</h2>
          <table className="doc mb-4">
            <tbody>
              <tr><th>البند المنطبق</th><td>{vt.code} — {vt.description}</td></tr>
              <tr><th>مرات التكرار</th><td>المرة {v.occurrence}</td></tr>
              <tr><th>الجزاء</th><td className="font-bold">{penaltyLabel(v.penalty_code as string)}</td></tr>
              <tr><th>مبلغ الحسم</th><td>{money(v.deduction_amount as number)}</td></tr>
              {v.decision_notes && <tr><th>المسوغات</th><td>{v.decision_notes}</td></tr>}
            </tbody>
          </table>
        </>
      )}
      {v.statement_mode === "refused" ? (
        <Signatures items={[{ role: "المحقق (الموارد البشرية)" }, { role: "الشاهد الأول", name: v.witness1_name as string }, { role: "الشاهد الثاني", name: v.witness2_name as string }, { role: "المدير الإداري", name: approved?.user_name, date: approved ? fmtDateTime(approved.created_at) : null, signed: !!approved }]} />
      ) : (
        <Signatures items={[{ role: "الموظف", name: e.full_name }, { role: "المحقق (الموارد البشرية)" }, { role: "المدير الإداري", name: approved?.user_name, date: approved ? fmtDateTime(approved.created_at) : null, signed: !!approved }]} />
      )}
    </PrintSheet>
  );
}
