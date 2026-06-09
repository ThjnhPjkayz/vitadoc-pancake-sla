"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useGlobalPeriod } from "@/hooks/use-global-period";
import ConversationTab from "@/components/dashboard/conversation-tab";
import { useI18n } from "@/lib/i18n";

function CommentContent() {
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const { dateFrom, dateTo } = useGlobalPeriod();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">{t.conversations.commentsTitle}</h1>
        <p className="text-base text-muted-foreground mt-0.5">{t.conversations.commentsDescription}</p>
      </div>
      <ConversationTab
        conversationType="COMMENT"
        initialPageId={searchParams.get("pageId") ?? ""}
        initialSlaStatus={searchParams.get("slaStatus") ?? ""}
        dateFrom={dateFrom.toISOString()}
        dateTo={dateTo.toISOString()}
      />
    </div>
  );
}

export default function CommentPage() {
  return (
    <Suspense>
      <CommentContent />
    </Suspense>
  );
}
