import "server-only";
import { all } from "./db";
import { round2, totalWage } from "./hr";

export type PayrollRow = {
  id: number;
  employee_no: string;
  full_name: string;
  dept: string | null;
  iban: string | null;
  basic: number;
  allowances: number;
  gross: number;
  late_minutes: number;
  absent_days: number;
  attendance_deduction: number;
  violation_deduction: number;
  overtime: number;
  net: number;
};

/** ملخص مسير الرواتب لشهر (YYYY-MM) */
export function payrollFor(month: string): PayrollRow[] {
  const emps = all<{ id: number; employee_no: string; full_name: string; dept: string | null; iban: string | null; basic_salary: number; housing_allowance: number; transport_allowance: number; other_allowance: number }>(
    `SELECT e.*, d.name AS dept FROM employees e LEFT JOIN departments d ON d.id = e.department_id WHERE e.status != 'terminated' ORDER BY d.name, e.full_name`,
  );
  const att = Object.fromEntries(
    all<{ employee_id: number; late: number; absent: number; ded: number }>(
      `SELECT employee_id, SUM(late_minutes + early_leave_minutes) AS late, SUM(status = 'absent') AS absent, SUM(deduction_amount) AS ded
         FROM attendance WHERE work_date LIKE ? GROUP BY employee_id`,
      `${month}%`,
    ).map((r) => [r.employee_id, r]),
  );
  const adj = Object.fromEntries(
    all<{ employee_id: number; ded: number; add: number }>(
      `SELECT employee_id, SUM(CASE WHEN kind = 'deduction' THEN amount ELSE 0 END) AS ded, SUM(CASE WHEN kind = 'addition' THEN amount ELSE 0 END) AS "add"
         FROM payroll_adjustments WHERE period = ? GROUP BY employee_id`,
      month,
    ).map((r) => [r.employee_id, r]),
  );
  return emps.map((e) => {
    const gross = totalWage(e);
    const a = att[e.id];
    const j = adj[e.id];
    const attDed = round2(a?.ded ?? 0);
    const vioDed = round2(j?.ded ?? 0);
    const ot = round2(j?.add ?? 0);
    return {
      id: e.id,
      employee_no: e.employee_no,
      full_name: e.full_name,
      dept: e.dept,
      iban: e.iban,
      basic: e.basic_salary,
      allowances: round2(gross - e.basic_salary),
      gross,
      late_minutes: Number(a?.late ?? 0),
      absent_days: Number(a?.absent ?? 0),
      attendance_deduction: attDed,
      violation_deduction: vioDed,
      overtime: ot,
      net: round2(gross - attDed - vioDed + ot),
    };
  });
}
