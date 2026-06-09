"use client";

import { useCallback, useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Calendar } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { GlobalPeriodKey } from "@/hooks/use-global-period";

export default function PeriodSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useI18n();

  const currentPeriod = (searchParams.get("period") ?? "yesterday") as GlobalPeriodKey;
  const [showCustom, setShowCustom] = useState(currentPeriod === "custom");
  const [customFrom, setCustomFrom] = useState(searchParams.get("from") ?? "");
  const [customTo, setCustomTo] = useState(searchParams.get("to") ?? "");
  const [customError, setCustomError] = useState("");

  // Sync custom visibility when URL changes (e.g., navigating between modules)
  useEffect(() => {
    setShowCustom(currentPeriod === "custom");
  }, [currentPeriod]);

  const navigate = useCallback(
    (period: GlobalPeriodKey, from?: string, to?: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("period", period);
      if (period === "custom" && from && to) {
        params.set("from", from);
        params.set("to", to);
      } else {
        params.delete("from");
        params.delete("to");
      }
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const handlePreset = (p: "yesterday" | "7d" | "30d") => {
    setShowCustom(false);
    setCustomError("");
    navigate(p);
  };

  const handleCustomToggle = () => {
    const next = !showCustom;
    setShowCustom(next);
    if (next && currentPeriod !== "custom") {
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      setCustomFrom(prev => prev || yesterday);
      setCustomTo(prev => prev || yesterday);
    }
  };

  const handleApply = () => {
    if (!customFrom || !customTo) {
      setCustomError("Vui lòng chọn cả 2 ngày");
      return;
    }
    const diff = (new Date(customTo).getTime() - new Date(customFrom).getTime()) / 86_400_000;
    if (diff < 0) {
      setCustomError("Ngày kết thúc phải sau ngày bắt đầu");
      return;
    }
    if (diff > 30) {
      setCustomError("Tối đa 30 ngày");
      return;
    }
    setCustomError("");
    navigate("custom", customFrom, customTo);
  };

  const presets: { value: "yesterday" | "7d" | "30d"; label: string }[] = [
    { value: "yesterday", label: t.dashboard.periodYesterday },
    { value: "7d",        label: t.dashboard.period7d },
    { value: "30d",       label: t.dashboard.period30d },
  ];

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-0.5">
        {presets.map((p) => (
          <button
            key={p.value}
            onClick={() => handlePreset(p.value)}
            className={`px-3 py-1 text-xs rounded-md transition-colors font-medium ${
              currentPeriod === p.value
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-muted-foreground hover:text-zinc-700"
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={handleCustomToggle}
          className={`px-3 py-1 text-xs rounded-md transition-colors font-medium flex items-center gap-1 ${
            currentPeriod === "custom" || showCustom
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-muted-foreground hover:text-zinc-700"
          }`}
        >
          <Calendar className="w-3 h-3" />
          {t.dashboard.periodCustom}
        </button>
      </div>

      {showCustom && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-white shadow-sm">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => { setCustomFrom(e.target.value); setCustomError(""); }}
            className="text-xs border rounded px-2 py-1 [color-scheme:light] outline-none focus:ring-1 focus:ring-primary/30"
          />
          <span className="text-xs text-muted-foreground">→</span>
          <input
            type="date"
            value={customTo}
            min={customFrom || undefined}
            onChange={(e) => { setCustomTo(e.target.value); setCustomError(""); }}
            className="text-xs border rounded px-2 py-1 [color-scheme:light] outline-none focus:ring-1 focus:ring-primary/30"
          />
          <button
            onClick={handleApply}
            className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded font-medium hover:bg-primary/90 transition-colors"
          >
            {t.dashboard.periodCustomApply}
          </button>
          {customError && <span className="text-xs text-red-500">{customError}</span>}
        </div>
      )}
    </div>
  );
}
