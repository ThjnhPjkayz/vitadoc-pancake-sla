"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Inboxs", href: "/conversations/inbox", sla: "SLA 15 / 30 min" },
  { label: "Comments", href: "/conversations/comment", sla: "SLA 60 / 120 min" },
];

export default function ConversationsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const activeTab = TABS.find((t) => pathname === t.href || pathname.startsWith(t.href + "/"));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">{activeTab?.label ?? "Conversations"}</h1>
        <p className="text-sm text-muted-foreground">
          {activeTab?.sla ?? "SLA tracking by conversation type"}
        </p>
      </div>

      {/* Tab nav */}
      <div className="border-b border-zinc-200 flex gap-0">
        {TABS.map(({ label, href, sla }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                active
                  ? "border-zinc-900 text-zinc-900"
                  : "border-transparent text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {label}
              <span className={`text-xs px-1.5 py-0.5 rounded font-normal ${
                active ? "bg-zinc-100 text-zinc-600" : "bg-zinc-100 text-zinc-400"
              }`}>
                {sla}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Content */}
      {children}
    </div>
  );
}
