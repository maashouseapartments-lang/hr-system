"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard, Users, CalendarDays, ShieldAlert, MapPinCheck, Clock4, Star, BriefcaseBusiness,
  Network, Settings, Archive, BarChart3, Menu, X, LogOut, Bell, ClipboardList, Smartphone,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: string; badge?: number };
export type NavGroup = { title: string; items: NavItem[] };

const ICONS: Record<string, ReactNode> = {
  dashboard: <LayoutDashboard className="size-5" />,
  users: <Users className="size-5" />,
  leave: <CalendarDays className="size-5" />,
  violation: <ShieldAlert className="size-5" />,
  checkin: <MapPinCheck className="size-5" />,
  records: <ClipboardList className="size-5" />,
  overtime: <Clock4 className="size-5" />,
  performance: <Star className="size-5" />,
  positions: <BriefcaseBusiness className="size-5" />,
  org: <Network className="size-5" />,
  settings: <Settings className="size-5" />,
  archive: <Archive className="size-5" />,
  reports: <BarChart3 className="size-5" />,
  bell: <Bell className="size-5" />,
  device: <Smartphone className="size-5" />,
};

export function Shell({
  groups,
  user,
  company,
  logoutAction,
  children,
}: {
  groups: NavGroup[];
  user: { name: string; role: string };
  company: { name: string; logo: number | null };
  logoutAction: () => Promise<void>;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const isActive = (href: string) => (href === "/dashboard" ? path === href : path === href || path.startsWith(href + "/"));
  const allHrefs = groups.flatMap((g) => g.items.map((i) => i.href));
  // أطول مسار مطابق هو النشط (لتجنب تفعيل /attendance و /attendance/records معاً)
  const activeHref = allHrefs.filter(isActive).sort((a, b) => b.length - a.length)[0];

  const nav = (
    <nav className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        {company.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/files/${company.logo}`} alt="" className="size-11 rounded-xl bg-white object-contain p-1" />
        ) : (
          <div className="flex size-11 items-center justify-center rounded-xl bg-white/15 text-xl font-extrabold">
            {company.name.slice(0, 1)}
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate font-bold">{company.name}</div>
          <div className="text-xs text-brand-200">الموارد البشرية</div>
        </div>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {groups.map((g) => (
          <div key={g.title}>
            <div className="mb-1.5 px-3 text-[11px] font-bold tracking-wide text-brand-300/90">{g.title}</div>
            <ul className="space-y-0.5">
              {g.items.map((it) => {
                const active = it.href === activeHref;
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] font-semibold transition ${
                        active ? "bg-white text-brand-800 shadow" : "text-brand-50/90 hover:bg-white/10"
                      }`}
                    >
                      {ICONS[it.icon]}
                      <span className="flex-1">{it.label}</span>
                      {!!it.badge && (
                        <span className={`rounded-full px-2 text-xs font-bold ${active ? "bg-brand-600 text-white" : "bg-amber-400 text-amber-950"}`}>
                          {it.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 p-4">
        <div className="mb-3 px-1">
          <div className="truncate font-bold">{user.name}</div>
          <div className="text-xs text-brand-200">{user.role}</div>
        </div>
        <form action={logoutAction}>
          <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-brand-100 hover:bg-white/10">
            <LogOut className="size-4" /> تسجيل الخروج
          </button>
        </form>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:ps-72">
      <aside className="no-print fixed inset-y-0 start-0 z-30 hidden w-72 bg-gradient-to-b from-brand-800 to-brand-900 text-white lg:block">
        {nav}
      </aside>
      {open && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 start-0 w-72 bg-gradient-to-b from-brand-800 to-brand-900 text-white shadow-2xl">
            <button className="absolute end-3 top-5 rounded-lg p-1 text-white/80" onClick={() => setOpen(false)} aria-label="إغلاق">
              <X className="size-6" />
            </button>
            {nav}
          </aside>
        </div>
      )}
      <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <button onClick={() => setOpen(true)} className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-100" aria-label="القائمة">
          <Menu className="size-6" />
        </button>
        <div className="flex-1 truncate font-bold">{company.name}</div>
        <Link href="/attendance" className="btn-primary btn-sm">
          <MapPinCheck className="size-4" /> حضور
        </Link>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
