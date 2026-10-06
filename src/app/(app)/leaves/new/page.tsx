import { all } from "@/lib/db";
import { requireUser, isHR } from "@/lib/auth";
import { annualEligibility, getEmployee, today } from "@/lib/hr";
import { fmtDate, num } from "@/lib/time";
import { ActionForm, AutoSubmitSelect, SubmitButton } from "@/components/forms";
import { Alert, Badge, Card, Field, PageHeader } from "@/components/ui";
import { createLeave } from "../actions";

export default async function NewLeavePage({ searchParams }: { searchParams: Promise<{ employee?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const hr = isHR(u);
  const empId = hr ? (sp.employee ? Number(sp.employee) : null) : u.employee_id;
  const e = empId ? getEmployee(empId) : undefined;
  const elig = e ? annualEligibility(e, today()) : null;
  const types = all<{ id: number; name: string; default_days: number | null; legal_reference: string | null }>("SELECT * FROM leave_types WHERE active = 1 ORDER BY id");
  const emps = hr ? all<{ id: number; full_name: string; employee_no: string }>("SELECT id, full_name, employee_no FROM employees WHERE status != 'terminated' ORDER BY full_name") : [];
  return (
    <>
      <PageHeader title="طلب إجازة جديد" back={{ href: "/leaves", label: "الإجازات" }} />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          {hr && (
            <form className="mb-5 border-b border-slate-100 pb-5">
              <Field label="الموظف *">
                <AutoSubmitSelect name="employee" defaultValue={empId ?? ""} className="input">
                  <option value="">— اختر الموظف —</option>
                  {emps.map((x) => <option key={x.id} value={x.id}>{x.full_name} ({x.employee_no})</option>)}
                </AutoSubmitSelect>
              </Field>
            </form>
          )}
          {!e ? (
            <Alert tone="sky">{hr ? "اختر الموظف أولاً" : "حسابك غير مرتبط بملف موظف"}</Alert>
          ) : (
            <ActionForm action={createLeave} className="space-y-5">
              <input type="hidden" name="employee_id" value={e.id} />
              <Field label="نوع الإجازة" hint="ستراجع الموارد البشرية النوع وتعتمده">
                <select name="leave_type_id" className="input" defaultValue={types[0]?.id}>
                  {types.map((t) => <option key={t.id} value={t.id}>{t.name}{t.default_days ? ` (${t.default_days} يوم)` : ""}</option>)}
                </select>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="من تاريخ *"><input type="date" name="start_date" className="input" required /></Field>
                <Field label="إلى تاريخ *"><input type="date" name="end_date" className="input" required /></Field>
              </div>
              <Field label="جهة السفر / مكان قضاء الإجازة"><input name="destination" className="input" /></Field>
              <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="needs_visa" className="size-4 accent-brand-600" /> يحتاج تأشيرة خروج وعودة</label>
              <Field label="السبب / ملاحظات"><textarea name="reason" className="input" /></Field>
              <Field label="مرفقات (اختياري)" hint="مثل نموذج الطلب الورقي الموقع أو تقرير طبي"><input type="file" name="files" multiple accept="application/pdf,image/*" className="input" /></Field>
              <SubmitButton className="btn-primary px-8">إرسال الطلب</SubmitButton>
            </ActionForm>
          )}
        </Card>
        {e && elig && (
          <Card title={`رصيد ${e.full_name.split(" ")[0]} السنوي`}>
            <div className="mb-3 text-4xl font-extrabold text-brand-700">{num(elig.balance, 1)} <span className="text-base font-semibold text-slate-500">يوم</span></div>
            <dl className="kv">
              <dt>مدة الخدمة</dt><dd>{num(elig.serviceYears, 1)} سنة</dd>
              <dt>الاستحقاق</dt><dd><Badge tone="brand">{elig.entitlementPerYear} يوماً سنوياً</Badge></dd>
              <dt>آخر إجازة</dt><dd>{elig.lastLeaveReturn ? fmtDate(elig.lastLeaveReturn) : "لا يوجد"}</dd>
              <dt>منذ آخر إجازة</dt><dd>{num(elig.daysSinceLastLeave)} يوم</dd>
            </dl>
            {!elig.completedFirstYear && <div className="mt-3"><Alert tone="amber">لم يُكمل السنة الأولى من الخدمة</Alert></div>}
            {elig.yearPassedSinceLastLeave && <div className="mt-3"><Alert tone="brand">مضى أكثر من سنة على آخر إجازة — مستحق</Alert></div>}
          </Card>
        )}
      </div>
    </>
  );
}
