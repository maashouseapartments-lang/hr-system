import Link from "next/link";
import { all } from "@/lib/db";
import { ActionForm, SubmitButton, type FormAction } from "@/components/forms";
import { Card, Field } from "@/components/ui";
import type { Employee } from "@/lib/hr";

const NATIONALITIES = ["سعودي", "مصري", "يمني", "سوداني", "أردني", "سوري", "باكستاني", "هندي", "بنغلاديشي", "فلبيني", "نيبالي", "أخرى"];

export function EmployeeForm({ action, e }: { action: FormAction; e?: Employee }) {
  const depts = all<{ id: number; name: string }>("SELECT id, name FROM departments ORDER BY sort_order, name");
  const positions = all<{ id: number; title: string; dept: string | null }>(
    "SELECT p.id, p.title, d.name AS dept FROM positions p LEFT JOIN departments d ON d.id = p.department_id ORDER BY p.title",
  );
  const managers = all<{ id: number; full_name: string }>("SELECT id, full_name FROM employees WHERE status != 'terminated' AND id != ? ORDER BY full_name", e?.id ?? 0);
  const schedules = all<{ id: number; name: string; is_default: number }>("SELECT id, name, is_default FROM schedules ORDER BY is_default DESC, name");
  const locations = all<{ id: number; name: string }>("SELECT id, name FROM locations WHERE active = 1 ORDER BY name");
  const myLocs = e ? all<{ location_id: number }>("SELECT location_id FROM employee_locations WHERE employee_id = ?", e.id).map((x) => x.location_id) : locations.map((l) => l.id);
  const v = (k: string) => ((e?.[k] as string | number | null | undefined) ?? "") as string;

  return (
    <ActionForm action={action} className="space-y-6">
      {e && <input type="hidden" name="id" value={e.id} />}
      <Card title="البيانات الشخصية">
        <div className="grid-form">
          <Field label="الرقم الوظيفي *"><input name="employee_no" className="input" dir="ltr" required defaultValue={v("employee_no")} /></Field>
          <Field label="الاسم الكامل (عربي) *"><input name="full_name" className="input" required defaultValue={v("full_name")} /></Field>
          <Field label="الاسم (إنجليزي)"><input name="full_name_en" className="input" dir="ltr" defaultValue={v("full_name_en")} /></Field>
          <Field label="نوع الهوية">
            <select name="id_type" className="input" defaultValue={v("id_type") || "هوية وطنية"}>
              <option>هوية وطنية</option><option>إقامة</option><option>جواز سفر</option>
            </select>
          </Field>
          <Field label="رقم الهوية / الإقامة"><input name="national_id" className="input" dir="ltr" defaultValue={v("national_id")} /></Field>
          <Field label="تاريخ انتهاء الهوية"><input name="id_expiry" type="date" className="input" defaultValue={v("id_expiry")} /></Field>
          <Field label="الجنسية">
            <input name="nationality" className="input" list="nats" defaultValue={v("nationality")} />
            <datalist id="nats">{NATIONALITIES.map((n) => <option key={n} value={n} />)}</datalist>
          </Field>
          <Field label="رقم الجواز"><input name="passport_no" className="input" dir="ltr" defaultValue={v("passport_no")} /></Field>
          <Field label="انتهاء الجواز"><input name="passport_expiry" type="date" className="input" defaultValue={v("passport_expiry")} /></Field>
          <Field label="الجنس">
            <select name="gender" className="input" defaultValue={v("gender")}><option value="">—</option><option>ذكر</option><option>أنثى</option></select>
          </Field>
          <Field label="تاريخ الميلاد"><input name="birth_date" type="date" className="input" defaultValue={v("birth_date")} /></Field>
          <Field label="الحالة الاجتماعية">
            <select name="marital_status" className="input" defaultValue={v("marital_status")}><option value="">—</option><option>أعزب</option><option>متزوج</option><option>مطلق</option><option>أرمل</option></select>
          </Field>
          <Field label="الديانة"><input name="religion" className="input" defaultValue={v("religion")} /></Field>
          <Field label="المؤهل العلمي"><input name="education" className="input" defaultValue={v("education")} /></Field>
        </div>
      </Card>

      <Card title="التواصل">
        <div className="grid-form">
          <Field label="الجوال"><input name="phone" className="input" dir="ltr" defaultValue={v("phone")} /></Field>
          <Field label="البريد الإلكتروني"><input name="email" type="email" className="input" dir="ltr" defaultValue={v("email")} /></Field>
          <Field label="العنوان"><input name="address" className="input" defaultValue={v("address")} /></Field>
          <Field label="شخص للطوارئ"><input name="emergency_contact" className="input" defaultValue={v("emergency_contact")} /></Field>
          <Field label="جوال الطوارئ"><input name="emergency_phone" className="input" dir="ltr" defaultValue={v("emergency_phone")} /></Field>
        </div>
      </Card>

      <Card title="البيانات الوظيفية">
        <div className="grid-form">
          <Field label="القسم">
            <select name="department_id" className="input" defaultValue={v("department_id")}>
              <option value="">—</option>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="المسمى الوظيفي" hint="المسميات من صفحة «الأوصاف الوظيفية»">
            <select name="position_id" className="input" defaultValue={v("position_id")}>
              <option value="">—</option>{positions.map((p) => <option key={p.id} value={p.id}>{p.title}{p.dept ? ` — ${p.dept}` : ""}</option>)}
            </select>
          </Field>
          <Field label="المدير المباشر">
            <select name="manager_id" className="input" defaultValue={v("manager_id")}>
              <option value="">—</option>{managers.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          </Field>
          <Field label="تاريخ المباشرة *" hint="يُحسب منه استحقاق الإجازة السنوية"><input name="hire_date" type="date" className="input" required defaultValue={v("hire_date")} /></Field>
          <Field label="نوع العقد">
            <select name="contract_type" className="input" defaultValue={v("contract_type") || "غير محدد المدة"}><option>غير محدد المدة</option><option>محدد المدة</option><option>تدريب</option><option>دوام جزئي</option></select>
          </Field>
          <Field label="تاريخ انتهاء العقد"><input name="contract_end" type="date" className="input" defaultValue={v("contract_end")} /></Field>
          <Field label="الدوام">
            <select name="schedule_id" className="input" defaultValue={v("schedule_id")}>
              <option value="">الدوام الافتراضي</option>{schedules.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="حالة الموظف">
            <select name="status" className="input" defaultValue={v("status") || "active"}>
              <option value="active">على رأس العمل</option><option value="on_leave">في إجازة</option><option value="suspended">موقوف</option><option value="terminated">منتهية خدمته</option>
            </select>
          </Field>
        </div>
        {locations.length > 0 && (
          <div className="mt-5">
            <span className="label">مواقع الحضور المسموحة</span>
            <div className="flex flex-wrap gap-2">
              {locations.map((l) => (
                <label key={l.id} className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                  <input type="checkbox" name="location_ids" value={l.id} defaultChecked={myLocs.includes(l.id)} className="accent-brand-600" /> {l.name}
                </label>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card title="الراتب والبدلات (شهري)">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="الراتب الأساسي"><input name="basic_salary" type="number" step="0.01" className="input" defaultValue={v("basic_salary")} /></Field>
          <Field label="بدل السكن"><input name="housing_allowance" type="number" step="0.01" className="input" defaultValue={v("housing_allowance")} /></Field>
          <Field label="بدل النقل"><input name="transport_allowance" type="number" step="0.01" className="input" defaultValue={v("transport_allowance")} /></Field>
          <Field label="بدلات أخرى"><input name="other_allowance" type="number" step="0.01" className="input" defaultValue={v("other_allowance")} /></Field>
          <Field label="اسم البنك"><input name="bank_name" className="input" defaultValue={v("bank_name")} /></Field>
          <Field label="رقم الآيبان" className="sm:col-span-2"><input name="iban" className="input" dir="ltr" placeholder="SA..." defaultValue={v("iban")} /></Field>
        </div>
      </Card>

      <Card title="رصيد الإجازات قبل النظام">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="أيام إجازة سنوية استخدمها قبل بدء النظام" hint="مجموع ما أخذه من إجازات سنوية منذ مباشرته حتى اليوم">
            <input name="prior_leave_used" type="number" step="0.5" className="input" defaultValue={v("prior_leave_used") || 0} />
          </Field>
          <Field label="تاريخ العودة من آخر إجازة سنوية" hint="لمعرفة المدة منذ آخر إجازة">
            <input name="last_leave_return_date" type="date" className="input" defaultValue={v("last_leave_return_date")} />
          </Field>
        </div>
      </Card>

      <Card title="المرفقات">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="السيرة الذاتية (PDF)" hint={e?.cv_file_id ? "يوجد ملف مرفوع؛ ارفع ملفاً جديداً للاستبدال" : "ملف PDF حتى 10 ميجابايت"}>
            <input name="cv" type="file" accept="application/pdf" className="input" />
          </Field>
          <Field label="الصورة الشخصية"><input name="photo" type="file" accept="image/*" className="input" /></Field>
        </div>
      </Card>

      <Card title="الملاحظات">
        <textarea name="notes" className="input" defaultValue={v("notes")} />
      </Card>

      {!e && (
        <Card title="حساب الدخول للنظام">
          <label className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" name="create_account" defaultChecked className="size-4 accent-brand-600" />
            إنشاء حساب للموظف (اسم المستخدم = الرقم الوظيفي) ليسجّل الحضور ويرفع طلباته
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="كلمة المرور" hint="إن تُركت فارغة تكون كلمة المرور هي الرقم الوظيفي"><input name="account_password" className="input" dir="ltr" /></Field>
            <Field label="الصلاحية">
              <select name="account_role" className="input" defaultValue="employee">
                <option value="employee">موظف</option><option value="hr">الموارد البشرية</option><option value="gm">المدير الإداري</option><option value="finance">القسم المالي</option>
              </select>
            </Field>
          </div>
        </Card>
      )}

      <div className="flex gap-2">
        <SubmitButton className="btn-primary px-8">{e ? "حفظ التعديلات" : "إضافة الموظف"}</SubmitButton>
        <Link href={e ? `/employees/${e.id}` : "/employees"} className="btn-secondary">إلغاء</Link>
      </div>
    </ActionForm>
  );
}
