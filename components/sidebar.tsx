"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutDashboard, FileText, Inbox, MessageCircle, Settings } from "lucide-react";
import { useI18n } from "@/lib/i18n";

function SidebarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useI18n();

  // Build period query string to preserve across navigation
  function periodQuery(): string {
    const period = searchParams.get("period");
    if (!period || period === "yesterday") return "";
    const params = new URLSearchParams();
    params.set("period", period);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return `?${params.toString()}`;
  }

  const query = periodQuery();

  const NAV_ITEMS = [
    { label: t.sidebar.dashboard, href: "/dashboard", icon: LayoutDashboard },
    { label: t.sidebar.pages, href: "/pages", icon: FileText },
    { label: t.sidebar.inbox, href: "/conversations/inbox", icon: Inbox },
    { label: t.sidebar.comments, href: "/conversations/comment", icon: MessageCircle },
    { label: t.sidebar.config, href: "/config", icon: Settings },
  ];

  return (
    <aside className="w-56 shrink-0 border-r border-zinc-200 bg-white flex flex-col py-3">
      <nav className="flex flex-col gap-0.5 px-3">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={`${href}${query}`}
              className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-primary/8 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />
              )}
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export default function Sidebar() {
  return (
    <Suspense
      fallback={
        <aside className="w-56 shrink-0 border-r border-zinc-200 bg-white flex flex-col py-3">
          <nav className="flex flex-col gap-0.5 px-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-9 rounded-lg bg-zinc-100 animate-pulse" />
            ))}
          </nav>
        </aside>
      }
    >
      <SidebarContent />
    </Suspense>
  );
}
