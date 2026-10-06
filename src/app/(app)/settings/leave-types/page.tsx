import { all } from "@/lib/db";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, PageHeader, Alert } from "@/components/ui";
import { saveLeaveType } from "../actions";

type LT = { id: number; code: string; name: string; default_days: number | null; paid: number; full_cycle: number; deducts_balance: number; legal_reference: string | null; active: number };

function Row({ t }: { t?: LT }) {
  return (
    <ActionForm action={saveLeaveType} className="grid items-end gap-3 border-b border-slate-100 py-4 md:grid-cols-[1.3fr_90px_1fr_2fr_auto]">
      {t && <input type="hidden" name="id" value={t.id} />}
      <label><span className="label">النوع</span><input name="name" className="input" required defaultValue={t?.name ?? ""} placeholder="نوع إجازة جديد" /></label>
      <label><span className="label">الأيام</span><input name="default_days" type="number" className="input" defaultValue={t?.default_days ?? ""} /></label>
      <div className="flex flex-col gap-1 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="paid" defaultChecked={t ? !!t.paid : true} className="accent-brand-600" /> مدفوعة الأجر</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="deducts_balance" defaultChecked={!!t?.deducts_balance} className="accent-brand-600" /> تُخصم من الرصيد السنوي</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="full_cycle" defaultChecked={!!t?.full_cycle} className="accent-brand-600" /> دورة كاملة (إخلاء طرف + تسوية + تأشيرة)</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={t ? !!t.active : true} className="accent-brand-600" /> مفعّلة</label>
      </div>
      <label><span className="label">المرجع النظامي</span><input name="legal_reference" className="input" defaultValue={t?.legal_reference ?? ""} /></label>
      <SubmitButton className="btn-secondary">{t ? "حفظ" : "إضافة"}</SubmitButton>
    </ActionForm>
  );
}

export default function LeaveTypesPage() {
  const types = all<LT>("SELECT * FROM leave_types ORDER BY id");
  return (
    <>
      <PageHeader title="أنواع الإجازات" subtitle="مُعدّة مسبقاً وفق نظام العمل السعودي، ويمكنك تعديلها أو إضافة أنواع خاصة بشركتك" />
      <div className="mb-4">
        <Alert tone="sky" title="الإجازة السنوية تُحسب تلقائياً">
          21 يوماً عن كل سنة خدمة، وتصبح 30 يوماً بعد إكمال 5 سنوات متصلة (المادة 109). النظام يحسب الرصيد ويعرض تاريخ آخر إجازة عند مراجعة الطلب.
        </Alert>
      </div>
      <Card>
        {types.map((t) => <Row key={t.id} t={t} />)}
        <Row />
      </Card>
    </>
  );
}
