import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA } from "./schema";
import { seedReferenceData } from "./seed";

export const DATA_DIR = process.env.HR_DATA_DIR || path.join(process.cwd(), "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

type Row = Record<string, unknown>;

function open(): DatabaseSync {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const db = new DatabaseSync(path.join(DATA_DIR, "hr.db"));
  db.exec("PRAGMA busy_timeout = 10000;");
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  seedReferenceData(db);
  return db;
}

const g = globalThis as unknown as { __hrdb?: DatabaseSync };
export const db: DatabaseSync = g.__hrdb ?? (g.__hrdb = open());

type Param = string | number | bigint | null | Uint8Array;
const clean = (params: unknown[]): Param[] =>
  params.map((p) => (p === undefined ? null : typeof p === "boolean" ? (p ? 1 : 0) : (p as Param)));

/** يعيد كل الصفوف كائنات عادية (قابلة للتمرير إلى مكونات العميل) */
export function all<T = Row>(sql: string, ...params: unknown[]): T[] {
  return db.prepare(sql).all(...clean(params)).map((r) => ({ ...r })) as T[];
}

export function get<T = Row>(sql: string, ...params: unknown[]): T | undefined {
  const r = db.prepare(sql).get(...clean(params));
  return r ? ({ ...r } as T) : undefined;
}

export function run(sql: string, ...params: unknown[]) {
  const r = db.prepare(sql).run(...clean(params));
  return { changes: Number(r.changes), id: Number(r.lastInsertRowid) };
}

export function tx<T>(fn: () => T): T {
  db.exec("BEGIN");
  try {
    const r = fn();
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function getSetting(key: string, fallback = ""): string {
  const r = get<{ value: string }>("SELECT value FROM settings WHERE key = ?", key);
  return r?.value ?? fallback;
}

export function setSetting(key: string, value: string) {
  run(
    "INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    key,
    value,
  );
}
