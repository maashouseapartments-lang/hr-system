import type { ReactNode } from "react";
import { getCompany } from "@/lib/company";
import { fmtDate, fmtHijri } from "@/lib/time";
import { today } from "@/lib/hr";
import { PrintButton } from "./forms";

/** ورقة رسمية قابلة للطباعة (A4) بترويسة الشركة */
export function PrintSheet({ title, refNo, date, children, back }: { title: string; refNo?: string; date?: string; children: ReactNode; back?: ReactNode }) {
  const c = getCompany();
  const d = date ?? today();
  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>{back}</div>
        <PrintButton label="طباعة / حفظ PDF" />
      </div>
      <article className="print-sheet card mx-auto max-w-[210mm] bg-white p-10 text-[13.5px] leading-7">
        <header className="mb-6 flex items-start justify-between gap-6 border-b-2 border-brand-700 pb-4">
          <div>
            <div className="text-xl font-extrabold text-brand-800">{c?.name_ar}</div>
            {c?.name_en && <div className="text-sm text-slate-500" dir="ltr">{c.name_en}</div>}
            <div className="mt-1 text-xs text-slate-500">
              {c?.cr_number && <>س.ت: {c.cr_number} </>}
              {c?.city && <> • {c.city}</>}
              {c?.phone && <> • {c.phone}</>}
            </div>
          </div>
          {c?.logo_file_id && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/files/${c.logo_file_id}`} alt="" className="h-16 object-contain" />
          )}
        </header>
        <div className="mb-6 flex items-end justify-between">
          <h1 className="text-xl font-extrabold">{title}</h1>
          <div className="text-end text-xs text-slate-600">
            {refNo && <div>الرقم: <b className="font-mono">{refNo}</b></div>}
            <div>التاريخ: {fmtDate(d)}</div>
            <div>الموافق: {fmtHijri(d)}</div>
          </div>
        </div>
        {children}
      </article>
    </div>
  );
}

export function Signatures({ items }: { items: { role: string; name?: string | null; date?: string | null; signed?: boolean }[] }) {
  return (
    <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-3" style={{ breakInside: "avoid" }}>
      {items.map((s, i) => (
        <div key={i} className="rounded-lg border border-slate-300 p-3 text-center">
          <div className="text-xs font-bold text-slate-600">{s.role}</div>
          <div className="mt-1 min-h-6 font-bold">{s.name ?? ""}</div>
          <div className="mt-6 border-t border-dashed border-slate-400 pt-1 text-[11px] text-slate-500">
            {s.signed ? `✔ اعتماد إلكتروني ${s.date ? `— ${s.date}` : ""}` : "التوقيع"}
          </div>
        </div>
      ))}
    </div>
  );
}
