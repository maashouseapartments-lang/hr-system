import Link from "next/link";
import { FileText, Image as ImageIcon } from "lucide-react";
import { all } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fmtDateTime } from "@/lib/time";
import { Card, Empty, PageHeader, categoryLabel, Tabs } from "@/components/ui";

const ENTITY: Record<string, { label: string; href: (id: number) => string; table?: string }> = {
  employee: { label: "ملفات الموظفين", href: (id) => `/employees/${id}?tab=documents` },
  leave: { label: "الإجازات", href: (id) => `/leaves/${id}` },
  violation: { label: "المخالفات", href: (id) => `/violations/${id}` },
  overtime: { label: "العمل الإضافي", href: (id) => `/overtime/${id}` },
};

export default async function ArchivePage({ searchParams }: { searchParams: Promise<{ type?: string; q?: string }> }) {
  await requireRole("hr", "gm", "finance");
  const sp = await searchParams;
  const type = sp.type && ENTITY[sp.type] ? sp.type : "leave";
  const params: unknown[] = [type];
  let extra = "";
  if (sp.q) { extra = "AND (f.original_name LIKE ? OR f.title LIKE ? OR ref LIKE ? OR emp LIKE ?)"; params.push(...Array(4).fill(`%${sp.q}%`)); }
  const rows = all<{ id: number; entity_id: number; original_name: string; title: string | null; mime: string; category: string | null; created_at: string; size: number; ref: string | null; emp: string | null }>(
    `SELECT * FROM (
       SELECT f.*, COALESCE(lr.ref_no, v.ref_no, o.ref_no) AS ref,
              COALESCE(e1.full_name, e2.full_name, e3.full_name) AS emp
         FROM files f
         LEFT JOIN leave_requests lr ON f.entity_type = 'leave' AND lr.id = f.entity_id
         LEFT JOIN violations v ON f.entity_type = 'violation' AND v.id = f.entity_id
         LEFT JOIN overtime_requests o ON f.entity_type = 'overtime' AND o.id = f.entity_id
         LEFT JOIN employees e1 ON f.entity_type = 'employee' AND e1.id = f.entity_id
         LEFT JOIN employees e2 ON e2.id = lr.employee_id
         LEFT JOIN employees e3 ON e3.id = v.employee_id
     ) f WHERE f.entity_type = ? ${extra} ORDER BY f.id DESC LIMIT 500`,
    ...params,
  );
  return (
    <>
      <PageHeader title="الأرشيف الإلكتروني" subtitle="كل المستندات والنسخ الموقعة المرفوعة على المعاملات" />
      <Tabs active={type} tabs={Object.entries(ENTITY).map(([k, v]) => ({ key: k, label: v.label, href: `?type=${k}` }))} />
      <Card pad={false}>
        <form className="border-b border-slate-100 p-4"><input type="hidden" name="type" value={type} /><input name="q" defaultValue={sp.q} className="input max-w-sm" placeholder="بحث باسم الموظف أو رقم المعاملة أو الملف" /></form>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>المستند</th><th>النوع</th><th>الموظف</th><th>المعاملة</th><th>التاريخ</th><th /></tr></thead>
              <tbody>{rows.map((f) => (
                <tr key={f.id}>
                  <td><a href={`/api/files/${f.id}`} target="_blank" className="flex items-center gap-2 font-semibold hover:text-brand-700">{f.mime === "application/pdf" ? <FileText className="size-4 text-rose-500" /> : <ImageIcon className="size-4 text-sky-500" />}{f.title || f.original_name}</a></td>
                  <td>{categoryLabel(f.category)}</td>
                  <td>{f.emp ?? "—"}</td>
                  <td><Link href={ENTITY[type].href(f.entity_id)} className="font-mono text-xs text-brand-700 hover:underline">{f.ref ?? "فتح"}</Link></td>
                  <td className="whitespace-nowrap text-xs">{fmtDateTime(f.created_at)}</td>
                  <td><a href={`/api/files/${f.id}?download=1`} className="btn-ghost btn-sm">تنزيل</a></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <Empty title="لا توجد مستندات" />}
      </Card>
    </>
  );
}
