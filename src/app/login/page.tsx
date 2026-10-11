import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { get, getSetting } from "@/lib/db";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo";
import { DemoAccounts } from "./demo-accounts";
import { getUser } from "@/lib/auth";
import { login } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "تسجيل الدخول" };

export default async function LoginPage() {
  if (!get("SELECT 1 FROM users LIMIT 1")) redirect("/setup");
  if (await getUser()) redirect("/dashboard");
  const company = get<{ name_ar: string; logo_file_id: number | null }>("SELECT name_ar, logo_file_id FROM company WHERE id = 1");
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-slate-900 lg:block">
        <div className="absolute -top-24 -start-24 size-96 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="absolute bottom-0 end-0 size-[28rem] rounded-full bg-sky-400/10 blur-3xl" />
        <div className="relative flex h-full flex-col justify-between p-14 text-white">
          <div className="flex items-center gap-3 text-xl font-bold">
            <Building2 className="size-8" /> {company?.name_ar}
          </div>
          <div>
            <h1 className="text-4xl font-extrabold leading-tight">نظام الموارد البشرية</h1>
            <p className="mt-4 max-w-md text-lg leading-8 text-brand-100">
              الموظفون، الحضور بالموقع، الإجازات، المخالفات، العمل الإضافي، والأداء. كل معاملة لها سير عمل واضح ونسخة إلكترونية وورقية.
            </p>
          </div>
          <div className="text-sm text-brand-200">وفق نظام العمل السعودي ولائحته التنفيذية</div>
        </div>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {company?.logo_file_id ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/files/${company.logo_file_id}?public=logo`} alt="" className="mb-6 h-16 object-contain" />
          ) : null}
          <h2 className="text-2xl font-extrabold text-slate-900">مرحباً بك 👋</h2>
          <p className="mt-1 mb-8 text-slate-500">سجّل دخولك للمتابعة</p>
          <ActionForm action={login} className="space-y-4">
            <label className="block">
              <span className="label">اسم المستخدم</span>
              <input name="username" className="input" autoComplete="username" required autoFocus dir="ltr" />
            </label>
            <label className="block">
              <span className="label">كلمة المرور</span>
              <input name="password" type="password" className="input" autoComplete="current-password" required dir="ltr" />
            </label>
            <SubmitButton className="btn-primary w-full py-3 text-base">دخول</SubmitButton>
          </ActionForm>
          <p className="mt-6 text-center text-xs text-slate-400">الموظف: اسم المستخدم هو الرقم الوظيفي</p>
          {getSetting("demo_mode") === "1" && <DemoAccounts accounts={DEMO_ACCOUNTS} password={DEMO_PASSWORD} />}
        </div>
      </div>
    </main>
  );
}
