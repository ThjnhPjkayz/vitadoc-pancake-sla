import { LayoutDashboard, BarChart3 } from "lucide-react";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Top Nav */}
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-6 h-14 max-w-[1600px] mx-auto">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-zinc-900">
              Pancake SLA Monitor
            </span>
          </div>

          <nav className="flex items-center gap-1">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-blue-600 bg-blue-50 transition-colors"
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Link>
            <Link
              href="/api/sla"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
            >
              API
            </Link>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-[1600px] mx-auto p-6">{children}</main>
    </div>
  );
}
