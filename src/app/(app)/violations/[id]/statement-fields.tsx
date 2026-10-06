"use client";
import { useState } from "react";
import { MessageSquareText, Users, MailWarning } from "lucide-react";

export function StatementFields() {
  const [mode, setMode] = useState<"given" | "refused" | "absent">("given");
  const opt = (k: typeof mode, label: string, icon: React.ReactNode) => (
    <label className={`flex flex-1 cursor-pointer items-center gap-2 rounded-xl border-2 p-3 text-sm font-bold ${mode === k ? "border-brand-500 bg-brand-50" : "border-slate-200"}`}>
      <input type="radio" name="statement_mode" value={k} checked={mode === k} onChange={() => setMode(k)} className="accent-brand-600" />
      {icon} {label}
    </label>
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        {opt("given", "أدلى الموظف بإفادته", <MessageSquareText className="size-4" />)}
        {opt("refused", "رفض الإفادة أو التوقيع", <Users className="size-4" />)}
        {opt("absent", "متغيب ولم يرد", <MailWarning className="size-4" />)}
      </div>
      <label className="block"><span className="label">تاريخ الإفادة / المحضر</span><input type="date" name="statement_date" className="input max-w-xs" /></label>
      {mode === "given" && (
        <>
          <label className="block"><span className="label">نص إفادة الموظف *</span><textarea name="employee_statement" className="input min-h-32" required /></label>
          <label className="block"><span className="label">صورة الإفادة الموقعة (اختياري)</span><input type="file" name="files" multiple accept="application/pdf,image/*" className="input" /></label>
        </>
      )}
      {mode === "refused" && (
        <>
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">يُحرر محضر بامتناع الموظف عن الإفادة أو التوقيع، ويوقّع عليه شاهدان.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className="label">اسم الشاهد الأول *</span><input name="witness1_name" className="input" required /></label>
            <label><span className="label">رقمه الوظيفي / هويته</span><input name="witness1_id" className="input" /></label>
            <label><span className="label">اسم الشاهد الثاني *</span><input name="witness2_name" className="input" required /></label>
            <label><span className="label">رقمه الوظيفي / هويته</span><input name="witness2_id" className="input" /></label>
          </div>
          <label className="block"><span className="label">المحضر الموقع من الشاهدين *</span><input type="file" name="files" multiple accept="application/pdf,image/*" className="input" required /></label>
        </>
      )}
      {mode === "absent" && (
        <>
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">أرفق ما يثبت أنكم راسلتم الموظف (إيميلات، رسائل) ولم يرد.</p>
          <label className="block"><span className="label">تفاصيل المراسلات *</span><textarea name="absence_notes" className="input" required placeholder="مثال: أُرسل إيميل بتاريخ … وإيميل بتاريخ … ولم يرد" /></label>
          <label className="block"><span className="label">إثبات المراسلات *</span><input type="file" name="files" multiple accept="application/pdf,image/*" className="input" required /></label>
        </>
      )}
    </div>
  );
}
