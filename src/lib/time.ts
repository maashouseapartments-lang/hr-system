/** أدوات التاريخ والوقت — كل الحسابات بتوقيت الشركة (الافتراضي الرياض) */

export const DAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export function nowInTz(tz = "Asia/Riyadh", at: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(at);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  const date = `${p.year}-${p.month}-${p.day}`;
  const minutes = Number(p.hour) * 60 + Number(p.minute);
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { date, minutes, weekday };
}

export const toMinutes = (hhmm?: string | null) => {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

export const fromMinutes = (mins: number | null | undefined) => {
  if (mins == null) return "—";
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/** عرض الوقت بصيغة 12 ساعة بالعربية */
export const time12 = (hhmm?: string | null | number) => {
  const mins = typeof hhmm === "number" ? hhmm : toMinutes(hhmm ?? null);
  if (mins == null) return "—";
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const suffix = h < 12 ? "ص" : "م";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
};

export const durationLabel = (mins: number) => {
  if (!mins) return "0 د";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return [h ? `${h} س` : "", m ? `${m} د` : ""].filter(Boolean).join(" ");
};

export function parseDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function fmtISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: string, n: number) {
  const x = parseDate(d);
  x.setUTCDate(x.getUTCDate() + n);
  return fmtISO(x);
}

export function daysBetween(a: string, b: string) {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);
}

/** فرق السنوات الكاملة والكسرية بين تاريخين */
export function yearsBetween(a: string, b: string) {
  return daysBetween(a, b) / 365;
}

export function fmtDate(d?: string | null) {
  if (!d) return "—";
  const x = parseDate(d.slice(0, 10));
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(x);
}

export function fmtHijri(d?: string | null) {
  if (!d) return "—";
  const x = parseDate(d.slice(0, 10));
  return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(x);
}

export function fmtDateTime(iso?: string | null, tz = "Asia/Riyadh") {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") || iso.endsWith("Z") ? iso : iso.replace(" ", "T") + "Z");
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
    timeZone: tz,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export const money = (n?: number | null) =>
  `${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n ?? 0)} ر.س`;

export const num = (n?: number | null, digits = 0) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(n ?? 0);
