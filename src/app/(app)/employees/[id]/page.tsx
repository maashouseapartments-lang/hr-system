import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pencil, FileText, CalendarPlus, ShieldAlert, Star, Printer } from "lucide-react";
import { all, get } from "@/lib/db";
import { requireUser, isHR, isGM, isFinance } from "@/lib/auth";
import { canViewEmployee } from "@/lib/permissions";
import { annualEligibility, getEmployee, totalWage, today, scheduleFor, dailyWage } from "@/lib/hr";
import { ATTENDANCE_STATUS, EMPLOYEE_STATUS, LEAVE_STATUS, PERFORMANCE_STATUS, VIOLATION_STATUS } from "@/lib/labels";
import { fmtDate, money, num, time12, durationLabel } from "@/lib/time";
import { penaltyLabel } from "@/lib/hr";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Alert, Avatar, Badge, Card, Empty, Field, FileList, PageHeader, StatusBadge, Tabs, type FileRow } from "@/components/ui";
import { uploadEmployeeDocs, createEmployeeAccount } from "../actions";

export default async function EmployeePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; created?: string }> }) {
  const u = await requireUser();
  const id = Number((await params).id);
  const { tab = "overview", created } = await searchParams;
  if (!canViewEmployee(u, id)) redirect("/dashboard?denied=1");
  const e = getEmployee(id);
  if (!e) notFound();
  const hr = isHR(u);
  const self = u.employee_id === id;
  const seeMoney = hr || isGM(u) || isFinance(u) || self;

  const info = get<{ dept: string | null; position: string | null; manager: string | null; schedule: string | null }>(
    `SELECT d.name AS dept, p.title AS position, m.full_name AS manager, s.name AS schedule FROM employees e
       LEFT JOIN departments d ON d.id = e.department_id LEFT JOIN positions p ON p.id = e.position_id
       LEFT JOIN employees m ON m.id = e.manager_id LEFT JOIN schedules s ON s.id = e.schedule_id WHERE e.id = ?`,
    id,
  )!;
  const account = get<{ username: string; active: number }>("SELECT username, active FROM users WHERE employee_id = ?", id);
  const elig = annualEligibility(e, today());
  const counts = {
    leaves: Number(get<{ c: number }>("SELECT COUNT(*) c FROM leave_requests WHERE employee_id = ?", id)!.c),
    violations: Number(get<{ c: number }>("SELECT COUNT(*) c FROM violations WHERE employee_id = ?", id)!.c),
    perf: Number(get<{ c: number }>("SELECT COUNT(*) c FROM performance_reviews WHERE employee_id = ?", id)!.c),
    docs: Number(get<{ c: number }>("SELECT COUNT(*) c FROM files WHERE entity_type = 'employee' AND entity_id = ?", id)!.c),
  };
  const base = `/employees/${id}`;
  const tabs = [
    { key: "overview", label: "نظرة عامة", href: base },
    { key: "leaves", label: "الإجازات", href: `${base}?tab=leaves`, count: counts.leaves },
    { key: "attendance", label: "الحضور", href: `${base}?tab=attendance` },
    ...(hr || isGM(u) || self ? [{ key: "violations", label: "المخالفات", href: `${base}?tab=violations`, count: counts.violations }] : []),
    { key: "performance", label: "الأداء", href: `${base}?tab=performance`, count: counts.perf },
    { key: "job", label: "الوصف الوظيفي", href: `${base}?tab=job` },
    { key: "documents", label: "المستندات", href: `${base}?tab=documents`, count: counts.docs },
  ];

  return (
    <>
      {created && <div className="mb-4"><Alert tone="brand">تمت إضافة الموظف بنجاح{account ? ` — اسم المستخدم للدخول: ${account.username}` : ""}</Alert></div>}
      <div className="card mb-6 overflow-hidden">
        <div className="h-20 bg-gradient-to-l from-brand-500 to-brand-800" />
        <div className="flex flex-col gap-4 px-6 pb-6 sm:flex-row sm:items-end">
          <div className="-mt-10"><Avatar name={e.full_name} fileId={e.photo_file_id} size={92} /></div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold">{e.full_name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span className="font-mono">#{e.employee_no}</span>
              <span>•</span><span>{info.position ?? "بدون مسمى"}</span>
              <span>•</span><span>{info.dept ?? "بدون قسم"}</span>
              <StatusBadge map={EMPLOYEE_STATUS} value={e.status} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {e.cv_file_id && <a href={`/api/files/${e.cv_file_id}`} target="_blank" className="btn-secondary"><FileText className="size-4" /> السيرة الذاتية</a>}
            {(hr || self) && <Link href={`/leaves/new?employee=${id}`} className="btn-secondary"><CalendarPlus className="size-4" /> طلب إجازة</Link>}
            {hr && <Link href={`/violations/new?employee=${id}`} className="btn-secondary"><ShieldAlert className="size-4" /> تسجيل مخالفة</Link>}
            {hr && <Link href={`${base}/edit`} className="btn-primary"><Pencil className="size-4" /> تعديل</Link>}
          </div>
        </div>
      </div>

      <Tabs tabs={tabs} active={tab} />

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="البيانات الشخصية">
            <dl className="kv">
              <dt>الاسم بالإنجليزي</dt><dd dir="ltr" className="text-end">{e.full_name_en || "—"}</dd>
              <dt>{String(e.id_type ?? "الهوية")}</dt><dd className="font-mono">{e.national_id || "—"}</dd>
              <dt>انتهاء الهوية</dt><dd>{fmtDate(e.id_expiry as string)}</dd>
              <dt>الجنسية</dt><dd>{e.nationality || "—"}</dd>
              <dt>الجنس</dt><dd>{e.gender || "—"}</dd>
              <dt>تاريخ الميلاد</dt><dd>{fmtDate(e.birth_date as string)}</dd>
              <dt>الحالة الاجتماعية</dt><dd>{String(e.marital_status || "—")}</dd>
              <dt>المؤهل</dt><dd>{String(e.education || "—")}</dd>
              <dt>الجوال</dt><dd dir="ltr" className="text-end">{e.phone || "—"}</dd>
              <dt>البريد</dt><dd dir="ltr" className="truncate text-end">{e.email || "—"}</dd>
              <dt>الطوارئ</dt><dd>{String(e.emergency_contact || "—")} {e.emergency_phone ? `(${e.emergency_phone})` : ""}</dd>
            </dl>
          </Card>
          <Card title="البيانات الوظيفية">
            <dl className="kv">
              <dt>القسم</dt><dd>{info.dept ?? "—"}</dd>
              <dt>المسمى</dt><dd>{info.position ?? "—"}</dd>
              <dt>المدير المباشر</dt><dd>{info.manager ?? "—"}</dd>
              <dt>تاريخ المباشرة</dt><dd>{fmtDate(e.hire_date)}</dd>
              <dt>مدة الخدمة</dt><dd>{num(elig.serviceYears, 1)} سنة ({num(elig.serviceDays)} يوم)</dd>
              <dt>نوع العقد</dt><dd>{String(e.contract_type || "—")}</dd>
              <dt>الدوام</dt><dd>{info.schedule ?? "الافتراضي"}</dd>
              <dt>حساب الدخول</dt><dd>{account ? <span dir="ltr">{account.username}</span> : "لا يوجد"}</dd>
            </dl>
            {hr && !account && (
              <ActionForm action={createEmployeeAccount} className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
                <input type="hidden" name="employee_id" value={id} />
                <input name="password" className="input" dir="ltr" placeholder="كلمة مرور للموظف" required />
                <SubmitButton className="btn-secondary">إنشاء حساب</SubmitButton>
              </ActionForm>
            )}
          </Card>
          <Card title="رصيد الإجازة السنوية">
            <div className="mb-4 flex items-end gap-2">
              <span className={`text-4xl font-extrabold ${elig.balance < 0 ? "text-rose-600" : "text-brand-700"}`}>{num(elig.balance, 1)}</span>
              <span className="pb-1 text-slate-500">يوم متاح</span>
            </div>
            <dl className="kv">
              <dt>الاستحقاق السنوي</dt><dd><Badge tone={elig.entitlementPerYear === 30 ? "brand" : "sky"}>{elig.entitlementPerYear} يوماً</Badge></dd>
              <dt>المستحق تراكمياً</dt><dd>{num(elig.accrued, 1)} يوم</dd>
              <dt>المستخدم</dt><dd>{num(elig.usedInSystem + elig.usedBefore, 1)} يوم</dd>
              <dt>آخر إجازة سنوية</dt><dd>{elig.lastLeaveReturn ? fmtDate(elig.lastLeaveReturn) : "لم يأخذ بعد"}</dd>
              <dt>منذ آخر إجازة</dt><dd>{num(elig.daysSinceLastLeave)} يوم {elig.yearPassedSinceLastLeave && <Badge tone="amber">تجاوز سنة</Badge>}</dd>
              {elig.nextEntitlementChange && <><dt>يصبح 30 يوماً في</dt><dd>{fmtDate(elig.nextEntitlementChange)}</dd></>}
            </dl>
            {!elig.completedFirstYear && <div className="mt-3"><Alert tone="amber">لم يُكمل السنة الأولى بعد</Alert></div>}
          </Card>
          {seeMoney && (
            <Card title="الراتب" className="lg:col-span-1">
              <dl className="kv">
                <dt>الأساسي</dt><dd>{money(e.basic_salary)}</dd>
                <dt>السكن</dt><dd>{money(e.housing_allowance)}</dd>
                <dt>النقل</dt><dd>{money(e.transport_allowance)}</dd>
                <dt>أخرى</dt><dd>{money(e.other_allowance)}</dd>
                <dt className="font-bold text-slate-700">الإجمالي</dt><dd className="text-brand-700">{money(totalWage(e))}</dd>
                <dt>أجر اليوم</dt><dd>{money(dailyWage(e))}</dd>
                <dt>البنك</dt><dd>{e.bank_name || "—"}</dd>
                <dt>الآيبان</dt><dd dir="ltr" className="text-end font-mono text-xs">{e.iban || "—"}</dd>
              </dl>
            </Card>
          )}
          <MonthSummary employeeId={id} seeMoney={seeMoney} />
        </div>
      )}

      {tab === "leaves" && <LeavesTab employeeId={id} />}
      {tab === "attendance" && <AttendanceTab employeeId={id} seeMoney={seeMoney} />}
      {tab === "violations" && (hr || isGM(u) || self) && <ViolationsTab employeeId={id} />}
      {tab === "performance" && <PerformanceTab employeeId={id} />}
      {tab === "job" && <JobTab positionId={e.position_id} />}
      {tab === "documents" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <Card title="مستندات الموظف">
            <FileList files={all<FileRow>("SELECT * FROM files WHERE entity_type = 'employee' AND entity_id = ? ORDER BY id DESC", id)} />
          </Card>
          {hr && (
            <Card title="رفع مستند">
              <ActionForm action={uploadEmployeeDocs} resetOnSuccess className="space-y-4">
                <input type="hidden" name="employee_id" value={id} />
                <Field label="نوع المستند">
                  <select name="category" className="input">
                    <option value="contract">عقد العمل</option><option value="id_copy">صورة الهوية / الإقامة</option>
                    <option value="certificate">شهادة</option><option value="cv">السيرة الذاتية</option><option value="document">مستند آخر</option>
                  </select>
                </Field>
                <Field label="العنوان"><input name="title" className="input" /></Field>
                <Field label="الملف (PDF أو صورة)"><input name="files" type="file" multiple accept="application/pdf,image/*" className="input" required /></Field>
                <SubmitButton>رفع</SubmitButton>
              </ActionForm>
            </Card>
          )}
        </div>
      )}
    </>
  );
}

function MonthSummary({ employeeId, seeMoney }: { employeeId: number; seeMoney: boolean }) {
  const month = today().slice(0, 7);
  const s = get<{ days: number; late: number; early: number; ded: number }>(
    `SELECT COUNT(*) AS days, COALESCE(SUM(late_minutes),0) AS late, COALESCE(SUM(early_leave_minutes),0) AS early,
            COALESCE(SUM(deduction_amount),0) AS ded FROM attendance WHERE employee_id = ? AND work_date LIKE ?`,
    employeeId,
    `${month}%`,
  )!;
  const adj = get<{ ded: number; add: number }>(
    `SELECT COALESCE(SUM(CASE WHEN kind='deduction' AND source != 'late' THEN amount END),0) AS ded,
            COALESCE(SUM(CASE WHEN kind='addition' THEN amount END),0) AS "add" FROM payroll_adjustments WHERE employee_id = ? AND period = ?`,
    employeeId,
    month,
  )!;
  return (
    <Card title={`ملخص الشهر الحالي (${month})`} className="lg:col-span-2">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl bg-slate-50 p-4"><div className="text-sm text-slate-500">أيام الحضور</div><div className="text-2xl font-extrabold">{s.days}</div></div>
        <div className="rounded-xl bg-amber-50 p-4"><div className="text-sm text-amber-700">دقائق التأخير</div><div className="text-2xl font-extrabold text-amber-800">{s.late}</div></div>
        <div className="rounded-xl bg-amber-50 p-4"><div className="text-sm text-amber-700">الخروج المبكر</div><div className="text-2xl font-extrabold text-amber-800">{s.early}</div></div>
        {seeMoney && <div className="rounded-xl bg-rose-50 p-4"><div className="text-sm text-rose-700">إجمالي الخصومات</div><div className="text-xl font-extrabold text-rose-700">{money(s.ded + adj.ded)}</div></div>}
        {seeMoney && adj.add > 0 && <div className="rounded-xl bg-brand-50 p-4"><div className="text-sm text-brand-700">العمل الإضافي</div><div className="text-xl font-extrabold text-brand-700">{money(adj.add)}</div></div>}
      </div>
    </Card>
  );
}

function LeavesTab({ employeeId }: { employeeId: number }) {
  const rows = all<{ id: number; ref_no: string; type: string; start_date: string; end_date: string; days: number; status: string }>(
    `SELECT lr.id, lr.ref_no, lt.name AS type, lr.start_date, lr.end_date, lr.days, lr.status FROM leave_requests lr
       LEFT JOIN leave_types lt ON lt.id = lr.leave_type_id WHERE lr.employee_id = ? ORDER BY lr.start_date DESC`,
    employeeId,
  );
  return (
    <Card pad={false}>
      {rows.length ? (
        <table className="table">
          <thead><tr><th>الرقم</th><th>النوع</th><th>من</th><th>إلى</th><th>الأيام</th><th>الحالة</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}>
              <td><Link className="font-bold text-brand-700" href={`/leaves/${r.id}`}>{r.ref_no}</Link></td>
              <td>{r.type}</td><td>{fmtDate(r.start_date)}</td><td>{fmtDate(r.end_date)}</td><td>{r.days}</td>
              <td><StatusBadge map={LEAVE_STATUS} value={r.status} /></td>
            </tr>
          ))}</tbody>
        </table>
      ) : <Empty title="لا توجد إجازات" />}
    </Card>
  );
}

function AttendanceTab({ employeeId, seeMoney }: { employeeId: number; seeMoney: boolean }) {
  const rows = all<{ id: number; work_date: string; check_in_minutes: number | null; check_out_minutes: number | null; late_minutes: number; early_leave_minutes: number; worked_minutes: number; deduction_amount: number; status: string; loc: string | null; check_in_photo_id: number | null }>(
    `SELECT a.*, l.name AS loc FROM attendance a LEFT JOIN locations l ON l.id = a.check_in_location_id WHERE a.employee_id = ? ORDER BY a.work_date DESC LIMIT 62`,
    employeeId,
  );
  const e = getEmployee(employeeId)!;
  const s = scheduleFor(e, today());
  return (
    <Card pad={false} title={s ? `الدوام: ${s.name} (${time12(s.start_time)} - ${time12(s.end_time)})، السماح ${s.grace_minutes} دقيقة` : undefined}>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>التاريخ</th><th>الحضور</th><th>الانصراف</th><th>الموقع</th><th>ساعات العمل</th><th>التأخير</th><th>خروج مبكر</th>{seeMoney && <th>الخصم</th>}<th>الحالة</th><th>الصورة</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}>
                <td>{fmtDate(r.work_date)}</td>
                <td>{time12(r.check_in_minutes)}</td>
                <td>{time12(r.check_out_minutes)}</td>
                <td>{r.loc ?? "—"}</td>
                <td>{durationLabel(r.worked_minutes)}</td>
                <td className={r.late_minutes ? "font-bold text-amber-700" : ""}>{r.late_minutes} د</td>
                <td className={r.early_leave_minutes ? "font-bold text-amber-700" : ""}>{r.early_leave_minutes} د</td>
                {seeMoney && <td className={r.deduction_amount ? "text-rose-600" : ""}>{money(r.deduction_amount)}</td>}
                <td><StatusBadge map={ATTENDANCE_STATUS} value={r.status} /></td>
                <td>{r.check_in_photo_id && <a href={`/api/files/${r.check_in_photo_id}`} target="_blank"><Avatar name="-" fileId={r.check_in_photo_id} size={32} /></a>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <Empty title="لا توجد سجلات حضور" />}
    </Card>
  );
}

function ViolationsTab({ employeeId }: { employeeId: number }) {
  const rows = all<{ id: number; ref_no: string; incident_date: string; description: string; status: string; penalty_code: string | null; deduction_amount: number | null; code: string | null }>(
    `SELECT v.*, vt.code FROM violations v LEFT JOIN violation_types vt ON vt.id = v.violation_type_id WHERE v.employee_id = ? ORDER BY v.incident_date DESC`,
    employeeId,
  );
  return (
    <Card pad={false}>
      {rows.length ? (
        <table className="table">
          <thead><tr><th>الرقم</th><th>التاريخ</th><th>الوصف</th><th>البند</th><th>الجزاء</th><th>المبلغ</th><th>الحالة</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}>
              <td><Link className="font-bold text-brand-700" href={`/violations/${r.id}`}>{r.ref_no}</Link></td>
              <td>{fmtDate(r.incident_date)}</td><td className="max-w-xs truncate">{r.description}</td><td>{r.code ?? "—"}</td>
              <td>{penaltyLabel(r.penalty_code)}</td><td>{r.deduction_amount ? money(r.deduction_amount) : "—"}</td>
              <td><StatusBadge map={VIOLATION_STATUS} value={r.status} /></td>
            </tr>
          ))}</tbody>
        </table>
      ) : <Empty title="لا توجد مخالفات 👏" />}
    </Card>
  );
}

function PerformanceTab({ employeeId }: { employeeId: number }) {
  const rows = all<{ id: number; period: string; total_score: number; rating: string; status: string; reviewer_name: string | null }>(
    "SELECT * FROM performance_reviews WHERE employee_id = ? ORDER BY id DESC",
    employeeId,
  );
  return (
    <Card pad={false} title="تقييمات الأداء" actions={<Link href={`/performance/new?employee=${employeeId}`} className="btn-secondary btn-sm"><Star className="size-4" /> تقييم جديد</Link>}>
      {rows.length ? (
        <table className="table">
          <thead><tr><th>الفترة</th><th>الدرجة</th><th>التقدير</th><th>المقيّم</th><th>الحالة</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}>
              <td><Link className="font-bold text-brand-700" href={`/performance/${r.id}`}>{r.period}</Link></td>
              <td className="font-bold">{num(r.total_score, 1)}%</td><td>{r.rating}</td><td>{r.reviewer_name ?? "—"}</td>
              <td><StatusBadge map={PERFORMANCE_STATUS} value={r.status} /></td>
            </tr>
          ))}</tbody>
        </table>
      ) : <Empty title="لا توجد تقييمات" />}
    </Card>
  );
}

function JobTab({ positionId }: { positionId: number | null }) {
  if (!positionId) return <Card><Empty title="لم يُحدد مسمى وظيفي">حدّد المسمى من «تعديل» ليظهر الوصف الوظيفي هنا</Empty></Card>;
  const p = get<Record<string, string | null>>("SELECT p.*, d.name AS dept, r.title AS reports_to FROM positions p LEFT JOIN departments d ON d.id = p.department_id LEFT JOIN positions r ON r.id = p.reports_to_position_id WHERE p.id = ?", positionId);
  if (!p) return null;
  const sections: [string, string][] = [["summary", "الهدف العام للوظيفة"], ["duties", "المهام والمسؤوليات"], ["qualifications", "المؤهلات"], ["experience", "الخبرات"], ["skills", "المهارات"], ["kpis", "مؤشرات الأداء"], ["work_conditions", "ظروف العمل"]];
  return (
    <Card title={p.title} actions={<Link href={`/positions/${positionId}/print`} className="btn-secondary btn-sm"><Printer className="size-4" /> طباعة</Link>}>
      <div className="mb-4 flex flex-wrap gap-4 text-sm text-slate-600">
        <span>القسم: <b>{p.dept ?? "—"}</b></span><span>يرفع تقاريره إلى: <b>{p.reports_to ?? "—"}</b></span><span>الدرجة: <b>{p.grade ?? "—"}</b></span>
      </div>
      <div className="space-y-5">
        {sections.filter(([k]) => p[k]).map(([k, label]) => (
          <div key={k}><h3 className="mb-1 font-bold text-brand-800">{label}</h3><p className="whitespace-pre-wrap leading-8 text-slate-700">{p[k]}</p></div>
        ))}
      </div>
    </Card>
  );
}
