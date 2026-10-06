import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { payrollFor } from "@/lib/payroll";

export async function GET(req: NextRequest) {
  const u = await getUser();
  if (!u || u.role === "employee") return new NextResponse("غير مصرح", { status: 403 });
  const month = req.nextUrl.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  const rows = payrollFor(month);
  const head = ["الرقم الوظيفي", "الاسم", "القسم", "الآيبان", "الأساسي", "البدلات", "الإجمالي", "دقائق التأخير والخروج المبكر", "أيام الغياب", "خصم الحضور", "خصم المخالفات", "العمل الإضافي", "الصافي"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [head, ...rows.map((r) => [r.employee_no, r.full_name, r.dept, r.iban, r.basic, r.allowances, r.gross, r.late_minutes, r.absent_days, r.attendance_deduction, r.violation_deduction, r.overtime, r.net])]
    .map((line) => line.map(esc).join(","))
    .join("\r\n");
  return new NextResponse("﻿" + csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="payroll-${month}.csv"` },
  });
}
