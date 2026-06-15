"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type Updater,
} from "@tanstack/react-table";
import { Moon, Sun } from "lucide-react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
} from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";

interface ConversationRow {
  id: string;
  customerName: string | null;
  customerUsername: string | null;
  pageName: string;
  platform: string;
  pageId: string;
  lastMessage: string | null;
  responseTimeMinutes: number | null;
  isLateReply: boolean;
  hasReply: boolean;
  isOutbound: boolean;
  customerMessageAt: string | null;
  adminReplyAt: string | null;
  conversationType: string;
  outsideBusinessHours: boolean;
}

interface ConversationsTableProps {
  data: ConversationRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onSortChange: (sortBy: string, sortOrder: string) => void;
  loading?: boolean;
}

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  facebook: "Facebook",
  personal_zalo: "Zalo",
  tiktok_business_messaging: "TT Biz",
};

function HoursBadge({ outside, labels }: { outside: boolean; labels: { afterHours: string; workingHours: string } }) {
  if (outside) {
    return (
      <span className="inline-flex items-center gap-1 text-sm text-indigo-500 font-medium">
        <Moon className="w-3 h-3" />
        {labels.afterHours}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-sm text-amber-500 font-medium">
      <Sun className="w-3 h-3" />
      {labels.workingHours}
    </span>
  );
}

function SLABadge({ row, labels }: { row: ConversationRow; labels: { outbound: string; noReply: string; late: string; onTime: string } }) {
  const [now, setNow] = useState<number>(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  if (row.isOutbound) {
    return (
      <Badge className="bg-violet-50 text-violet-600 border-violet-200 hover:bg-violet-50">
        {labels.outbound}
      </Badge>
    );
  }
  if (!row.hasReply) {
    const waitMs = row.customerMessageAt
      ? now - new Date(row.customerMessageAt).getTime()
      : null;
    const waitHours = waitMs !== null ? Math.floor(waitMs / 3_600_000) : null;
    const waitLabel =
      waitHours === null ? "" : waitHours < 1 ? " · <1h" : waitHours < 24 ? ` · ${waitHours}h` : ` · ${Math.floor(waitHours / 24)}d`;
    return (
      <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50 whitespace-nowrap">
        {labels.noReply}{waitLabel}
      </Badge>
    );
  }
  if (row.isLateReply) {
    return <Badge variant="destructive">{labels.late}</Badge>;
  }
  return (
    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
      {labels.onTime}
    </Badge>
  );
}

// Luôn hiển thị theo giờ VN (Asia/Ho_Chi_Minh) để khớp Pancake, không phụ thuộc
// timezone của trình duyệt người xem.
function formatDate(iso: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("day")}/${get("month")} ${get("hour")}:${get("minute")}`;
}

export default function ConversationsTable({
  data,
  total,
  page,
  pageSize,
  totalPages,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  loading,
}: ConversationsTableProps) {
  const { t } = useI18n();
  const [sorting, setSorting] = useState<SortingState>([]);

  const slaLabels = {
    outbound: t.table.status.outbound,
    noReply: t.table.status.noReply,
    late: t.table.status.late,
    onTime: t.table.status.onTime,
  };

  const hoursLabels = {
    afterHours: t.table.hours.afterHours,
    workingHours: t.table.hours.workingHours,
  };

  const columns = useMemo<ColumnDef<ConversationRow>[]>(
    () => [
      {
        id: "pageName",
        header: t.table.col.page,
        accessorKey: "pageName",
        cell: ({ row }) => (
          <div className="min-w-[120px]">
            <div className="text-sm max-w-[160px] truncate font-medium">
              {row.original.pageName}
            </div>
            <div className="text-sm text-muted-foreground">
              {PLATFORM_LABELS[row.original.platform] ?? row.original.platform}
            </div>
          </div>
        ),
      },
      {
        id: "customerName",
        header: t.table.col.customer,
        accessorKey: "customerName",
        cell: ({ row }) => (
          <div className="min-w-[140px]">
            <div className="font-medium text-sm">
              {row.original.customerName ?? "Unknown"}
            </div>
            {row.original.customerUsername && (
              <div className="text-sm text-muted-foreground">
                @{row.original.customerUsername}
              </div>
            )}
          </div>
        ),
      },
      {
        id: "lastMessage",
        header: t.table.col.lastMessage,
        accessorKey: "lastMessage",
        cell: ({ row }) => {
          const msg = row.original.lastMessage;
          if (!msg) return <span className="text-muted-foreground/40 text-sm">—</span>;
          return (
            <span className="text-sm text-zinc-600 max-w-[220px] block truncate" title={msg}>
              {msg}
            </span>
          );
        },
      },
      {
        id: "responseTime",
        header: t.table.col.responseTime,
        accessorKey: "responseTimeMinutes",
        cell: ({ row }) => {
          const mins = row.original.responseTimeMinutes;
          if (mins === null) return <span className="text-sm text-muted-foreground/50">—</span>;
          return (
            <span className={`text-sm font-mono font-medium ${row.original.isLateReply ? "text-red-600" : "text-emerald-600"}`}>
              {mins}m
            </span>
          );
        },
      },
      {
        id: "slaStatus",
        header: t.table.col.sla,
        accessorKey: "isLateReply",
        cell: ({ row }) => <SLABadge row={row.original} labels={slaLabels} />,
      },
      {
        id: "hours",
        header: t.table.col.hours,
        accessorKey: "outsideBusinessHours",
        cell: ({ row }) => (
          <HoursBadge outside={row.original.outsideBusinessHours} labels={hoursLabels} />
        ),
      },
      {
        id: "customerMessageAt",
        header: t.table.col.customerMsg,
        accessorKey: "customerMessageAt",
        cell: ({ row }) => {
          const date = row.original.customerMessageAt;
          return (
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {date ? formatDate(date) : "—"}
            </span>
          );
        },
      },
      {
        id: "adminReplyAt",
        header: t.table.col.csReply,
        accessorKey: "adminReplyAt",
        cell: ({ row }) => {
          const date = row.original.adminReplyAt;
          return (
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {date ? formatDate(date) : <span className="text-muted-foreground/30">—</span>}
            </span>
          );
        },
      },
    ],
    [t]
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: (updater: Updater<SortingState>) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      setSorting(next);
      if (next.length > 0) {
        onSortChange(next[0].id, next[0].desc ? "desc" : "asc");
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    manualSorting: true,
  });

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="bg-muted/40 hover:bg-muted/40">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="text-xs font-semibold uppercase tracking-wider cursor-pointer select-none"
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <div className="flex items-center gap-1">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    <ArrowUpDown className="w-3 h-3 opacity-40" />
                  </div>
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {columns.map((_, j) => (
                  <TableCell key={j}>
                    <div className="h-4 bg-muted rounded animate-pulse" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-12 text-center text-muted-foreground">
                {t.table.noConversations}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>
            {total > 0 ? `${start}–${end} ${t.table.of} ${total}` : t.common.noResults}
          </span>
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger className="h-7 text-xs w-auto min-w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50, 100].map((s) => (
                <SelectItem key={s} value={String(s)} className="text-xs">
                  {s}{t.table.perPage}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" onClick={() => onPageChange(1)} disabled={page <= 1}>
            <ChevronsLeft className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <span className="px-3 text-sm text-muted-foreground min-w-[60px] text-center">
            {page} / {totalPages || 1}
          </span>
          <Button variant="outline" size="icon-sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => onPageChange(totalPages)} disabled={page >= totalPages}>
            <ChevronsRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
