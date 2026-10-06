import Link from "next/link";
import { Plus, Pencil, Trash2, CornerDownLeft } from "lucide-react";
import { all, get } from "@/lib/db";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, PageHeader, Field, Empty } from "@/components/ui";
import { saveDepartment, deleteDepartment } from "../actions";

type Dept = {
  id: number; name: string; code: string | null; parent_id: number | null; head_employee_id: number | null;
  in_clearance: number; clearance_items: string | null; sort_order: number; head_name: string | null; emp_count: number;
};

export default async function DepartmentsPage({ searchParams }: { searchParams: Promise<{ edit?: string; new?: string; parent?: string }> }) {
  const sp = await searchParams;
  const depts = all<Dept>(
    `SELECT d.*, e.full_name AS head_name, (SELECT COUNT(*) FROM employees x WHERE x.department_id = d.id AND x.status != 'terminated') AS emp_count
       FROM departments d LEFT JOIN employees e ON e.id = d.head_employee_id ORDER BY d.sort_order, d.name`,
  );
  const editing = sp.edit ? get<Dept>("SELECT * FROM departments WHERE id = ?", Number(sp.edit)) : undefined;
  const showForm = !!editing || !!sp.new;
  const employees = all<{ id: number; full_name: string }>("SELECT id, full_name FROM employees WHERE status != 'terminated' ORDER BY full_name");

  const children = (pid: number | null): Dept[] => depts.filter((d) => d.parent_id === pid);
  const renderTree = (pid: number | null, level: number): React.ReactNode =>
    children(pid).map((d) => (
      <div key={d.id}>
        <div className="flex items-center gap-3 border-b border-slate-100 py-3" style={{ paddingInlineStart: level * 28 }}>
          {level > 0 && <CornerDownLeft className="size-4 shrink-0 text-slate-300" />}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 font-bold">
              {d.name}
              {d.code && <span className="text-xs font-normal text-slate-400">{d.code}</span>}
              {!!d.in_clearance && <Badge tone="violet">ضمن إخلاء الطرف</Badge>}
            </div>
            <div className="text-sm text-slate-500">
              المدير: {d.head_name ?? <span className="text-amber-600">غير محدد</span>} • {d.emp_count} موظف
            </div>
          </div>
          <Link href={`?new=1&parent=${d.id}`} className="btn-ghost btn-sm" title="إضافة قسم فرعي"><Plus className="size-4" /></Link>
          <Link href={`?edit=${d.id}`} className="btn-ghost btn-sm"><Pencil className="size-4" /></Link>
          <form action={deleteDepartment}>
            <input type="hidden" name="id" value={d.id} />
            <button className="btn-ghost btn-sm text-rose-600"><Trash2 className="size-4" /></button>
          </form>
        </div>
        {renderTree(d.id, level + 1)}
      </div>
    ));

  return (
    <>
      <PageHeader
        title="الأقسام والهيكل التنظيمي"
        subtitle="رتّب الأقسام الرئيسية والفرعية، وحدّد مدير كل قسم (هو من يوافق على طلبات موظفيه ويوقّع إخلاء الطرف)"
        actions={<>
          <Link href="/org-chart" className="btn-secondary">عرض الهيكل</Link>
          {!showForm && <Link href="?new=1" className="btn-primary"><Plus className="size-4" /> إضافة قسم</Link>}
        </>}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <Card title="شجرة الأقسام" pad={false}>
          <div className="px-5">{depts.length ? renderTree(null, 0) : <Empty title="لم تُضف أقسام بعد">ابدأ بإضافة الإدارات الرئيسية مثل: الإدارة العامة، الموارد البشرية، المالية، المستودعات…</Empty>}</div>
        </Card>
        {showForm && (
          <Card title={editing ? `تعديل: ${editing.name}` : "قسم جديد"}>
            <ActionForm action={saveDepartment} className="space-y-4">
              {editing && <input type="hidden" name="id" value={editing.id} />}
              <Field label="اسم القسم *"><input name="name" className="input" required defaultValue={editing?.name ?? ""} /></Field>
              <Field label="الرمز"><input name="code" className="input" dir="ltr" defaultValue={editing?.code ?? ""} /></Field>
              <Field label="يتبع لـ">
                <select name="parent_id" className="input" defaultValue={editing?.parent_id ?? sp.parent ?? ""}>
                  <option value="">— قسم رئيسي —</option>
                  {depts.filter((d) => d.id !== editing?.id).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
              <Field label="مدير القسم" hint="يمكن تحديده بعد إضافة الموظفين">
                <select name="head_employee_id" className="input" defaultValue={editing?.head_employee_id ?? ""}>
                  <option value="">— غير محدد —</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </Field>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" name="in_clearance" defaultChecked={editing ? !!editing.in_clearance : true} className="size-4 accent-brand-600" />
                يظهر في نموذج إخلاء الطرف (استلام العهد)
              </label>
              <Field label="العهد المعتادة لدى هذا القسم" hint="مثال: لابتوب، جوال، مفاتيح، بطاقة دخول، سيارة">
                <textarea name="clearance_items" className="input" defaultValue={editing?.clearance_items ?? ""} />
              </Field>
              <Field label="ترتيب العرض"><input name="sort_order" type="number" className="input" defaultValue={editing?.sort_order ?? 0} /></Field>
              <div className="flex gap-2">
                <SubmitButton>حفظ</SubmitButton>
                <Link href="/settings/departments" className="btn-secondary">إلغاء</Link>
              </div>
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
