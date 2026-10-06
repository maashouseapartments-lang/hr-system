import { NavTabs } from "@/components/nav-tabs";
import { requireRole } from "@/lib/auth";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const u = await requireRole("hr");
  return (
    <>
      <NavTabs
        tabs={[
          { href: "/settings", label: "خطوات التهيئة", exact: true },
          { href: "/settings/company", label: "بيانات الشركة" },
          { href: "/settings/schedules", label: "مواعيد العمل" },
          { href: "/settings/departments", label: "الأقسام والهيكل" },
          { href: "/settings/locations", label: "مواقع الحضور" },
          { href: "/settings/leave-types", label: "أنواع الإجازات" },
          { href: "/settings/violation-types", label: "لائحة المخالفات" },
          { href: "/settings/general", label: "إعدادات الاحتساب" },
          ...(u.role === "admin" ? [{ href: "/settings/users", label: "المستخدمون والصلاحيات" }] : []),
        ]}
      />
      {children}
    </>
  );
}
