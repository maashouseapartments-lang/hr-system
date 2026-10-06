"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

type Line = { label: string; kind: "addition" | "deduction"; amount: number };

export function SettlementEditor({ initial }: { initial: Line[] }) {
  const [lines, setLines] = useState<Line[]>(initial.length ? initial : [{ label: "", kind: "addition", amount: 0 }]);
  const set = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const total = lines.reduce((s, l) => s + (l.kind === "addition" ? 1 : -1) * (Number(l.amount) || 0), 0);
  const fmt = (n: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  return (
    <div className="space-y-2">
      {lines.map((l, i) => (
        <div key={i} className="grid grid-cols-[1fr_120px_130px_auto] gap-2">
          <input name="line_label" className="input" value={l.label} onChange={(e) => set(i, { label: e.target.value })} placeholder="البند" />
          <select name="line_kind" className="input" value={l.kind} onChange={(e) => set(i, { kind: e.target.value as Line["kind"] })}>
            <option value="addition">استحقاق +</option>
            <option value="deduction">خصم −</option>
          </select>
          <input name="line_amount" type="number" step="0.01" className="input" value={l.amount} onChange={(e) => set(i, { amount: Number(e.target.value) })} />
          <button type="button" className="btn-ghost btn-sm text-rose-600" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 className="size-4" /></button>
        </div>
      ))}
      <button type="button" className="btn-ghost btn-sm" onClick={() => setLines((ls) => [...ls, { label: "", kind: "deduction", amount: 0 }])}>
        <Plus className="size-4" /> إضافة بند (سلفة، قرض، بدل…)
      </button>
      <div className={`flex items-center justify-between rounded-xl px-4 py-3 text-lg font-extrabold ${total >= 0 ? "bg-brand-50 text-brand-800" : "bg-rose-50 text-rose-700"}`}>
        <span>صافي المستحقات</span>
        <span>{fmt(total)} ر.س</span>
      </div>
    </div>
  );
}
