import { redirect } from "next/navigation";
import { Shell, type NavGroup } from "@/components/sidebar";
import { requireUser, isHR, isStaff, isManager, ROLE_LABELS, isGM } from "@/lib/auth";
import { get } from "@/lib/db";
import { myTasks } from "@/lib/tasks";
import { logout } from "../login/actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const company = get<{ name_ar: string; logo_file_id: number | null }>("SELECT name_ar, logo_file_id FROM company WHERE id = 1");
  if (!company) redirect("/setup");
  const u = await requireUser();
  const tasks = myTasks(u);
  const staff = isStaff(u);
  const manager = isManager(u);
  const hr = isHR(u);
  const alerts = hr ? tasks.filter((t) => t.kind === "device").length : 0;

  const groups: NavGroup[] = [
    {
      title: "الرئيسية",
      items: [
        { href: "/dashboard", label: "لوحة التحكم", icon: "dashboard", badge: tasks.length },
        { href: "/attendance", label: "تسجيل الحضور", icon: "checkin" },
        { href: "/me", label: "ملفي الوظيفي", icon: "users" },
      ],
    },
    {
      title: "المعاملات",
      items: [
        { href: "/leaves", label: "الإجازات", icon: "leave", badge: tasks.filter((t) => t.kind === "leave").length },
        ...(staff || manager
          ? [{ href: "/overtime", label: "العمل الإضافي", icon: "overtime", badge: tasks.filter((t) => t.kind === "overtime").length }]
          : []),
        ...(hr || isGM(u)
          ? [{ href: "/violations", label: "المخالفات والجزاءات", icon: "violation", badge: tasks.filter((t) => t.kind === "violation").length }]
          : []),
        { href: "/performance", label: "تقييم الأداء", icon: "performance", badge: tasks.filter((t) => t.kind === "performance").length },
      ],
    },
    ...(staff || manager
      ? [
          {
            title: "الموظفون والحضور",
            items: [
              { href: "/employees", label: "الموظفون", icon: "users" },
              { href: "/attendance/records", label: "سجلات الحضور", icon: "records" },
              ...(hr ? [{ href: "/attendance/alerts", label: "تنبيهات الأجهزة", icon: "device", badge: alerts }] : []),
            ],
          },
        ]
      : []),
    {
      title: "المنشأة",
      items: [
        { href: "/org-chart", label: "الهيكل التنظيمي", icon: "org" },
        { href: "/positions", label: "الأوصاف الوظيفية", icon: "positions" },
        ...(staff ? [{ href: "/reports", label: "التقارير والمسير", icon: "reports" }] : []),
        ...(staff ? [{ href: "/archive", label: "الأرشيف", icon: "archive" }] : []),
        ...(hr ? [{ href: "/settings", label: "تهيئة النظام", icon: "settings" }] : []),
      ],
    },
  ];

  return (
    <Shell
      groups={groups}
      user={{ name: u.display_name, role: ROLE_LABELS[u.role] }}
      company={{ name: company.name_ar, logo: company.logo_file_id }}
      logoutAction={logout}
    >
      {children}
    </Shell>
  );
}
