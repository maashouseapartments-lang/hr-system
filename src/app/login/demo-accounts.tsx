"use client";

type Account = { username: string; name: string; role: string };

/** قائمة الحسابات التجريبية: الضغط على حساب يعبّئ بيانات الدخول */
export function DemoAccounts({ accounts, password }: { accounts: Account[]; password: string }) {
  const fill = (u: string) => {
    const user = document.querySelector<HTMLInputElement>("input[name=username]");
    const pass = document.querySelector<HTMLInputElement>("input[name=password]");
    if (user && pass) {
      user.value = u;
      pass.value = password;
      user.form?.requestSubmit();
    }
  };
  return (
    <div className="mt-8 rounded-2xl border border-brand-200 bg-brand-50 p-4">
      <div className="mb-1 font-bold text-brand-800">حسابات التجربة</div>
      <p className="mb-3 text-xs text-brand-700">اضغط على أي حساب للدخول به. كلمة المرور لكل الحسابات: <b dir="ltr">{password}</b></p>
      <ul className="grid gap-1.5">
        {accounts.map((a) => (
          <li key={a.username}>
            <button
              type="button"
              onClick={() => fill(a.username)}
              className="flex w-full items-center gap-3 rounded-xl bg-white px-3 py-2 text-start text-sm shadow-sm ring-1 ring-brand-100 hover:ring-brand-400"
            >
              <span className="w-14 shrink-0 font-mono text-xs text-slate-500" dir="ltr">{a.username}</span>
              <span className="flex-1">
                <span className="font-bold">{a.name}</span>
                <span className="block text-xs text-slate-500">{a.role}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
