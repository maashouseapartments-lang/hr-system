"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavTabs({ tabs }: { tabs: { href: string; label: string; exact?: boolean }[] }) {
  const path = usePathname();
  return (
    <nav className="no-print mb-6 flex gap-1 overflow-x-auto rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-slate-200/70">
      {tabs.map((t) => {
        const active = t.exact ? path === t.href : path === t.href || path.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${
              active ? "bg-brand-600 text-white shadow" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
