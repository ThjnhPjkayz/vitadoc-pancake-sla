"use client";

import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type Updater,
} from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
} from "lucide-react";

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
  customerMessageAt: string | null;
  conversationType: string;
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
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<ConversationRow>[]>(
    () => [
      {
        id: "customerName",
        header: "Customer",
        accessorKey: "customerName",
        cell: ({ row }) => (
          <div className="min-w-[140px]">
            <div className="font-medium text-zinc-900">
              {row.original.customerName ?? "Unknown"}
            </div>
            {row.original.customerUsername && (
              <div className="text-xs text-zinc-500">
                @{row.original.customerUsername}
              </div>
            )}
          </div>
        ),
      },
      {
        id: "pageName",
        header: "Page",
        accessorKey: "pageName",
        cell: ({ row }) => (
          <div className="min-w-[120px]">
            <div className="text-sm text-zinc-900 max-w-[160px] truncate">
              {row.original.pageName}
            </div>
            <div className="text-xs text-zinc-500">
              {PLATFORM_LABELS[row.original.platform] ?? row.original.platform}
            </div>
          </div>
        ),
      },
      {
        id: "conversationType",
        header: "Type",
        accessorKey: "conversationType",
        cell: ({ row }) => (
          <span
            className={`inline-flex px-2 py-0.5 text-xs rounded-full ${
              row.original.conversationType === "INBOX"
                ? "bg-blue-50 text-blue-700"
                : "bg-purple-50 text-purple-700"
            }`}
          >
            {row.original.conversationType}
          </span>
        ),
      },
      {
        id: "lastMessage",
        header: "Last Message",
        accessorKey: "lastMessage",
        cell: ({ row }) => (
          <div className="max-w-[220px] truncate text-sm text-zinc-500">
            {row.original.lastMessage ?? "—"}
          </div>
        ),
      },
      {
        id: "responseTime",
        header: "Response Time",
        accessorKey: "responseTimeMinutes",
        cell: ({ row }) => {
          const mins = row.original.responseTimeMinutes;
          if (mins === null) {
            return (
              <span className="text-sm text-zinc-400">No reply</span>
            );
          }
          return (
            <span
              className={`text-sm font-mono ${
                row.original.isLateReply
                  ? "text-red-600"
                  : "text-emerald-600"
              }`}
            >
              {mins}m
            </span>
          );
        },
      },
      {
        id: "slaStatus",
        header: "SLA",
        accessorKey: "isLateReply",
        cell: ({ row }) => {
          if (!row.original.hasReply) {
            return (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-zinc-100 text-zinc-500">
                ⏳ Pending
              </span>
            );
          }
          return row.original.isLateReply ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-red-50 text-red-700">
              🔴 Late
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-emerald-50 text-emerald-700">
              ✅ On Time
            </span>
          );
        },
      },
      {
        id: "customerMessageAt",
        header: "Time",
        accessorKey: "customerMessageAt",
        cell: ({ row }) => {
          const date = row.original.customerMessageAt;
          return (
            <span className="text-xs text-zinc-400 whitespace-nowrap">
              {date
                ? new Date(date).toLocaleString("vi-VN", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"}
            </span>
          );
        },
      },
    ],
    []
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
    <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="border-b border-zinc-200"
              >
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider cursor-pointer select-none hover:text-zinc-700 transition-colors"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      <ArrowUpDown className="w-3 h-3 opacity-50" />
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr
                  key={i}
                    className="border-b border-zinc-100"
                >
                  {columns.map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-zinc-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-zinc-400"
                >
                  No conversations found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 bg-zinc-50">
        <div className="flex items-center gap-3 text-sm text-zinc-500">
          <span>
            {total > 0 ? `${start}-${end} of ${total}` : "No results"}
          </span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-2 py-1 text-xs rounded border border-zinc-300 bg-white text-zinc-900"
          >
            {[10, 20, 50, 100].map((s) => (
              <option key={s} value={s}>
                {s}/page
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(1)}
            disabled={page <= 1}
            className="p-1.5 rounded hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="p-1.5 rounded hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-3 text-sm text-zinc-500">
            {page} / {totalPages || 1}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="p-1.5 rounded hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={page >= totalPages}
            className="p-1.5 rounded hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
