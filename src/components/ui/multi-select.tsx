"use client";

import * as React from "react";
import { ChevronDownIcon, CheckIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
  emptyText?: string;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select…",
  className,
  emptyText = "No options",
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  // Đóng khi click ra ngoài
  React.useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    );
  };

  const label =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? selected[0]
        : `${selected.length} đã chọn`;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none",
          "hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring/50",
          selected.length === 0 && "text-muted-foreground"
        )}
      >
        <span className="truncate">{label}</span>
        <div className="flex items-center gap-1 shrink-0">
          {selected.length > 0 && (
            <XIcon
              className="size-3.5 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
            />
          )}
          <ChevronDownIcon className="size-4 opacity-50" />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 max-h-64 w-full min-w-[180px] overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {options.length === 0 ? (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">{emptyText}</div>
          ) : (
            options.map((opt) => {
              const isSel = selected.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggle(opt)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-left",
                    "hover:bg-accent hover:text-accent-foreground",
                    isSel && "font-medium"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
                      isSel ? "bg-primary border-primary text-primary-foreground" : "border-input"
                    )}
                  >
                    {isSel && <CheckIcon className="size-3" />}
                  </span>
                  <span className="truncate">{opt}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
