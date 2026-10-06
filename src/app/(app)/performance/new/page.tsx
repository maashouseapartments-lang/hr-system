import { redirect } from "next/navigation";
import { all } from "@/lib/db";
import { requireUser, isHR } from "@/lib/auth";
import { teamIds } from "@/lib/permissions";
import { PERFORMANCE_CRITERIA } from "@/lib/labels";
import { today } from "@/lib/hr";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, PageHeader } from "@/components/ui";
import { saveReview } from "../actions";

const LEVELS = ["ضعيف", "مقبول", "جيد", "جيد جداً", "ممتاز"];

export default async function NewReviewPage({ searchParams }: { searchParams: Promise<{ employee?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const team = teamIds(u);
  if (!isHR(u) && !team.length) redirect("/performance");
  const emps = all<{ id: number; full_name: string }>(`SELECT id, full_name FROM employees WHERE status != 'terminated' ${isHR(u) ? "" : `AND id IN (${team.join(",")})`} ORDER BY full_name`);
  const y = today().slice(0, 4);
  return (
    <>
      <PageHeader title="تقييم أداء جديد" back={{ href: "/performance", label: "تقييم الأداء" }} />
      <ActionForm action={saveReview} className="space-y-6">
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="الموظف *">
              <select name="employee_id" className="input" required defaultValue={sp.employee ?? ""}><option value="" disabled>— اختر —</option>{emps.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select>
            </Field>
            <Field label="فترة التقييم *"><input name="period" className="input" required defaultValue={`السنوي ${y}`} list="periods" />
              <datalist id="periods"><option value={`السنوي ${y}`} /><option value={`النصف الأول ${y}`} /><option value={`النصف الثاني ${y}`} /><option value="نهاية فترة التجربة" /></datalist>
            </Field>
          </div>
        </Card>
        <Card title="معايير التقييم">
          <div className="space-y-4">
            {PERFORMANCE_CRITERIA.map((c) => (
              <div key={c.key} className="flex flex-col gap-2 border-b border-slate-100 pb-4 lg:flex-row lg:items-center">
                <div className="flex-1 font-semibold">{c.label} <span className="text-xs text-slate-400">(الوزن {c.weight}%)</span></div>
                <div className="flex flex-wrap gap-1.5">
                  {LEVELS.map((l, i) => (
                    <label key={i} className="cursor-pointer rounded-xl border border-slate-300 px-3 py-1.5 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-600 has-[:checked]:text-white">
                      <input type="radio" name={`score_${c.key}`} value={i + 1} className="sr-only" required /> {i + 1} — {l}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="الملاحظات">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="نقاط القوة"><textarea name="strengths" className="input" /></Field>
            <Field label="مجالات التطوير"><textarea name="improvements" className="input" /></Field>
            <Field label="الأهداف للفترة القادمة"><textarea name="goals" className="input" /></Field>
          </div>
        </Card>
        <div className="flex gap-2">
          <SubmitButton name="submit" value="send">اعتماد وإرسال للموظف</SubmitButton>
          <SubmitButton name="submit" value="draft" className="btn-secondary">حفظ كمسودة</SubmitButton>
        </div>
      </ActionForm>
    </>
  );
}
