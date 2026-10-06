import { getSetting } from "@/lib/db";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, PageHeader, Field } from "@/components/ui";
import { saveGeneralSettings } from "../actions";

export default function GeneralSettingsPage() {
  return (
    <>
      <PageHeader title="إعدادات الاحتساب" subtitle="كيف يحسب النظام الخصومات والعمل الإضافي والتكرار" />
      <Card>
        <ActionForm action={saveGeneralSettings} className="space-y-6">
          <div className="grid-form">
            <Field label="أساس حساب أجر اليوم للخصم" hint="أجر اليوم = الأجر الشهري ÷ 30، وأجر الدقيقة = أجر اليوم ÷ دقائق الدوام">
              <select name="deduction_basis" className="input" defaultValue={getSetting("deduction_basis", "total")}>
                <option value="total">الأجر الكامل (الأساسي + البدلات)</option>
                <option value="basic">الأجر الأساسي فقط</option>
              </select>
            </Field>
            <Field label="نسبة إضافة العمل الإضافي من الأجر الأساسي %" hint="المادة 107: أجر الساعة + 50% من أجر الساعة الأساسي">
              <input name="overtime_rate_basic_pct" type="number" className="input" defaultValue={getSetting("overtime_rate_basic_pct", "50")} />
            </Field>
            <Field label="مدة احتساب تكرار المخالفة (يوم)" hint="المخالفة تُعد متكررة إذا وقعت خلال هذه المدة من سابقتها">
              <input name="violation_repeat_days" type="number" className="input" defaultValue={getSetting("violation_repeat_days", "180")} />
            </Field>
            <Field label="الحد الأقصى للخصم عن المخالفة الواحدة (أيام)" hint="لا يجوز أن يزيد الحسم عن أجر خمسة أيام للمخالفة الواحدة">
              <input name="max_violation_days" type="number" className="input" defaultValue={getSetting("max_violation_days", "5")} />
            </Field>
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-3 text-sm font-semibold">
              <input type="checkbox" name="block_shared_device" defaultChecked={getSetting("block_shared_device") === "1"} className="size-4 accent-brand-600" />
              منع تسجيل الحضور من جهاز سبق أن سجّل منه موظف آخر (مع إرسال تنبيه للشركة في كل الأحوال)
            </label>
            <label className="flex items-center gap-3 text-sm font-semibold">
              <input type="checkbox" name="require_selfie" defaultChecked={getSetting("require_selfie") === "1"} className="size-4 accent-brand-600" />
              إلزام التقاط صورة الوجه عند الحضور والانصراف
            </label>
          </div>
          <SubmitButton>حفظ الإعدادات</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
