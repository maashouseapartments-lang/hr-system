import "server-only";
import { all, get, getSetting } from "./db";
import { addDays, daysBetween, nowInTz, toMinutes } from "./time";

export type Employee = {
  id: number;
  employee_no: string;
  full_name: string;
  full_name_en: string | null;
  national_id: string | null;
  nationality: string | null;
  gender: string | null;
  department_id: number | null;
  position_id: number | null;
  manager_id: number | null;
  schedule_id: number | null;
  hire_date: string;
  basic_salary: number;
  housing_allowance: number;
  transport_allowance: number;
  other_allowance: number;
  status: string;
  prior_leave_used: number;
  last_leave_return_date: string | null;
  iban: string | null;
  bank_name: string | null;
  phone: string | null;
  email: string | null;
  photo_file_id: number | null;
  cv_file_id: number | null;
  [k: string]: unknown;
};

export type Schedule = {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
  grace_minutes: number;
  work_days: string;
  effective_from: string | null;
  effective_to: string | null;
  is_default: number;
};

export const companyTz = () => get<{ timezone: string }>("SELECT timezone FROM company WHERE id = 1")?.timezone || "Asia/Riyadh";
export const today = () => nowInTz(companyTz()).date;

export const getEmployee = (id: number) => get<Employee>("SELECT * FROM employees WHERE id = ?", id);

export const totalWage = (e: Pick<Employee, "basic_salary" | "housing_allowance" | "transport_allowance" | "other_allowance">) =>
  (e.basic_salary || 0) + (e.housing_allowance || 0) + (e.transport_allowance || 0) + (e.other_allowance || 0);

/** أجر اليوم = الأجر الشهري ÷ 30 (حسب أساس الحسم المعتمد في الإعدادات) */
export function dailyWage(e: Employee) {
  const basis = getSetting("deduction_basis", "total");
  return (basis === "basic" ? e.basic_salary : totalWage(e)) / 30;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** جدول الدوام الساري للموظف في تاريخ معين */
export function scheduleFor(e: Pick<Employee, "schedule_id">, date: string): Schedule | undefined {
  if (e.schedule_id) {
    const s = get<Schedule>("SELECT * FROM schedules WHERE id = ?", e.schedule_id);
    if (s && (!s.effective_from || s.effective_from <= date) && (!s.effective_to || s.effective_to >= date)) return s;
  }
  return (
    get<Schedule>(
      `SELECT * FROM schedules WHERE is_default = 1
         AND (effective_from IS NULL OR effective_from <= ?) AND (effective_to IS NULL OR effective_to >= ?)
       ORDER BY effective_from DESC LIMIT 1`,
      date,
      date,
    ) ?? get<Schedule>("SELECT * FROM schedules ORDER BY is_default DESC, id LIMIT 1")
  );
}

/** دقائق العمل الفعلية في اليوم (بدون فترة الاستراحة) */
export function scheduledMinutes(s: Schedule) {
  const start = toMinutes(s.start_time)!;
  let end = toMinutes(s.end_time)!;
  if (end <= start) end += 24 * 60;
  let breakM = 0;
  if (s.break_start && s.break_end) breakM = Math.max(0, toMinutes(s.break_end)! - toMinutes(s.break_start)!);
  return Math.max(1, end - start - breakM);
}

export const isWorkDay = (s: Schedule, weekday: number) => s.work_days.split(",").map(Number).includes(weekday);

/**
 * التأخير يُحتسب بالدقيقة بعد انتهاء فترة السماح:
 * الدوام 7:00 وفترة السماح 30 دقيقة → الحضور 7:31 = تأخير دقيقة واحدة، والحضور 7:25 = لا تأخير.
 */
export function lateMinutes(s: Schedule, checkInMinutes: number) {
  const limit = toMinutes(s.start_time)! + (s.grace_minutes || 0);
  // لا يتجاوز التأخير مدة يوم العمل (الحضور بعد نهاية الدوام = خصم يوم كامل كحد أقصى)
  return Math.min(scheduledMinutes(s), Math.max(0, checkInMinutes - limit));
}

export function earlyLeaveMinutes(s: Schedule, checkOutMinutes: number) {
  const end = toMinutes(s.end_time)!;
  return Math.min(scheduledMinutes(s), Math.max(0, end - checkOutMinutes));
}

export function minuteRate(e: Employee, s: Schedule) {
  return dailyWage(e) / scheduledMinutes(s);
}

/** العمل الإضافي — المادة 107: أجر الساعة + 50% من أجر الساعة الأساسي */
export function overtimeRates(e: Employee, s?: Schedule) {
  const hoursPerDay = s ? scheduledMinutes(s) / 60 : 8;
  const hourlyWage = totalWage(e) / 30 / hoursPerDay;
  const hourlyBasic = e.basic_salary / 30 / hoursPerDay;
  const pct = Number(getSetting("overtime_rate_basic_pct", "50")) / 100;
  return { hourlyWage, hourlyBasic, hourlyOvertime: hourlyWage + hourlyBasic * pct, hoursPerDay };
}

// ───────────────────────── الإجازة السنوية ─────────────────────────

/** الأيام المستحقة تراكمياً: 21 يوماً عن كل سنة من السنوات الخمس الأولى، ثم 30 يوماً عن كل سنة بعدها */
export function accruedAnnualDays(serviceYears: number) {
  const first = Math.min(serviceYears, 5) * 21;
  const after = Math.max(0, serviceYears - 5) * 30;
  return first + after;
}

export type Eligibility = {
  asOf: string;
  hireDate: string;
  serviceDays: number;
  serviceYears: number;
  entitlementPerYear: 21 | 30;
  completedFirstYear: boolean;
  accrued: number;
  usedInSystem: number;
  usedBefore: number;
  balance: number;
  lastLeaveReturn: string | null;
  daysSinceLastLeave: number;
  yearPassedSinceLastLeave: boolean;
  nextEntitlementChange: string | null;
  requestedDays?: number;
  exceedsBalance?: boolean;
};

export function annualEligibility(e: Employee, asOf: string, excludeRequestId?: number): Eligibility {
  const serviceDays = Math.max(0, daysBetween(e.hire_date, asOf));
  const serviceYears = serviceDays / 365;
  const used = get<{ d: number }>(
    `SELECT COALESCE(SUM(lr.days),0) AS d FROM leave_requests lr JOIN leave_types lt ON lt.id = lr.leave_type_id
      WHERE lr.employee_id = ? AND lt.deducts_balance = 1
        AND lr.status NOT IN ('rejected','cancelled','hr_review') AND lr.id != ?`,
    e.id,
    excludeRequestId ?? 0,
  )!.d;
  const last = get<{ d: string }>(
    `SELECT COALESCE(lr.actual_return_date, lr.return_date, lr.end_date) AS d FROM leave_requests lr
       JOIN leave_types lt ON lt.id = lr.leave_type_id
      WHERE lr.employee_id = ? AND lt.code = 'annual' AND lr.status NOT IN ('rejected','cancelled','hr_review') AND lr.id != ?
      ORDER BY lr.end_date DESC LIMIT 1`,
    e.id,
    excludeRequestId ?? 0,
  )?.d;
  const lastLeaveReturn = last ?? e.last_leave_return_date ?? null;
  const since = lastLeaveReturn ? daysBetween(lastLeaveReturn, asOf) : serviceDays;
  const accrued = accruedAnnualDays(serviceYears);
  const balance = accrued - used - (e.prior_leave_used || 0);
  return {
    asOf,
    hireDate: e.hire_date,
    serviceDays,
    serviceYears,
    entitlementPerYear: serviceYears >= 5 ? 30 : 21,
    completedFirstYear: serviceDays >= 365,
    accrued: Math.round(accrued * 100) / 100,
    usedInSystem: used,
    usedBefore: e.prior_leave_used || 0,
    balance: Math.floor(balance * 100) / 100,
    lastLeaveReturn,
    daysSinceLastLeave: since,
    yearPassedSinceLastLeave: since >= 365,
    nextEntitlementChange: serviceYears < 5 ? addDays(e.hire_date, 365 * 5) : null,
  };
}

// ───────────────────────── المخالفات ─────────────────────────

export function penaltyLabel(code?: string | null) {
  if (!code) return "—";
  if (code === "warning") return "إنذار كتابي";
  if (code === "warning_time") return "إنذار كتابي مع حسم أجر مدة التأخير/الانصراف";
  if (code === "dismiss") return "فصل من الخدمة مع المكافأة";
  if (code === "dismiss_no_award") return "فصل من الخدمة دون مكافأة (المادة 80)";
  const [kind, val] = code.split(":");
  if (kind === "pct") return `حسم ${val}% من أجر اليوم`;
  if (kind === "days") return val === "1" ? "حسم أجر يوم" : val === "2" ? "حسم أجر يومين" : `حسم أجر ${val} أيام`;
  return code;
}

export function penaltyAmount(code: string, daily: number) {
  const [kind, val] = code.split(":");
  const maxDays = Number(getSetting("max_violation_days", "5"));
  let amount = 0;
  if (kind === "pct") amount = (daily * Number(val)) / 100;
  if (kind === "days") amount = daily * Number(val);
  return round2(Math.min(amount, daily * maxDays));
}

export function violationOccurrence(employeeId: number, typeId: number, incidentDate: string, excludeId: number) {
  const repeatDays = Number(getSetting("violation_repeat_days", "180"));
  const from = addDays(incidentDate, -repeatDays);
  const c = get<{ c: number }>(
    `SELECT COUNT(*) AS c FROM violations WHERE employee_id = ? AND violation_type_id = ? AND status = 'applied'
       AND incident_date >= ? AND incident_date <= ? AND id != ?`,
    employeeId,
    typeId,
    from,
    incidentDate,
    excludeId,
  )!.c;
  return Math.min(4, Number(c) + 1);
}

// ───────────────────────── أرقام مرجعية ─────────────────────────

export function nextRef(table: "leave_requests" | "violations" | "overtime_requests", prefix: string) {
  const year = today().slice(0, 4);
  const rows = all<{ ref_no: string }>(`SELECT ref_no FROM ${table} WHERE ref_no LIKE ?`, `${prefix}-${year}-%`);
  const max = rows.reduce((m, r) => Math.max(m, Number(r.ref_no.split("-").pop()) || 0), 0);
  return `${prefix}-${year}-${String(max + 1).padStart(4, "0")}`;
}

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** دقائق الاستراحة الواقعة داخل فترة العمل الفعلية */
export function toBreak(s: Schedule, inM: number, outM: number) {
  const bs = toMinutes(s.break_start);
  const be = toMinutes(s.break_end);
  if (bs == null || be == null) return 0;
  return Math.max(0, Math.min(outM, be) - Math.max(inM, bs));
}
