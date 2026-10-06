import { notFound, redirect } from "next/navigation";
import { get } from "@/lib/db";
import { requireUser, isHR } from "@/lib/auth";
import { canViewEmployee } from "@/lib/permissions";
import { getEmployee } from "@/lib/hr";
import { PERFORMANCE_CRITERIA, PERFORMANCE_STATUS } from "@/lib/labels";
import { fmtDateTime, num } from "@/lib/time";
import { ActionForm, SubmitButton, PrintButton } from "@/components/forms";
import { Avatar, Card, Field, PageHeader, StatusBadge } from "@/components/ui";
import { reviewStep } from "../actions";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const id = Number((await params).id);
  const p = get<{ id: number; employee_id: number; period: string; reviewer_name: string; scores_json: string; total_score: number; rating: string; strengths: string | null; improvements: string | null; goals: string | null; employee_comment: string | null; status: string; acknowledged_at: string | null; created_by: number; created_at: string }>(
    "SELECT * FROM performance_reviews WHERE id = ?",
    id,
  );
  if (!p) notFound();
  if (!canViewEmployee(u, p.employee_id)) redirect("/performance");
  const e = getEmployee(p.employee_id)!;
  const scores: Record<string, number> = JSON.parse(p.scores_json);
  return (
    <>
      <PageHeader back={{ href: "/performance", label: "تقييم الأداء" }} title={`تقييم أداء — ${p.period}`} subtitle={<StatusBadge map={PERFORMANCE_STATUS} value={p.status} />} actions={<PrintButton />} />
      <div className="print-sheet grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card title="المعايير">
          <div className="space-y-4">
            {PERFORMANCE_CRITERIA.map((c) => (
              <div key={c.key}>
                <div className="mb-1 flex justify-between text-sm"><span className="font-semibold">{c.label}</span><span>{scores[c.key]} / 5</span></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-500" style={{ width: `${(scores[c.key] / 5) * 100}%` }} /></div>
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[["نقاط القوة", p.strengths], ["مجالات التطوير", p.improvements], ["الأهداف", p.goals]].map(([l, v]) => (
              <div key={l} className="rounded-xl bg-slate-50 p-3"><div className="mb-1 text-sm font-bold text-slate-600">{l}</div><p className="whitespace-pre-wrap text-sm">{v || "—"}</p></div>
            ))}
          </div>
        </Card>
        <div className="space-y-6">
          <Card>
            <div className="flex items-center gap-3"><Avatar name={e.full_name} fileId={e.photo_file_id} size={52} /><div><div className="font-bold">{e.full_name}</div><div className="text-sm text-slate-500">المقيّم: {p.reviewer_name}</div></div></div>
            <div className="mt-5 text-center"><div className="text-5xl font-extrabold text-brand-700">{num(p.total_score, 1)}%</div><div className="mt-1 text-lg font-bold">{p.rating}</div></div>
          </Card>
          {p.status === "draft" && (isHR(u) || p.created_by === u.id) && (
            <ActionForm action={reviewStep}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="op" value="submit" /><SubmitButton className="btn-primary w-full">اعتماد وإرسال للموظف</SubmitButton></ActionForm>
          )}
          {p.status === "submitted" && u.employee_id === p.employee_id && (
            <Card title="اطلاعك على التقييم">
              <ActionForm action={reviewStep} className="space-y-3">
                <input type="hidden" name="id" value={p.id} /><input type="hidden" name="op" value="ack" />
                <Field label="ملاحظاتك (اختياري)"><textarea name="employee_comment" className="input" /></Field>
                <SubmitButton className="btn-primary w-full">أقر بالاطلاع على التقييم</SubmitButton>
              </ActionForm>
            </Card>
          )}
          {p.status === "acknowledged" && (
            <Card title="تعليق الموظف"><p className="text-sm">{p.employee_comment || "لا يوجد"}</p><p className="mt-2 text-xs text-slate-500">اطلع في {fmtDateTime(p.acknowledged_at)}</p></Card>
          )}
        </div>
      </div>
    </>
  );
}
