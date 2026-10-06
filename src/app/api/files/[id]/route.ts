import fs from "node:fs";
import { NextResponse, type NextRequest } from "next/server";
import { get } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { filePath } from "@/lib/files";

type FileRow = { stored_name: string; original_name: string; mime: string; entity_type: string; entity_id: number; category: string };

/** هل الملف يخص الموظف نفسه (للمستخدمين بصلاحية موظف) */
function ownsFile(employeeId: number, f: FileRow) {
  switch (f.entity_type) {
    case "employee":
      return f.entity_id === employeeId;
    case "leave":
      return !!get("SELECT 1 FROM leave_requests WHERE id = ? AND employee_id = ?", f.entity_id, employeeId);
    case "violation":
      return !!get("SELECT 1 FROM violations WHERE id = ? AND employee_id = ?", f.entity_id, employeeId);
    case "attendance":
      return !!get("SELECT 1 FROM attendance WHERE id = ? AND employee_id = ?", f.entity_id, employeeId);
    case "company":
      return true;
    default:
      return false;
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const f = get<FileRow>("SELECT * FROM files WHERE id = ?", Number(id));
  if (!f) return new NextResponse("غير موجود", { status: 404 });
  const isLogo = f.entity_type === "company" && f.category === "logo";
  if (!isLogo) {
    const u = await getUser();
    if (!u) return new NextResponse("غير مصرح", { status: 401 });
    // المدراء ومن فوقهم يرون ملفات المعاملات؛ الموظف يرى ملفاته فقط
    const isManagerish = u.role !== "employee" || u.headed_departments.length > 0 ||
      !!get("SELECT 1 FROM employees WHERE manager_id = ? LIMIT 1", u.employee_id ?? -1);
    if (!isManagerish && !(u.employee_id && ownsFile(u.employee_id, f))) {
      return new NextResponse("غير مصرح", { status: 403 });
    }
  }
  const p = filePath(f.stored_name);
  if (!fs.existsSync(p)) return new NextResponse("الملف مفقود", { status: 404 });
  const download = req.nextUrl.searchParams.get("download") === "1";
  return new NextResponse(fs.readFileSync(p), {
    headers: {
      "Content-Type": f.mime,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(f.original_name)}`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
