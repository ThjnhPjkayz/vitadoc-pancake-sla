"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ConversationTab from "@/components/dashboard/conversation-tab";
import { useI18n } from "@/lib/i18n";

function InboxContent() {
  const searchParams = useSearchParams();
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">{t.conversations.inboxTitle}</h1>
        <p className="text-base text-muted-foreground mt-0.5">{t.conversations.inboxDescription}</p>
      </div>
      <ConversationTab
        conversationType="INBOX"
        initialPageId={searchParams.get("pageId") ?? ""}
        initialSlaStatus={searchParams.get("slaStatus") ?? ""}
      />
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense>
      <InboxContent />
    </Suspense>
  );
}
