import Link from "next/link";
import { Users, UserCheck, Clock, CalendarDays, Inbox, MapPinCheck, CalendarPlus, ShieldAlert, Bell, ArrowLeft, AlertTriangle, IdCard } from "lucide-react";
import { all, get } from "@/lib/db";
import { requireUser, isStaff, isHR } from "@/lib/auth";
import { myTasks } from "@/lib/tasks";
import { notificationsFor } from "@/lib/workflow";
import { annualEligibility, getEmployee, today } from "@/lib/hr";
import { addDays, fmtDate, fmtDateTime, fmtHijri, num, time12 } from "@/lib/time";
import { Alert, Badge, Card, Empty, PageHeader, Stat } from "@/components/ui";
import { markAllRead } from "./actions";

const count = (sql: string, ...p: unknown[]) => Number(get<{ c: number }>(sql, ...p)?.c ?? 0);

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string; demo?: string }> }) {
  const u = await requireUser();
  const { denied, demo } = await searchParams;
  const t = today();
  const tasks = myTasks(u);
  const notes = notificationsFor(u, 8);
  const staff = isStaff(u);
  const me = u.employee_id ? getEmployee(u.employee_id) : undefined;
  const myRec = me ? get<{ check_in_minutes: number | null; check_out_minutes: number | null; late_minutes: number }>("SELECT * FROM attendance WHERE employee_id = ? AND work_date = ?", me.id, t) : undefined;
  const elig = me ? annualEligibility(me, t) : null;
  const setupMissing = isHR(u) && (count("SELECT COUNT(*) c FROM departments") === 0 || count("SELECT COUNT(*) c FROM locations") === 0 || count("SELECT COUNT(*) c FROM employees") === 0);
  const expiring = isHR(u)
    ? all<{ id: number; full_name: string; kind: string; d: string }>(
        `SELECT id, full_name, 'الهوية/الإقامة' AS kind, id_expiry AS d FROM employees WHERE status != 'terminated' AND id_expiry BETWEEN ? AND ?
         UNION ALL SELECT id, full_name, 'الجواز', passport_expiry FROM employees WHERE status != 'terminated' AND passport_expiry BETWEEN ? AND ?
         UNION ALL SELECT id, full_name, 'العقد', contract_end FROM employees WHERE status != 'terminated' AND contract_end BETWEEN ? AND ?
         ORDER BY d LIMIT 8`,
        addDays(t, -30), addDays(t, 60), addDays(t, -30), addDays(t, 60), addDays(t, -30), addDays(t, 60),
      )
    : [];
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Riyadh", hour: "numeric", hourCycle: "h23" }).format(new Date()));

  return (
    <>
      <PageHeader title={`${hour < 12 ? "صباح الخير" : "مساء الخير"}، ${u.display_name.split(" ")[0]}`} subtitle={`${fmtDate(t)} — ${fmtHijri(t)}`} />
      {denied && <div className="mb-4"><Alert tone="rose">ليست لديك صلاحية الوصول للصفحة المطلوبة.</Alert></div>}
      {demo && (
        <div className="mb-6">
          <Alert tone="brand" title="أهلاً بك في الشركة التجريبية 👋 هكذا تجرب النظام:">
            <ol className="list-decimal space-y-1 ps-5">
              <li>أضف موقع الحضور: <Link href="/settings/locations?new=1" className="font-bold underline">تهيئة النظام ← مواقع الحضور</Link> واضغط «استخدم موقعي الحالي»، وفعّل «تخصيصه لجميع الموظفين».</li>
              <li>جرّب دورة الإجازة: سجّل خروج، وادخل بحساب الموارد البشرية (1004) وافتح طلب أحمد من صندوق المهام، ثم انتقل بين الحسابات (1001 ← 1005 ← 1002 ← 1006) حسب المرحلة.</li>
              <li>جرّب الحضور: ادخل بحساب موظف (1002) واضغط «تسجيل الحضور».</li>
            </ol>
            <div className="mt-2">كلمة المرور لكل الحسابات: <b dir="ltr">123456</b>. والحسابات تظهر في صفحة الدخول للضغط عليها مباشرة.</div>
          </Alert>
        </div>
      )}
      {setupMissing && !demo && (
        <div className="mb-6">
          <Alert tone="amber" title="أكمل تهيئة النظام">
            لم تكتمل خطوات التهيئة (الأقسام، مواقع الحضور، الموظفين). <Link href="/settings" className="font-bold underline">اذهب لخطوات التهيئة ←</Link>
          </Alert>
        </div>
      )}

      {staff && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="الموظفون على رأس العمل" value={count("SELECT COUNT(*) c FROM employees WHERE status = 'active'")} icon={<Users className="size-6" />} href="/employees" />
          <Stat label="حضور اليوم" value={count("SELECT COUNT(*) c FROM attendance WHERE work_date = ? AND check_in_minutes IS NOT NULL", t)} icon={<UserCheck className="size-6" />} tone="sky" href="/attendance/records" />
          <Stat label="متأخرون اليوم" value={count("SELECT COUNT(*) c FROM attendance WHERE work_date = ? AND late_minutes > 0", t)} icon={<Clock className="size-6" />} tone="amber" href="/attendance/records?status=late" />
          <Stat
            label="في إجازة اليوم"
            value={count("SELECT COUNT(*) c FROM leave_requests WHERE ? BETWEEN start_date AND end_date AND status NOT IN ('rejected','cancelled','hr_review','direct_manager','dept_manager')", t)}
            icon={<CalendarDays className="size-6" />}
            tone="violet"
            href="/leaves?view=open"
          />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card title={<span className="flex items-center gap-2"><Inbox className="size-5 text-brand-600" /> صندوق المهام <Badge tone={tasks.length ? "amber" : "brand"}>{tasks.length}</Badge></span>} pad={false}>
            {tasks.length ? (
              <ul className="divide-y divide-slate-100">
                {tasks.slice(0, 15).map((t) => (
                  <li key={`${t.kind}-${t.id}`}>
                    <Link href={t.href} className="group flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50">
                      <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${t.kind === "leave" ? "bg-sky-100 text-sky-700" : t.kind === "violation" ? "bg-rose-100 text-rose-700" : t.kind === "device" ? "bg-amber-100 text-amber-700" : "bg-violet-100 text-violet-700"}`}>
                        {t.kind === "leave" ? <CalendarDays className="size-5" /> : t.kind === "violation" ? <ShieldAlert className="size-5" /> : t.kind === "device" ? <AlertTriangle className="size-5" /> : <Clock className="size-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-bold text-slate-800">{t.title}</div>
                        <div className="text-xs text-slate-500">{t.subtitle}</div>
                      </div>
                      <Badge tone="amber">{t.stage}</Badge>
                      <ArrowLeft className="size-4 text-slate-300 group-hover:text-brand-600" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <Empty title="لا توجد مهام بانتظارك 🎉">كل المعاملات محدثة</Empty>}
          </Card>

          {expiring.length > 0 && (
            <Card title={<span className="flex items-center gap-2"><IdCard className="size-5 text-amber-600" /> وثائق تنتهي قريباً</span>} pad={false}>
              <table className="table"><tbody>{expiring.map((x, i) => (
                <tr key={i}><td><Link href={`/employees/${x.id}`} className="font-bold hover:text-brand-700">{x.full_name}</Link></td><td>{x.kind}</td><td>{fmtDate(x.d)}</td><td>{x.d < t ? <Badge tone="rose">منتهية</Badge> : <Badge tone="amber">قريباً</Badge>}</td></tr>
              ))}</tbody></table>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {me && (
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <div className="font-bold">حضوري اليوم</div>
                {myRec?.check_in_minutes != null ? <Badge tone={myRec.late_minutes ? "amber" : "brand"}>{myRec.late_minutes ? `متأخر ${myRec.late_minutes} د` : "في الوقت"}</Badge> : <Badge tone="slate">لم تسجل بعد</Badge>}
              </div>
              <div className="mb-4 grid grid-cols-2 gap-3 text-center">
                <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">الحضور</div><div className="text-lg font-bold">{time12(myRec?.check_in_minutes)}</div></div>
                <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">الانصراف</div><div className="text-lg font-bold">{time12(myRec?.check_out_minutes)}</div></div>
              </div>
              <Link href="/attendance" className="btn-primary w-full py-3"><MapPinCheck className="size-5" /> {myRec?.check_in_minutes == null ? "تسجيل الحضور" : myRec.check_out_minutes == null ? "تسجيل الانصراف" : "عرض الحضور"}</Link>
              {elig && (
                <div className="mt-4 flex items-center justify-between rounded-xl bg-brand-50 p-3">
                  <div><div className="text-xs text-brand-700">رصيد إجازتي السنوية</div><div className="text-xl font-extrabold text-brand-800">{num(elig.balance, 1)} يوم</div></div>
                  <Link href="/leaves/new" className="btn-secondary btn-sm"><CalendarPlus className="size-4" /> طلب إجازة</Link>
                </div>
              )}
            </Card>
          )}
          <Card
            title={<span className="flex items-center gap-2"><Bell className="size-5 text-brand-600" /> الإشعارات</span>}
            actions={notes.some((n) => !n.read_at) && <form action={markAllRead}><button className="text-xs font-semibold text-brand-700 hover:underline">تعليم الكل كمقروء</button></form>}
            pad={false}
          >
            {notes.length ? (
              <ul className="divide-y divide-slate-100">
                {notes.map((n) => (
                  <li key={n.id} className={`px-5 py-3 ${n.read_at ? "opacity-60" : ""}`}>
                    <Link href={n.link ?? "#"} className="block">
                      <div className="flex items-start gap-2">
                        <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read_at ? "bg-slate-300" : n.level === "danger" ? "bg-rose-500" : n.level === "warning" ? "bg-amber-500" : n.level === "success" ? "bg-brand-500" : "bg-sky-500"}`} />
                        <div className="min-w-0">
                          <div className="text-sm font-bold">{n.title}</div>
                          {n.body && <div className="line-clamp-2 text-xs text-slate-500">{n.body}</div>}
                          <div className="mt-0.5 text-[11px] text-slate-400">{fmtDateTime(n.created_at)}</div>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <Empty title="لا توجد إشعارات" />}
          </Card>
        </div>
      </div>
    </>
  );
}
