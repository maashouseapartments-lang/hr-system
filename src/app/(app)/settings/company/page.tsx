import { getCompany } from "@/lib/company";
import { ActionForm, SubmitButton } from "@/components/forms";
import { CompanyFields } from "@/components/company-fields";
import { Card, PageHeader } from "@/components/ui";
import { updateCompany } from "../actions";

export default function CompanyPage() {
  const c = getCompany();
  return (
    <>
      <PageHeader title="بيانات الشركة" subtitle="تظهر في رأس النماذج والمستندات المطبوعة" />
      <Card>
        <ActionForm action={updateCompany} className="space-y-6">
          {c?.logo_file_id && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/files/${c.logo_file_id}`} alt="الشعار" className="h-20 rounded-xl border border-slate-200 bg-white object-contain p-2" />
          )}
          <CompanyFields c={c} />
          <SubmitButton>حفظ البيانات</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
