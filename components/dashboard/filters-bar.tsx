"use client";

import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";

interface FilterOption {
  id: string;
  name: string;
  platform: string;
}

interface FiltersBarProps {
  filters: {
    search: string;
    pageId: string;
    platform: string;
    slaStatus: string;
    dateFrom: string;
    dateTo: string;
  };
  onFilterChange: (filters: FiltersBarProps["filters"]) => void;
  pages: FilterOption[];
  platforms: string[];
}

const SLA_STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "on-time", label: "✅ On Time" },
  { value: "late", label: "🔴 Late Reply" },
  { value: "no-reply", label: "⏳ No Reply" },
];

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  facebook: "Facebook",
  personal_zalo: "Zalo",
  tiktok_business_messaging: "TikTok Business",
};

export default function FiltersBar({
  filters,
  onFilterChange,
  pages,
  platforms,
}: FiltersBarProps) {
  const [localSearch, setLocalSearch] = useState(filters.search);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      onFilterChange({ ...filters, search: localSearch });
    }, 400);
    return () => clearTimeout(timer);
  }, [localSearch]);

  const update = (key: string, value: string) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const hasActiveFilters =
    filters.search ||
    filters.pageId ||
    filters.platform ||
    filters.slaStatus ||
    filters.dateFrom ||
    filters.dateTo;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          placeholder="Search customer..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Page filter */}
      <select
        value={filters.pageId}
        onChange={(e) => update("pageId", e.target.value)}
        className="px-3 py-2 text-sm rounded-lg border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">All Pages</option>
        {pages.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      {/* Platform filter */}
      <select
        value={filters.platform}
        onChange={(e) => update("platform", e.target.value)}
        className="px-3 py-2 text-sm rounded-lg border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">All Platforms</option>
        {platforms.map((p) => (
          <option key={p} value={p}>
            {PLATFORM_LABELS[p] ?? p}
          </option>
        ))}
      </select>

      {/* SLA Status */}
      <select
        value={filters.slaStatus}
        onChange={(e) => update("slaStatus", e.target.value)}
        className="px-3 py-2 text-sm rounded-lg border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        {SLA_STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Date From */}
      <input
        type="date"
        value={filters.dateFrom}
        onChange={(e) => update("dateFrom", e.target.value)}
        className="px-3 py-2 text-sm rounded-lg border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />

      {/* Date To */}
      <input
        type="date"
        value={filters.dateTo}
        onChange={(e) => update("dateTo", e.target.value)}
        className="px-3 py-2 text-sm rounded-lg border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />

      {/* Clear all */}
      {hasActiveFilters && (
        <button
          onClick={() =>
            onFilterChange({
              search: "",
              pageId: "",
              platform: "",
              slaStatus: "",
              dateFrom: "",
              dateTo: "",
            })
          }
          className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg text-red-600 hover:bg-red-50 transition-colors"
        >
          <X className="w-4 h-4" />
          Clear
        </button>
      )}
    </div>
  );
}
