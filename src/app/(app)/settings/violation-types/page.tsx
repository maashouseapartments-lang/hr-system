import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { all, get } from "@/lib/db";
import { penaltyLabel } from "@/lib/hr";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, PageHeader, Field, Alert } from "@/components/ui";
import { saveViolationType } from "../actions";

type VT = { id: number; code: string; category: string; description: string; penalty1: string; penalty2: string; penalty3: string; penalty4: string; active: number };

function PenaltyInput({ name, label, value }: { name: string; label: string; value?: string }) {
  const [kind, val] = (value ?? "warning").split(":");
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="label">{label}</div>
      <select name={`${name}_kind`} className="input mb-2" defaultValue={kind}>
        <option value="warning">إنذار كتابي</option>
        <option value="warning_time">إنذار + حسم مدة التأخير</option>
        <option value="pct">حسم نسبة من أجر اليوم %</option>
        <option value="days">حسم أجر أيام</option>
        <option value="dismiss">فصل مع المكافأة</option>
        <option value="dismiss_no_award">فصل دون مكافأة (م80)</option>
      </select>
      <input name={`${name}_val`} type="number" step="0.5" className="input" placeholder="القيمة (للنسبة أو الأيام)" defaultValue={val ?? ""} />
    </div>
  );
}

export default async function ViolationTypesPage({ searchParams }: { searchParams: Promise<{ edit?: string; new?: string }> }) {
  const sp = await searchParams;
  const types = all<VT>("SELECT * FROM violation_types ORDER BY category, id");
  const editing = sp.edit ? get<VT>("SELECT * FROM violation_types WHERE id = ?", Number(sp.edit)) : undefined;
  const showForm = !!editing || !!sp.new;
  const cats = [...new Set(types.map((t) => t.category))];
  return (
    <>
      <PageHeader
        title="لائحة المخالفات والجزاءات"
        subtitle="جدول المخالفات وجزاء كل تكرار. يختار النظام الجزاء تلقائياً حسب عدد مرات التكرار"
        actions={!showForm && <Link href="?new=1" className="btn-primary"><Plus className="size-4" /> إضافة بند</Link>}
      />
      {showForm ? (
        <Card title={editing ? `تعديل البند ${editing.code}` : "بند جديد"}>
          <ActionForm action={saveViolationType} className="space-y-5">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
              <Field label="رقم البند *"><input name="code" className="input" required defaultValue={editing?.code ?? ""} /></Field>
              <Field label="التصنيف *">
                <input name="category" className="input" required list="cats" defaultValue={editing?.category ?? ""} />
                <datalist id="cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
              </Field>
            </div>
            <Field label="وصف المخالفة *"><textarea name="description" className="input" required defaultValue={editing?.description ?? ""} /></Field>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <PenaltyInput name="p1" label="المرة الأولى" value={editing?.penalty1} />
              <PenaltyInput name="p2" label="المرة الثانية" value={editing?.penalty2} />
              <PenaltyInput name="p3" label="المرة الثالثة" value={editing?.penalty3} />
              <PenaltyInput name="p4" label="المرة الرابعة" value={editing?.penalty4} />
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" name="active" defaultChecked={editing ? !!editing.active : true} className="size-4 accent-brand-600" /> مفعّل
            </label>
            <div className="flex gap-2">
              <SubmitButton>حفظ</SubmitButton>
              <Link href="/settings/violation-types" className="btn-secondary">إلغاء</Link>
            </div>
          </ActionForm>
        </Card>
      ) : (
        <div className="space-y-6">
          <Alert tone="amber">
            الجدول مبني على اللائحة النموذجية لتنظيم العمل الصادرة من وزارة الموارد البشرية. راجعه وطابقه مع لائحة تنظيم العمل المعتمدة لمنشأتك قبل التطبيق.
          </Alert>
          {cats.map((c) => (
            <Card key={c} title={`مخالفات ${c}`} pad={false}>
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>البند</th><th>المخالفة</th><th>المرة الأولى</th><th>الثانية</th><th>الثالثة</th><th>الرابعة</th><th /></tr></thead>
                  <tbody>
                    {types.filter((t) => t.category === c).map((t) => (
                      <tr key={t.id} className={t.active ? "" : "opacity-50"}>
                        <td className="font-bold">{t.code}</td>
                        <td className="min-w-72 leading-6">{t.description}</td>
                        {[t.penalty1, t.penalty2, t.penalty3, t.penalty4].map((p, i) => (
                          <td key={i} className="text-xs"><Badge tone={p.startsWith("dismiss") ? "rose" : p.startsWith("warning") ? "slate" : "amber"}>{penaltyLabel(p)}</Badge></td>
                        ))}
                        <td><Link href={`?edit=${t.id}`} className="btn-ghost btn-sm"><Pencil className="size-4" /></Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
