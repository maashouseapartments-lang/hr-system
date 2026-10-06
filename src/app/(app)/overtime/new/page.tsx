import { all } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { today } from "@/lib/hr";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, PageHeader } from "@/components/ui";
import { createOvertime } from "../actions";

export default async function NewOvertimePage() {
  const u = await requireUser();
  const depts = all<{ id: number; name: string }>("SELECT id, name FROM departments ORDER BY name");
  const locs = all<{ id: number; name: string }>("SELECT id, name FROM locations WHERE active = 1 ORDER BY name");
  const myDept = u.headed_departments[0];
  return (
    <>
      <PageHeader title="طلب عمل إضافي" subtitle="مثال: مدير المستودع يطلب موظفين للعمل الساعة 7 مساءً" back={{ href: "/overtime", label: "العمل الإضافي" }} />
      <Card>
        <ActionForm action={createOvertime} className="space-y-5">
          <div className="grid-form">
            <Field label="القسم الطالب"><select name="department_id" className="input" defaultValue={myDept ?? ""}><option value="">—</option>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
            <Field label="مقدم الطلب"><input name="requested_by_name" className="input" defaultValue={u.display_name} /></Field>
            <Field label="عدد الموظفين المطلوب"><input type="number" name="employees_needed" min={1} className="input" /></Field>
            <Field label="التاريخ *"><input type="date" name="work_date" className="input" required defaultValue={today()} /></Field>
            <Field label="من الساعة *"><input type="time" name="start_time" className="input" required defaultValue="19:00" /></Field>
            <Field label="إلى الساعة *"><input type="time" name="end_time" className="input" required defaultValue="22:00" /></Field>
            <Field label="الموقع"><select name="location_id" className="input"><option value="">—</option>{locs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>
          </div>
          <Field label="سبب العمل الإضافي *"><textarea name="reason" className="input" required placeholder="مثال: استلام شحنة طارئة في المستودع" /></Field>
          <Field label="صورة الطلب الورقي من القسم" hint="الورقة الموقعة من مدير القسم"><input type="file" name="files" multiple accept="application/pdf,image/*" className="input" /></Field>
          <SubmitButton className="btn-primary px-8">رفع الطلب</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
