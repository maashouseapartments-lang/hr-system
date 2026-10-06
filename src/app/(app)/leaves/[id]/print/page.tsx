import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { get } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canActLeave, canViewEmployee, leaveCtx } from "@/lib/permissions";
import { getEmployee, totalWage, type Eligibility } from "@/lib/hr";
import { clearanceRows, getLeave, getLeaveType, type SettlementLine } from "@/lib/leave";
import { eventsFor } from "@/lib/workflow";
import { fmtDate, fmtDateTime, money, num } from "@/lib/time";
import { PrintSheet, Signatures } from "@/components/print-sheet";

export default async function LeavePrint({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ doc?: string }> }) {
  const u = await requireUser();
  const id = Number((await params).id);
  const { doc = "request" } = await searchParams;
  const l = getLeave(id);
  const ctx = leaveCtx(id);
  if (!l || !ctx) notFound();
  if (!canViewEmployee(u, l.employee_id) && !canActLeave(u, ctx)) redirect("/leaves");
  const e = getEmployee(l.employee_id)!;
  const lt = getLeaveType(l.leave_type_id);
  const info = get<{ dept: string | null; position: string | null; manager: string | null; head: string | null }>(
    `SELECT d.name AS dept, p.title AS position, m.full_name AS manager, h.full_name AS head FROM employees e
       LEFT JOIN departments d ON d.id = e.department_id LEFT JOIN positions p ON p.id = e.position_id
       LEFT JOIN employees m ON m.id = e.manager_id LEFT JOIN employees h ON h.id = d.head_employee_id WHERE e.id = ?`,
    e.id,
  )!;
  const events = eventsFor("leave", id);
  const signedAt = (match: RegExp) => {
    const ev = events.find((x) => match.test(x.action));
    return ev ? { name: ev.user_name, date: fmtDateTime(ev.created_at), signed: true } : {};
  };
  const back = <Link href={`/leaves/${id}`} className="btn-secondary">→ رجوع للطلب</Link>;
  const empTable = (
    <table className="doc mb-5">
      <tbody>
        <tr><th>اسم الموظف</th><td>{e.full_name}</td><th>الرقم الوظيفي</th><td>{e.employee_no}</td></tr>
        <tr><th>القسم</th><td>{info.dept ?? "—"}</td><th>المسمى</th><td>{info.position ?? "—"}</td></tr>
        <tr><th>رقم الهوية</th><td>{e.national_id ?? "—"}</td><th>الجنسية</th><td>{e.nationality ?? "—"}</td></tr>
        <tr><th>تاريخ المباشرة</th><td>{fmtDate(e.hire_date)}</td><th>الجوال</th><td>{e.phone ?? "—"}</td></tr>
      </tbody>
    </table>
  );

  if (doc === "clearance") {
    const rows = clearanceRows(id);
    return (
      <PrintSheet title="نموذج إخلاء طرف (تسليم العهد)" refNo={l.ref_no} back={back}>
        {empTable}
        <p className="mb-4">نفيدكم بأن الموظف المذكور أعلاه سيتمتع بـ{lt?.name ?? "إجازة"} من {fmtDate(l.start_date)} إلى {fmtDate(l.end_date)}، نأمل التكرم بالتأكد من استلام العهد التي بحوزته والتوقيع.</p>
        <table className="doc">
          <thead><tr><th style={{ width: "22%" }}>القسم</th><th>العهد</th><th style={{ width: "16%" }}>الحالة</th><th style={{ width: "26%" }}>الاسم والتوقيع</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id} style={{ height: 52 }}>
              <td className="font-bold">{r.dept}</td>
              <td>{r.items ?? r.clearance_items ?? ""}</td>
              <td>{r.status === "cleared" ? "✔ تم الاستلام" : r.status === "has_custody" ? "عهدة لم تُسلّم" : ""}</td>
              <td>{r.signed_by_name ? `${r.signed_by_name} — ${fmtDateTime(r.signed_at)}` : ""}</td>
            </tr>
          ))}</tbody>
        </table>
        <Signatures items={[{ role: "الموارد البشرية" }, { role: "المدير الإداري", ...signedAt(/توقيع المدير الإداري/) }, { role: "الموظف", name: e.full_name }]} />
      </PrintSheet>
    );
  }

  if (doc === "settlement") {
    const lines: SettlementLine[] = l.settlement_json ? JSON.parse(l.settlement_json) : [];
    return (
      <PrintSheet title="تسوية مستحقات إجازة" refNo={l.ref_no} back={back}>
        {empTable}
        <table className="doc mb-5">
          <tbody>
            <tr><th>نوع الإجازة</th><td>{lt?.name}</td><th>عدد الأيام</th><td>{l.days}</td></tr>
            <tr><th>من</th><td>{fmtDate(l.start_date)}</td><th>إلى</th><td>{fmtDate(l.end_date)}</td></tr>
            <tr><th>الراتب الأساسي</th><td>{money(e.basic_salary)}</td><th>إجمالي الراتب</th><td>{money(totalWage(e))}</td></tr>
            <tr><th>البنك</th><td>{e.bank_name ?? "—"}</td><th>الآيبان</th><td dir="ltr">{e.iban ?? "—"}</td></tr>
          </tbody>
        </table>
        <table className="doc">
          <thead><tr><th style={{ width: "60%" }}>البند</th><th>استحقاق</th><th>خصم</th></tr></thead>
          <tbody>
            {lines.map((x, i) => <tr key={i}><td>{x.label}</td><td>{x.kind === "addition" ? money(x.amount) : ""}</td><td>{x.kind === "deduction" ? money(x.amount) : ""}</td></tr>)}
            <tr><th>صافي المستحقات</th><td colSpan={2} className="text-base font-extrabold">{money(l.settlement_total)}</td></tr>
          </tbody>
        </table>
        <p className="mt-5">أقر أنا الموظف الموقع أدناه بأنني استلمت/سأستلم المبلغ الموضح أعلاه، وأنه يمثل كامل مستحقاتي حتى تاريخ بداية الإجازة.</p>
        <Signatures items={[
          { role: "إعداد: الموارد البشرية", ...signedAt(/إعداد تسوية/) },
          { role: "اعتماد: المدير الإداري", ...signedAt(/اعتماد تسوية/) },
          { role: "الموظف", name: e.full_name, ...signedAt(/توقيع الموظف/) },
          { role: "القسم المالي", ...signedAt(/تحويل المستحقات/) },
        ]} />
      </PrintSheet>
    );
  }

  const elig: Eligibility | null = l.eligibility_snapshot ? JSON.parse(l.eligibility_snapshot) : null;
  return (
    <PrintSheet title={`نموذج طلب ${lt?.name ?? "إجازة"}`} refNo={l.ref_no} date={l.created_at.slice(0, 10)} back={back}>
      {empTable}
      <table className="doc mb-5">
        <tbody>
          <tr><th>نوع الإجازة</th><td>{lt?.name ?? "—"}</td><th>عدد الأيام</th><td>{l.days} يوم</td></tr>
          <tr><th>من تاريخ</th><td>{fmtDate(l.start_date)}</td><th>إلى تاريخ</th><td>{fmtDate(l.end_date)}</td></tr>
          <tr><th>تاريخ العودة</th><td>{fmtDate(l.return_date)}</td><th>الوجهة</th><td>{l.destination ?? "—"}</td></tr>
          <tr><th>تأشيرة خروج وعودة</th><td>{l.needs_visa ? (l.visa_number ?? "نعم") : "لا"}</td><th>البديل</th><td>{l.substitute_employee_id ? getEmployee(l.substitute_employee_id)?.full_name : "—"}</td></tr>
          {elig && <tr><th>الرصيد قبل الإجازة</th><td>{num(elig.balance, 1)} يوم</td><th>آخر إجازة</th><td>{elig.lastLeaveReturn ? fmtDate(elig.lastLeaveReturn) : "—"}</td></tr>}
          {l.reason && <tr><th>السبب</th><td colSpan={3}>{l.reason}</td></tr>}
        </tbody>
      </table>
      <Signatures items={[
        { role: "الموظف", name: e.full_name },
        { role: "الموارد البشرية", ...signedAt(/إصدار طلب/) },
        { role: "المدير المباشر", name: info.manager, ...signedAt(/المدير المباشر/) },
        { role: "مدير القسم", name: info.head, ...signedAt(/مدير القسم/) },
        { role: "المدير الإداري", ...signedAt(/توقيع المدير الإداري/) },
      ]} />
    </PrintSheet>
  );
}
