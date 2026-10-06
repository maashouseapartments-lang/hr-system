import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { UPLOAD_DIR, run } from "./db";

const ALLOWED: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const MAX_BYTES = 10 * 1024 * 1024;

export type FileMeta = {
  entity_type: string;
  entity_id: number;
  category: string;
  title?: string;
  uploaded_by?: number;
};

function store(buf: Buffer, mime: string, originalName: string, meta: FileMeta) {
  const ext = ALLOWED[mime];
  if (!ext) throw new Error("نوع الملف غير مسموح. المسموح: PDF أو صورة (JPG/PNG)");
  if (buf.length > MAX_BYTES) throw new Error("حجم الملف أكبر من 10 ميجابايت");
  const stored = `${crypto.randomBytes(16).toString("hex")}${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, stored), buf);
  return run(
    `INSERT INTO files(stored_name, original_name, mime, size, entity_type, entity_id, category, title, uploaded_by)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    stored,
    originalName || `file${ext}`,
    mime,
    buf.length,
    meta.entity_type,
    meta.entity_id,
    meta.category,
    meta.title ?? null,
    meta.uploaded_by ?? null,
  ).id;
}

/** يحفظ ملفاً مرفوعاً من نموذج، ويعيد null إن لم يُرفع ملف */
export async function saveUpload(file: FormDataEntryValue | null, meta: FileMeta): Promise<number | null> {
  if (!file || typeof file === "string" || file.size === 0) return null;
  const buf = Buffer.from(await file.arrayBuffer());
  return store(buf, file.type, file.name, meta);
}

export async function saveUploads(files: FormDataEntryValue[], meta: FileMeta) {
  const ids: number[] = [];
  for (const f of files) {
    const id = await saveUpload(f, meta);
    if (id) ids.push(id);
  }
  return ids;
}

/** صورة السيلفي القادمة من الكاميرا بصيغة data URL */
export function saveDataUrl(dataUrl: string, meta: FileMeta) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error("صورة غير صالحة");
  return store(Buffer.from(m[2], "base64"), m[1], `${meta.category}.jpg`, meta);
}

export function filePath(stored: string) {
  return path.join(UPLOAD_DIR, path.basename(stored));
}
