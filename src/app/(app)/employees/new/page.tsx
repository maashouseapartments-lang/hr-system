import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { EmployeeForm } from "../employee-form";
import { createEmployee } from "../actions";

export default async function NewEmployeePage() {
  await requireRole("hr");
  return (
    <>
      <PageHeader title="إضافة موظف" back={{ href: "/employees", label: "الموظفون" }} />
      <EmployeeForm action={createEmployee} />
    </>
  );
}
