import { all } from "@/lib/db";
import { requireRole, ROLE_LABELS, type Role } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, PageHeader, Field, Alert } from "@/components/ui";
import { saveUser } from "../actions";

type U = { id: number; username: string; display_name: string; role: Role; employee_id: number | null; active: number; emp_name: string | null };

function RoleSelect({ value }: { value?: string }) {
  return (
    <select name="role" className="input" defaultValue={value ?? "employee"}>
      {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </select>
  );
}

export default async function UsersPage() {
  await requireRole("admin");
  const users = all<U>("SELECT u.*, e.full_name AS emp_name FROM users u LEFT JOIN employees e ON e.id = u.employee_id ORDER BY u.role, u.display_name");
  const emps = all<{ id: number; full_name: string; employee_no: string }>("SELECT id, full_name, employee_no FROM employees ORDER BY full_name");
  const EmpSelect = ({ value }: { value?: number | null }) => (
    <select name="employee_id" className="input" defaultValue={value ?? ""}>
      <option value="">— غير مرتبط بموظف —</option>
      {emps.map((e) => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_no})</option>)}
    </select>
  );
  return (
    <>
      <PageHeader title="المستخدمون والصلاحيات" />
      <div className="mb-6">
        <Alert tone="sky" title="كيف تعمل الصلاحيات؟">
          <b>الموارد البشرية</b>: كل المعاملات والملفات. <b>المدير الإداري</b>: توقيع واعتماد الإجازات والتسويات والجزاءات.
          <b> القسم المالي</b>: تحويل المستحقات ورفع الإيصالات. <b>موظف</b>: الحضور وطلباته. أي موظف يكون مديراً مباشراً أو مدير قسم
          تظهر له تلقائياً موافقات فريقه.
        </Alert>
      </div>
      <Card title="إضافة مستخدم" className="mb-6">
        <ActionForm action={saveUser} resetOnSuccess className="grid items-end gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Field label="الاسم *"><input name="display_name" className="input" required /></Field>
          <Field label="اسم المستخدم *"><input name="username" className="input" dir="ltr" required /></Field>
          <Field label="كلمة المرور *"><input name="password" className="input" dir="ltr" required /></Field>
          <Field label="الصلاحية"><RoleSelect /></Field>
          <Field label="الموظف المرتبط"><EmpSelect /></Field>
          <SubmitButton>إضافة</SubmitButton>
        </ActionForm>
      </Card>
      <Card title="المستخدمون" pad={false}>
        {users.map((u) => (
          <ActionForm key={u.id} action={saveUser} className="grid items-end gap-3 border-b border-slate-100 px-5 py-4 md:grid-cols-3 lg:grid-cols-[1.2fr_1fr_1fr_1.3fr_1fr_auto]">
            <input type="hidden" name="id" value={u.id} />
            <Field label={`@${u.username}`}><input name="display_name" className="input" defaultValue={u.display_name} /></Field>
            <Field label="الصلاحية"><RoleSelect value={u.role} /></Field>
            <Field label="كلمة مرور جديدة"><input name="password" className="input" dir="ltr" placeholder="اتركها فارغة" /></Field>
            <Field label="الموظف المرتبط"><EmpSelect value={u.employee_id} /></Field>
            <label className="flex items-center gap-2 pb-3 text-sm font-semibold">
              <input type="checkbox" name="active" defaultChecked={!!u.active} className="size-4 accent-brand-600" /> فعّال
              {!u.active && <Badge tone="rose">موقوف</Badge>}
            </label>
            <SubmitButton className="btn-secondary">حفظ</SubmitButton>
          </ActionForm>
        ))}
      </Card>
    </>
  );
}
