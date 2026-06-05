"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, Inbox, MessageCircle, Settings } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function Sidebar() {
  const pathname = usePathname();
  const { t } = useI18n();

  const NAV_ITEMS = [
    { label: t.sidebar.dashboard, href: "/dashboard", icon: LayoutDashboard },
    { label: t.sidebar.pages, href: "/pages", icon: FileText },
    { label: t.sidebar.inbox, href: "/conversations/inbox", icon: Inbox },
    { label: t.sidebar.comments, href: "/conversations/comment", icon: MessageCircle },
    { label: t.sidebar.config, href: "/config", icon: Settings },
  ];

  return (
    <aside className="w-56 shrink-0 border-r border-zinc-200 bg-white flex flex-col py-4">
      <nav className="flex flex-col gap-1 px-3">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-base font-medium transition-colors ${
                active
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
