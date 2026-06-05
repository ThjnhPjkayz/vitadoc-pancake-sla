"use client";

import { Search, X, Calendar } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";

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
    hoursFilter: string;
    dateFrom: string;
    dateTo: string;
  };
  onFilterChange: (filters: FiltersBarProps["filters"]) => void;
  pages: FilterOption[];
  platforms: string[];
}

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  facebook: "Facebook",
  personal_zalo: "Zalo",
  tiktok_business_messaging: "TikTok Business",
};

const ALL = "_all";

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-muted-foreground px-0.5">{label}</span>
      {children}
    </div>
  );
}

export default function FiltersBar({
  filters,
  onFilterChange,
  pages,
  platforms,
}: FiltersBarProps) {
  const { t } = useI18n();
  const [localSearch, setLocalSearch] = useState(filters.search);

  useEffect(() => {
    const timer = setTimeout(() => {
      onFilterChange({ ...filters, search: localSearch });
    }, 400);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSearch]);

  const update = (key: string, value: string) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const hasActiveFilters =
    filters.search ||
    filters.pageId ||
    filters.platform ||
    filters.slaStatus ||
    filters.hoursFilter ||
    filters.dateFrom ||
    filters.dateTo;

  const SLA_STATUS_OPTIONS = [
    { value: ALL, label: t.filters.allStatuses },
    { value: "late", label: t.filters.lateReply },
    { value: "no-reply", label: t.filters.noReply },
    { value: "on-time", label: t.filters.onTime },
    { value: "outbound", label: t.filters.outbound },
  ];

  const HOURS_OPTIONS = [
    { value: ALL, label: t.filters.allHours },
    { value: "in-hours", label: t.filters.inHours },
    { value: "after-hours", label: t.filters.afterHoursOption },
  ];

  const pageDisplayLabel = filters.pageId
    ? (pages.find((p) => p.id === filters.pageId)?.name ?? t.filters.allPages)
    : t.filters.allPages;

  const platformDisplayLabel = filters.platform
    ? (PLATFORM_LABELS[filters.platform] ?? filters.platform)
    : t.filters.allPlatforms;

  const slaDisplayLabel =
    SLA_STATUS_OPTIONS.find((o) => o.value === (filters.slaStatus || ALL))?.label ??
    t.filters.allStatuses;

  const hoursDisplayLabel =
    HOURS_OPTIONS.find((o) => o.value === (filters.hoursFilter || ALL))?.label ??
    t.filters.allHours;

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Search */}
      <FilterField label={t.filters.search}>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder={t.filters.searchPlaceholder}
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </FilterField>

      {/* Page filter */}
      <FilterField label={t.filters.page}>
        <Select
          value={filters.pageId || ALL}
          onValueChange={(v) => update("pageId", v === ALL ? "" : v)}
        >
          <SelectTrigger className="min-w-[130px]">
            <SelectValue>{pageDisplayLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t.filters.allPages}</SelectItem>
            {pages.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      {/* Platform filter */}
      <FilterField label={t.filters.platform}>
        <Select
          value={filters.platform || ALL}
          onValueChange={(v) => update("platform", v === ALL ? "" : v)}
        >
          <SelectTrigger className="min-w-[130px]">
            <SelectValue>{platformDisplayLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t.filters.allPlatforms}</SelectItem>
            {platforms.map((p) => (
              <SelectItem key={p} value={p}>
                {PLATFORM_LABELS[p] ?? p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      {/* SLA Status */}
      <FilterField label={t.filters.slaStatus}>
        <Select
          value={filters.slaStatus || ALL}
          onValueChange={(v) => update("slaStatus", v === ALL ? "" : v)}
        >
          <SelectTrigger className="min-w-[150px]">
            <SelectValue>{slaDisplayLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SLA_STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      {/* Hours filter */}
      <FilterField label={t.filters.hours}>
        <Select
          value={filters.hoursFilter || ALL}
          onValueChange={(v) => update("hoursFilter", v === ALL ? "" : v)}
        >
          <SelectTrigger className="min-w-[140px]">
            <SelectValue>{hoursDisplayLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {HOURS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      {/* Date From */}
      <FilterField label={t.filters.from}>
        <div className="relative">
          <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => update("dateFrom", e.target.value)}
            className="h-8 pl-8 pr-2.5 text-base rounded-lg border border-input bg-transparent text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [color-scheme:light]"
          />
        </div>
      </FilterField>

      {/* Date To */}
      <FilterField label={t.filters.to}>
        <div className="relative">
          <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => update("dateTo", e.target.value)}
            className="h-8 pl-8 pr-2.5 text-base rounded-lg border border-input bg-transparent text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [color-scheme:light]"
          />
        </div>
      </FilterField>

      {/* Clear all */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            onFilterChange({
              search: "",
              pageId: "",
              platform: "",
              slaStatus: "",
              hoursFilter: "",
              dateFrom: "",
              dateTo: "",
            })
          }
          className="text-destructive hover:text-destructive hover:bg-destructive/10 mb-0.5"
        >
          <X className="w-3.5 h-3.5" />
          {t.filters.clear}
        </Button>
      )}
    </div>
  );
}
