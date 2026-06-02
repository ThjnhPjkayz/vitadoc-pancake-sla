import Link from "next/link";
import { BarChart3, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-gradient-to-br from-zinc-50 to-blue-50 font-sans">
      <main className="flex flex-col items-center gap-8 py-32 px-6 text-center max-w-lg">
        <div className="p-4 rounded-2xl bg-blue-100">
          <BarChart3 className="w-10 h-10 text-blue-600" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900">
          Pancake SLA Monitor
        </h1>
        <p className="text-lg text-zinc-500 leading-relaxed">
          Monitor message response times across all your Pancake pages.
          Track SLA violations in real-time.
        </p>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors shadow-md shadow-blue-200"
        >
          Open Dashboard
          <ArrowRight className="w-4 h-4" />
        </Link>
      </main>
    </div>
  );
}
