import "server-only";
import { get, run } from "./db";
import { str, req, numOr, UserError } from "./action";
import { saveUpload } from "./files";
import { toMinutes } from "./time";

export type Company = {
  name_ar: string;
  name_en: string | null;
  cr_number: string | null;
  vat_number: string | null;
  unified_number: string | null;
  mol_number: string | null;
  gosi_number: string | null;
  activity: string | null;
  city: string | null;
  address: string | null;
  postal_code: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_file_id: number | null;
  timezone: string;
};

export const getCompany = () => get<Company>("SELECT * FROM company WHERE id = 1");

const COMPANY_FIELDS = [
  "name_en", "cr_number", "vat_number", "unified_number", "mol_number", "gosi_number",
  "activity", "city", "address", "postal_code", "phone", "email", "website",
] as const;

export async function saveCompany(fd: FormData, userId?: number) {
  const name = req(fd, "name_ar", "اسم الشركة");
  const values = COMPANY_FIELDS.map((k) => str(fd, k));
  const tz = str(fd, "timezone") ?? "Asia/Riyadh";
  if (get("SELECT 1 FROM company WHERE id = 1")) {
    run(
      `UPDATE company SET name_ar = ?, ${COMPANY_FIELDS.map((k) => `${k} = ?`).join(", ")}, timezone = ? WHERE id = 1`,
      name,
      ...values,
      tz,
    );
  } else {
    run(
      `INSERT INTO company(id, name_ar, ${COMPANY_FIELDS.join(", ")}, timezone) VALUES (1, ?, ${COMPANY_FIELDS.map(() => "?").join(", ")}, ?)`,
      name,
      ...values,
      tz,
    );
  }
  const logo = await saveUpload(fd.get("logo"), { entity_type: "company", entity_id: 1, category: "logo", uploaded_by: userId });
  if (logo) run("UPDATE company SET logo_file_id = ? WHERE id = 1", logo);
}

export function scheduleFromForm(fd: FormData) {
  const start = req(fd, "start_time", "بداية الدوام");
  const end = req(fd, "end_time", "نهاية الدوام");
  const bs = str(fd, "break_start");
  const be = str(fd, "break_end");
  if (bs && be && toMinutes(be)! <= toMinutes(bs)!) throw new UserError("نهاية الاستراحة يجب أن تكون بعد بدايتها");
  const days = fd.getAll("work_days").map(String);
  if (!days.length) throw new UserError("اختر يوم عمل واحداً على الأقل");
  return {
    name: req(fd, "name", "اسم الدوام"),
    start_time: start,
    end_time: end,
    break_start: bs,
    break_end: bs ? be : null,
    grace_minutes: numOr(fd, "grace_minutes", 0),
    work_days: days.join(","),
    effective_from: str(fd, "effective_from"),
    effective_to: str(fd, "effective_to"),
    notes: str(fd, "notes"),
  };
}

export function insertSchedule(s: ReturnType<typeof scheduleFromForm>, isDefault: boolean) {
  if (isDefault) run("UPDATE schedules SET is_default = 0");
  return run(
    `INSERT INTO schedules(name, start_time, end_time, break_start, break_end, grace_minutes, work_days, effective_from, effective_to, is_default, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    s.name, s.start_time, s.end_time, s.break_start, s.break_end, s.grace_minutes, s.work_days,
    s.effective_from, s.effective_to, isDefault ? 1 : 0, s.notes,
  ).id;
}
