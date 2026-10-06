import Link from "next/link";
import type { ReactNode } from "react";
import { Check, Clock, X, Inbox, Paperclip, FileText } from "lucide-react";
import type { Tone } from "@/lib/labels";
import { fmtDateTime } from "@/lib/time";

const TONES: Record<Tone, string> = {
  slate: "bg-slate-100 text-slate-700",
  brand: "bg-brand-100 text-brand-800",
  amber: "bg-amber-100 text-amber-800",
  rose: "bg-rose-100 text-rose-700",
  sky: "bg-sky-100 text-sky-800",
  violet: "bg-violet-100 text-violet-800",
};

export function Badge({ tone = "slate", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge ${TONES[tone]}`}>{children}</span>;
}

export function StatusBadge({ map, value }: { map: Record<string, { label: string; tone: Tone }>; value: string }) {
  const s = map[value] ?? { label: value, tone: "slate" as Tone };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {back && (
          <Link href={back.href} className="mb-1 inline-block text-sm font-semibold text-brand-700 hover:underline">
            → {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className = "", pad = true }: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <h2 className="card-title">{title}</h2>
          {actions}
        </div>
      )}
      <div className={pad ? "card-pad" : ""}>{children}</div>
    </section>
  );
}

export function Field({ label, hint, children, className = "" }: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="hint block">{hint}</span>}
    </label>
  );
}

export function Stat({ label, value, icon, tone = "brand", href, sub }: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  tone?: Tone;
  href?: string;
  sub?: ReactNode;
}) {
  const body = (
    <div className="card flex items-center gap-4 p-5 transition hover:shadow-md">
      <div className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${TONES[tone]}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-sm text-slate-500">{label}</div>
        <div className="text-2xl font-extrabold text-slate-900">{value}</div>
        {sub && <div className="text-xs text-slate-500">{sub}</div>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <Inbox className="size-10 text-slate-300" />
      <div className="font-bold text-slate-600">{title}</div>
      {children && <div className="text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function Alert({ tone = "sky", title, children }: { tone?: Tone; title?: string; children: ReactNode }) {
  const border: Record<Tone, string> = {
    slate: "border-slate-200 bg-slate-50",
    brand: "border-brand-200 bg-brand-50",
    amber: "border-amber-200 bg-amber-50",
    rose: "border-rose-200 bg-rose-50",
    sky: "border-sky-200 bg-sky-50",
    violet: "border-violet-200 bg-violet-50",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm leading-7 ${border[tone]}`}>
      {title && <div className="font-bold">{title}</div>}
      <div>{children}</div>
    </div>
  );
}

export function Tabs({ tabs, active }: { tabs: { key: string; label: string; href: string; count?: number }[]; active: string }) {
  return (
    <nav className="no-print -mx-1 mb-5 flex gap-1 overflow-x-auto rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-slate-200/70">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${
            t.key === active ? "bg-brand-600 text-white shadow" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {t.label}
          {t.count != null && t.count > 0 && (
            <span className={`rounded-full px-1.5 text-xs ${t.key === active ? "bg-white/25" : "bg-slate-200"}`}>{t.count}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}

/** مؤشر مراحل سير العمل */
export function Stepper({ steps, current, done }: {
  steps: { key: string; short?: string; label: string }[];
  current: string;
  done?: boolean;
}) {
  const idx = done ? steps.length : steps.findIndex((s) => s.key === current);
  return (
    <ol className="flex gap-0 overflow-x-auto pb-2">
      {steps.map((s, i) => {
        const state = i < idx ? "done" : i === idx ? "current" : "todo";
        return (
          <li key={s.key} className="flex min-w-[92px] flex-1 flex-col items-center text-center">
            <div className="flex w-full items-center">
              <div className={`h-0.5 flex-1 ${i === 0 ? "opacity-0" : i <= idx ? "bg-brand-500" : "bg-slate-200"}`} />
              <div
                className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-4 ring-white ${
                  state === "done"
                    ? "bg-brand-600 text-white"
                    : state === "current"
                      ? "bg-amber-400 text-amber-950 animate-pulse"
                      : "bg-slate-200 text-slate-500"
                }`}
              >
                {state === "done" ? <Check className="size-4" /> : i + 1}
              </div>
              <div className={`h-0.5 flex-1 ${i === steps.length - 1 ? "opacity-0" : i < idx ? "bg-brand-500" : "bg-slate-200"}`} />
            </div>
            <div className={`mt-2 px-1 text-[11.5px] leading-5 ${state === "current" ? "font-bold text-slate-900" : "text-slate-500"}`}>
              {s.short ?? s.label}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function Timeline({ events, stageLabel }: {
  events: { id: number; stage: string; action: string; note: string | null; user_name: string | null; created_at: string }[];
  stageLabel?: (s: string) => string;
}) {
  if (!events.length) return <Empty title="لا توجد حركات بعد" />;
  return (
    <ol className="relative space-y-5 border-s-2 border-slate-100 ps-5">
      {events.map((e) => {
        const neg = /رفض|إلغاء|رفضت/.test(e.action);
        return (
          <li key={e.id} className="relative">
            <span
              className={`absolute -start-[29px] top-0.5 flex size-5 items-center justify-center rounded-full ring-4 ring-white ${
                neg ? "bg-rose-500" : "bg-brand-500"
              }`}
            >
              {neg ? <X className="size-3 text-white" /> : <Check className="size-3 text-white" />}
            </span>
            <div className="font-bold text-slate-800">{e.action}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
              <span>{stageLabel ? stageLabel(e.stage) : e.stage}</span>
              <span>•</span>
              <span>{e.user_name}</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" /> {fmtDateTime(e.created_at)}
              </span>
            </div>
            {e.note && <div className="mt-1.5 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{e.note}</div>}
          </li>
        );
      })}
    </ol>
  );
}

export type FileRow = { id: number; original_name: string; mime: string; category: string | null; title: string | null; created_at: string; size: number };

const CATEGORY_LABELS: Record<string, string> = {
  cv: "السيرة الذاتية",
  photo: "صورة شخصية",
  evidence: "دليل",
  signed_copy: "نسخة موقعة",
  receipt: "إيصال تحويل",
  visa: "التأشيرة",
  selfie: "صورة الحضور",
  witness: "توقيع الشهود",
  email_proof: "إثبات المراسلات",
  request_form: "نموذج الطلب",
  document: "مستند",
  statement: "إفادة",
  contract: "عقد العمل",
  id_copy: "صورة الهوية",
  certificate: "شهادة",
};

export const categoryLabel = (c?: string | null) => (c ? CATEGORY_LABELS[c] ?? c : "مستند");

export function FileList({ files }: { files: FileRow[] }) {
  if (!files.length) return <p className="text-sm text-slate-500">لا توجد مرفقات.</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {files.map((f) => (
        <li key={f.id} className="flex items-center gap-3 py-2.5">
          {f.mime === "application/pdf" ? (
            <FileText className="size-5 shrink-0 text-rose-500" />
          ) : (
            <Paperclip className="size-5 shrink-0 text-sky-500" />
          )}
          <div className="min-w-0 flex-1">
            <a href={`/api/files/${f.id}`} target="_blank" className="block truncate font-semibold text-slate-800 hover:text-brand-700">
              {f.title || f.original_name}
            </a>
            <div className="text-xs text-slate-500">
              {categoryLabel(f.category)} • {(f.size / 1024).toFixed(0)} ك.ب • {fmtDateTime(f.created_at)}
            </div>
          </div>
          <a href={`/api/files/${f.id}?download=1`} className="btn-ghost btn-sm">
            تنزيل
          </a>
        </li>
      ))}
    </ul>
  );
}

export function Avatar({ name, fileId, size = 40 }: { name: string; fileId?: number | null; size?: number }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join(" ");
  if (fileId)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/api/files/${fileId}`} alt={name} width={size} height={size} className="shrink-0 rounded-full object-cover ring-2 ring-white" style={{ width: size, height: size }} />;
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 font-bold text-white ring-2 ring-white"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
}
