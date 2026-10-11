import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { get } from "@/lib/db";
import { ActionForm, SubmitButton } from "@/components/forms";
import { CompanyFields, ScheduleFields } from "@/components/company-fields";
import { Field } from "@/components/ui";
import { setupSystem, setupDemo } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "تهيئة النظام" };

function Step({ n, title, desc, children }: { n: number; title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="card card-pad">
      <div className="mb-5 flex items-start gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-lg font-bold text-white">{n}</div>
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="text-sm text-slate-500">{desc}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function SetupPage() {
  if (get("SELECT 1 FROM users LIMIT 1")) redirect("/login");
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-3xl bg-brand-100 text-brand-700">
          <Sparkles className="size-8" />
        </div>
        <h1 className="text-3xl font-extrabold">تهيئة نظام الموارد البشرية لشركتك</h1>
        <p className="mt-2 text-slate-500">ثلاث خطوات فقط، وتقدر تعدّل كل شيء لاحقاً من صفحة «تهيئة النظام»</p>
      </div>
      <form action={setupDemo} className="card mb-8 flex flex-col items-center gap-3 border-brand-200 bg-brand-50 p-6 text-center sm:flex-row sm:text-start">
        <div className="flex-1">
          <div className="text-lg font-bold text-brand-800">تبي تجرب النظام أولاً؟</div>
          <p className="text-sm text-brand-700">ننشئ لك شركة تجريبية فيها أقسام وموظفون وحسابات بكل الصلاحيات، وطلب إجازة جاهز لتجربة دورة الموافقات.</p>
        </div>
        <button className="btn-primary px-6 py-3">تجربة ببيانات تجريبية</button>
      </form>
      <ActionForm action={setupSystem} className="space-y-6">
        <Step n={1} title="بيانات الشركة" desc="تظهر هذه البيانات في رأس جميع النماذج والمستندات المطبوعة">
          <CompanyFields />
        </Step>
        <Step n={2} title="مواعيد العمل الرسمية" desc="الدوام الافتراضي لكل الموظفين. تقدر تضيف دوامات أخرى (مثل دوام رمضان أو الورديات) لاحقاً">
          <ScheduleFields />
        </Step>
        <Step n={3} title="حساب مدير النظام" desc="الحساب صاحب الصلاحيات الكاملة">
          <div className="grid-form">
            <Field label="الاسم *">
              <input name="admin_name" className="input" required />
            </Field>
            <Field label="اسم المستخدم *">
              <input name="admin_username" className="input" dir="ltr" required defaultValue="admin" />
            </Field>
            <div />
            <Field label="كلمة المرور *" hint="8 أحرف على الأقل">
              <input name="admin_password" type="password" className="input" dir="ltr" required minLength={8} />
            </Field>
            <Field label="تأكيد كلمة المرور *">
              <input name="admin_password2" type="password" className="input" dir="ltr" required minLength={8} />
            </Field>
          </div>
        </Step>
        <div className="flex justify-center">
          <SubmitButton className="btn-primary px-10 py-3.5 text-base">ابدأ استخدام النظام</SubmitButton>
        </div>
      </ActionForm>
    </main>
  );
}
