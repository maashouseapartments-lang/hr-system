import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Card, Empty, PageHeader } from "@/components/ui";

export default async function MePage() {
  const u = await requireUser();
  if (u.employee_id) redirect(`/employees/${u.employee_id}`);
  return (
    <>
      <PageHeader title="ملفي الوظيفي" />
      <Card><Empty title="حسابك غير مرتبط بملف موظف">اطلب من مدير النظام ربط حسابك بملفك الوظيفي من صفحة المستخدمين.</Empty></Card>
    </>
  );
}
