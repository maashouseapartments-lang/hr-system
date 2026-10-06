import Link from "next/link";
import { Plus, Pencil, Printer, Trash2, Users } from "lucide-react";
import { all, get } from "@/lib/db";
import { requireUser, isHR } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Empty, Field, PageHeader } from "@/components/ui";
import { savePosition, deletePosition } from "./actions";

type P = Record<string, string | number | null> & { id: number; title: string };

export default async function PositionsPage({ searchParams }: { searchParams: Promise<{ edit?: string; new?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const hr = isHR(u);
  const rows = all<P & { dept: string | null; emp_count: number }>(
    `SELECT p.*, d.name AS dept, (SELECT COUNT(*) FROM employees e WHERE e.position_id = p.id AND e.status != 'terminated') AS emp_count
       FROM positions p LEFT JOIN departments d ON d.id = p.department_id ORDER BY d.name, p.title`,
  );
  const editing = hr && sp.edit ? get<P>("SELECT * FROM positions WHERE id = ?", Number(sp.edit)) : undefined;
  const showForm = hr && (!!editing || !!sp.new);
  const depts = all<{ id: number; name: string }>("SELECT id, name FROM departments ORDER BY name");
  const v = (k: string) => (editing?.[k] ?? "") as string;
  const area = (k: string, label: string, hint?: string) => (
    <Field label={label} hint={hint}><textarea name={k} className="input min-h-28" defaultValue={v(k)} /></Field>
  );
  return (
    <>
      <PageHeader
        title="المسميات والأوصاف الوظيفية"
        subtitle="لكل مسمى وصف وظيفي يظهر في ملف الموظف ويمكن طباعته"
        actions={hr && !showForm && <Link href="?new=1" className="btn-primary"><Plus className="size-4" /> مسمى جديد</Link>}
      />
      {showForm ? (
        <Card title={editing ? `تعديل: ${editing.title}` : "مسمى وظيفي جديد"}>
          <ActionForm action={savePosition} className="space-y-5">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="grid-form">
              <Field label="المسمى الوظيفي *"><input name="title" className="input" required defaultValue={v("title")} /></Field>
              <Field label="القسم">
                <select name="department_id" className="input" defaultValue={v("department_id")}><option value="">—</option>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
              </Field>
              <Field label="يرفع تقاريره إلى">
                <select name="reports_to_position_id" className="input" defaultValue={v("reports_to_position_id")}><option value="">—</option>{rows.filter((r) => r.id !== editing?.id).map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</select>
              </Field>
              <Field label="الدرجة / المرتبة"><input name="grade" className="input" defaultValue={v("grade")} /></Field>
            </div>
            {area("summary", "الهدف العام للوظيفة")}
            {area("duties", "المهام والمسؤوليات", "اكتب كل مهمة في سطر")}
            <div className="grid gap-4 md:grid-cols-2">
              {area("qualifications", "المؤهلات العلمية")}
              {area("experience", "الخبرات المطلوبة")}
              {area("skills", "المهارات")}
              {area("kpis", "مؤشرات قياس الأداء")}
            </div>
            {area("work_conditions", "ظروف وبيئة العمل")}
            <div className="flex gap-2"><SubmitButton>حفظ</SubmitButton><Link href="/positions" className="btn-secondary">إلغاء</Link></div>
          </ActionForm>
        </Card>
      ) : rows.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => (
            <div key={p.id} className="card flex flex-col p-5">
              <div className="mb-1 text-lg font-bold">{p.title}</div>
              <div className="mb-3 flex items-center gap-3 text-sm text-slate-500">
                <span>{p.dept ?? "بدون قسم"}</span><span className="inline-flex items-center gap-1"><Users className="size-4" /> {p.emp_count}</span>
              </div>
              <p className="mb-4 line-clamp-3 flex-1 text-sm leading-7 text-slate-600">{(p.summary as string) || "لا يوجد وصف بعد"}</p>
              <div className="flex gap-1 border-t border-slate-100 pt-3">
                <Link href={`/positions/${p.id}/print`} className="btn-ghost btn-sm"><Printer className="size-4" /> عرض وطباعة</Link>
                {hr && <Link href={`?edit=${p.id}`} className="btn-ghost btn-sm"><Pencil className="size-4" /> تعديل</Link>}
                {hr && <form action={deletePosition} className="ms-auto"><input type="hidden" name="id" value={p.id} /><button className="btn-ghost btn-sm text-rose-600"><Trash2 className="size-4" /></button></form>}
              </div>
            </div>
          ))}
        </div>
      ) : <Card><Empty title="لا توجد مسميات وظيفية" /></Card>}
    </>
  );
}
