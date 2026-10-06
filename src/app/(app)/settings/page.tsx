import Link from "next/link";
import { CheckCircle2, Circle, ArrowLeft } from "lucide-react";
import { get } from "@/lib/db";
import { PageHeader, Alert } from "@/components/ui";

const count = (sql: string) => Number(get<{ c: number }>(sql)?.c ?? 0);

export default async function SettingsHome({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { welcome } = await searchParams;
  const steps = [
    { href: "/settings/company", title: "بيانات الشركة", desc: "الاسم، السجل التجاري، العنوان، الشعار", done: count("SELECT COUNT(*) c FROM company") > 0, meta: "" },
    { href: "/settings/schedules", title: "مواعيد العمل", desc: "ساعات الدوام، الاستراحة، فترة السماح، الدوامات الخاصة", done: count("SELECT COUNT(*) c FROM schedules") > 0, meta: `${count("SELECT COUNT(*) c FROM schedules")} دوام` },
    { href: "/settings/departments", title: "الأقسام والهيكل التنظيمي", desc: "الأقسام الرئيسية والفرعية ومدير كل قسم", done: count("SELECT COUNT(*) c FROM departments") > 0, meta: `${count("SELECT COUNT(*) c FROM departments")} قسم` },
    { href: "/positions", title: "المسميات والأوصاف الوظيفية", desc: "الوصف الوظيفي لكل مسمى والمهام والمؤهلات", done: count("SELECT COUNT(*) c FROM positions") > 0, meta: `${count("SELECT COUNT(*) c FROM positions")} مسمى` },
    { href: "/settings/locations", title: "مواقع الحضور (GPS)", desc: "المواقع المسموح التسجيل منها ونطاق كل موقع", done: count("SELECT COUNT(*) c FROM locations") > 0, meta: `${count("SELECT COUNT(*) c FROM locations")} موقع` },
    { href: "/employees/new", title: "إضافة الموظفين", desc: "البيانات الشخصية، الراتب، السيرة الذاتية، حساب الدخول", done: count("SELECT COUNT(*) c FROM employees") > 0, meta: `${count("SELECT COUNT(*) c FROM employees")} موظف` },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  return (
    <>
      <PageHeader title="تهيئة النظام" subtitle={`أكملت ${doneCount} من ${steps.length} خطوات`} />
      {welcome && (
        <div className="mb-6">
          <Alert tone="brand" title="تم إنشاء النظام بنجاح 🎉">
            أكمل الخطوات التالية بالترتيب، وبعدها يقدر الموظفون يسجلون الحضور ويرفعون طلباتهم.
          </Alert>
        </div>
      )}
      <div className="mb-6 h-2.5 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {steps.map((s, i) => (
          <Link key={s.href} href={s.href} className="card group flex items-center gap-4 p-5 transition hover:border-brand-300 hover:shadow-md">
            <div className={`flex size-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold ${s.done ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-500"}`}>
              {i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                {s.title}
                {s.done ? <CheckCircle2 className="size-4 text-brand-600" /> : <Circle className="size-4 text-slate-300" />}
              </div>
              <div className="text-sm text-slate-500">{s.desc}</div>
              {s.meta && <div className="mt-1 text-xs font-semibold text-brand-700">{s.meta}</div>}
            </div>
            <ArrowLeft className="size-5 text-slate-300 transition group-hover:-translate-x-1 group-hover:text-brand-600" />
          </Link>
        ))}
      </div>
    </>
  );
}
