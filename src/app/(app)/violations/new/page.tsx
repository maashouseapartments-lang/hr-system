import { all } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { today } from "@/lib/hr";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, PageHeader } from "@/components/ui";
import { createViolation } from "../actions";

export default async function NewViolationPage({ searchParams }: { searchParams: Promise<{ employee?: string }> }) {
  await requireRole("hr");
  const sp = await searchParams;
  const emps = all<{ id: number; full_name: string; employee_no: string }>("SELECT id, full_name, employee_no FROM employees WHERE status != 'terminated' ORDER BY full_name");
  return (
    <>
      <PageHeader title="تسجيل مخالفة" subtitle="المرحلة الأولى: تسجيل المخالفة وجمع الأدلة" back={{ href: "/violations", label: "المخالفات" }} />
      <Card>
        <ActionForm action={createViolation} className="space-y-5">
          <div className="grid-form">
            <Field label="الموظف *">
              <select name="employee_id" className="input" required defaultValue={sp.employee ?? ""}>
                <option value="" disabled>— اختر —</option>
                {emps.map((e) => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_no})</option>)}
              </select>
            </Field>
            <Field label="تاريخ المخالفة *"><input type="date" name="incident_date" className="input" required defaultValue={today()} /></Field>
            <Field label="الوقت"><input type="time" name="incident_time" className="input" /></Field>
          </div>
          <Field label="مكان المخالفة"><input name="incident_place" className="input" /></Field>
          <Field label="وصف المخالفة *"><textarea name="description" className="input min-h-32" required /></Field>
          <Field label="الأدلة والقرائن" hint="شهود، تسجيلات كاميرات، تقارير، سجل الحضور…"><textarea name="evidence_notes" className="input" /></Field>
          <Field label="مرفقات الأدلة"><input type="file" name="files" multiple accept="application/pdf,image/*" className="input" /></Field>
          <SubmitButton className="btn-primary px-8">تسجيل وفتح التحقيق</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
