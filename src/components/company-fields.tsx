import { Field } from "./ui";
import { WEEK_DAYS } from "@/lib/labels";

type Company = Record<string, unknown> | undefined;
const v = (c: Company, k: string) => (c?.[k] as string | undefined) ?? "";

export function CompanyFields({ c }: { c?: Company }) {
  return (
    <div className="grid-form">
      <Field label="اسم الشركة (عربي) *">
        <input name="name_ar" className="input" required defaultValue={v(c, "name_ar")} />
      </Field>
      <Field label="اسم الشركة (إنجليزي)">
        <input name="name_en" className="input" dir="ltr" defaultValue={v(c, "name_en")} />
      </Field>
      <Field label="النشاط">
        <input name="activity" className="input" defaultValue={v(c, "activity")} />
      </Field>
      <Field label="رقم السجل التجاري">
        <input name="cr_number" className="input" dir="ltr" defaultValue={v(c, "cr_number")} />
      </Field>
      <Field label="الرقم الموحد (700)">
        <input name="unified_number" className="input" dir="ltr" defaultValue={v(c, "unified_number")} />
      </Field>
      <Field label="الرقم الضريبي">
        <input name="vat_number" className="input" dir="ltr" defaultValue={v(c, "vat_number")} />
      </Field>
      <Field label="رقم ملف وزارة الموارد البشرية">
        <input name="mol_number" className="input" dir="ltr" defaultValue={v(c, "mol_number")} />
      </Field>
      <Field label="رقم اشتراك التأمينات الاجتماعية">
        <input name="gosi_number" className="input" dir="ltr" defaultValue={v(c, "gosi_number")} />
      </Field>
      <Field label="المدينة">
        <input name="city" className="input" defaultValue={v(c, "city")} />
      </Field>
      <Field label="العنوان الوطني" className="sm:col-span-2">
        <input name="address" className="input" defaultValue={v(c, "address")} />
      </Field>
      <Field label="الرمز البريدي">
        <input name="postal_code" className="input" dir="ltr" defaultValue={v(c, "postal_code")} />
      </Field>
      <Field label="الهاتف">
        <input name="phone" className="input" dir="ltr" defaultValue={v(c, "phone")} />
      </Field>
      <Field label="البريد الإلكتروني">
        <input name="email" type="email" className="input" dir="ltr" defaultValue={v(c, "email")} />
      </Field>
      <Field label="الموقع الإلكتروني">
        <input name="website" className="input" dir="ltr" defaultValue={v(c, "website")} />
      </Field>
      <Field label="المنطقة الزمنية">
        <select name="timezone" className="input" defaultValue={v(c, "timezone") || "Asia/Riyadh"}>
          <option value="Asia/Riyadh">توقيت السعودية (الرياض)</option>
          <option value="Asia/Dubai">توقيت الإمارات</option>
          <option value="Asia/Kuwait">توقيت الكويت</option>
          <option value="Africa/Cairo">توقيت القاهرة</option>
        </select>
      </Field>
      <Field label="شعار الشركة" hint="صورة PNG أو JPG">
        <input name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="input" />
      </Field>
    </div>
  );
}

export function ScheduleFields({ s }: { s?: Record<string, unknown> }) {
  const days = String(s?.work_days ?? "0,1,2,3,4").split(",");
  return (
    <div className="space-y-4">
      <div className="grid-form">
        <Field label="اسم الدوام *">
          <input name="name" className="input" required defaultValue={(s?.name as string) ?? "الدوام الرسمي"} />
        </Field>
        <Field label="بداية الدوام *">
          <input name="start_time" type="time" className="input" required defaultValue={(s?.start_time as string) ?? "07:00"} />
        </Field>
        <Field label="نهاية الدوام *">
          <input name="end_time" type="time" className="input" required defaultValue={(s?.end_time as string) ?? "16:00"} />
        </Field>
        <Field label="بداية الاستراحة (البريك)">
          <input name="break_start" type="time" className="input" defaultValue={(s?.break_start as string) ?? "12:00"} />
        </Field>
        <Field label="نهاية الاستراحة">
          <input name="break_end" type="time" className="input" defaultValue={(s?.break_end as string) ?? "13:00"} />
        </Field>
        <Field label="فترة السماح (بالدقائق)" hint="مثال: 30 تعني أن الحضور حتى 7:30 لا يُحتسب تأخيراً، والحضور 7:31 = دقيقة تأخير">
          <input name="grace_minutes" type="number" min={0} max={240} className="input" defaultValue={(s?.grace_minutes as number) ?? 30} />
        </Field>
        <Field label="يسري من تاريخ" hint="اتركه فارغاً ليسري دائماً">
          <input name="effective_from" type="date" className="input" defaultValue={(s?.effective_from as string) ?? ""} />
        </Field>
        <Field label="ينتهي في تاريخ" hint="مثال: دوام رمضان">
          <input name="effective_to" type="date" className="input" defaultValue={(s?.effective_to as string) ?? ""} />
        </Field>
      </div>
      <div>
        <span className="label">أيام العمل</span>
        <div className="flex flex-wrap gap-2">
          {WEEK_DAYS.map((d, i) => (
            <label key={i} className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:checked]:font-bold">
              <input type="checkbox" name="work_days" value={i} defaultChecked={days.includes(String(i))} className="accent-brand-600" />
              {d}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
