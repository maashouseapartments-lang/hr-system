import Link from "next/link";
import { Download, Wallet, Clock, ShieldAlert, TrendingUp } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { payrollFor } from "@/lib/payroll";
import { today } from "@/lib/hr";
import { money } from "@/lib/time";
import { Alert, Card, Empty, PageHeader, Stat } from "@/components/ui";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireRole("hr", "gm", "finance");
  const { month = today().slice(0, 7) } = await searchParams;
  const rows = payrollFor(month);
  const sum = (k: keyof (typeof rows)[number]) => rows.reduce((s, r) => s + Number(r[k] || 0), 0);
  return (
    <>
      <PageHeader
        title="التقارير ومسير الرواتب"
        subtitle={`ملخص شهر ${month}`}
        actions={<>
          <form className="flex gap-2"><input type="month" name="month" defaultValue={month} className="input" /><button className="btn-secondary">عرض</button></form>
          <a href={`/api/reports/payroll?month=${month}`} className="btn-primary"><Download className="size-4" /> تصدير Excel (CSV)</a>
        </>}
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="إجمالي الرواتب" value={<span className="text-lg">{money(sum("gross"))}</span>} icon={<Wallet className="size-6" />} />
        <Stat label="خصومات الحضور" value={<span className="text-lg">{money(sum("attendance_deduction"))}</span>} icon={<Clock className="size-6" />} tone="amber" />
        <Stat label="خصومات المخالفات" value={<span className="text-lg">{money(sum("violation_deduction"))}</span>} icon={<ShieldAlert className="size-6" />} tone="rose" />
        <Stat label="العمل الإضافي" value={<span className="text-lg">{money(sum("overtime"))}</span>} icon={<TrendingUp className="size-6" />} tone="sky" />
      </div>
      <div className="mb-4"><Alert tone="sky">الأرقام محسوبة من سجلات الحضور (التأخير بالدقيقة بعد فترة السماح، والغياب)، والجزاءات المعتمدة، والعمل الإضافي المنفّذ. لا يشمل خصم التأمينات الاجتماعية.</Alert></div>
      <Card pad={false}>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>الموظف</th><th>القسم</th><th>الأساسي</th><th>البدلات</th><th>الإجمالي</th><th>تأخير (د)</th><th>غياب</th><th>خصم الحضور</th><th>خصم المخالفات</th><th>إضافي</th><th>الصافي</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><Link href={`/employees/${r.id}`} className="font-bold hover:text-brand-700">{r.full_name}</Link><div className="text-xs text-slate-400">{r.employee_no}</div></td>
                    <td>{r.dept ?? "—"}</td><td>{money(r.basic)}</td><td>{money(r.allowances)}</td><td>{money(r.gross)}</td>
                    <td className={r.late_minutes ? "text-amber-700" : "text-slate-400"}>{r.late_minutes}</td>
                    <td className={r.absent_days ? "text-rose-600" : "text-slate-400"}>{r.absent_days}</td>
                    <td className="text-rose-600">{r.attendance_deduction ? money(r.attendance_deduction) : "—"}</td>
                    <td className="text-rose-600">{r.violation_deduction ? money(r.violation_deduction) : "—"}</td>
                    <td className="text-brand-700">{r.overtime ? money(r.overtime) : "—"}</td>
                    <td className="font-extrabold">{money(r.net)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-extrabold">
                  <td colSpan={4}>الإجمالي ({rows.length} موظف)</td><td>{money(sum("gross"))}</td><td>{sum("late_minutes")}</td><td>{sum("absent_days")}</td>
                  <td>{money(sum("attendance_deduction"))}</td><td>{money(sum("violation_deduction"))}</td><td>{money(sum("overtime"))}</td><td>{money(sum("net"))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : <Empty title="لا يوجد موظفون" />}
      </Card>
    </>
  );
}
