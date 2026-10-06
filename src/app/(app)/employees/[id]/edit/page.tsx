import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getEmployee } from "@/lib/hr";
import { PageHeader } from "@/components/ui";
import { EmployeeForm } from "../../employee-form";
import { updateEmployee } from "../../actions";

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("hr");
  const e = getEmployee(Number((await params).id));
  if (!e) notFound();
  return (
    <>
      <PageHeader title={`تعديل: ${e.full_name}`} back={{ href: `/employees/${e.id}`, label: "ملف الموظف" }} />
      <EmployeeForm action={updateEmployee} e={e} />
    </>
  );
}
