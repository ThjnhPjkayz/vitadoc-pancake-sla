import { redirect } from "next/navigation";
import { TooltipProvider } from "@/components/ui/tooltip";
import Topbar from "@/components/topbar";
import Sidebar from "@/components/sidebar";
import { auth } from "@/auth";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;

  return (
    <TooltipProvider>
      <Topbar
        userName={user?.name ?? user?.email ?? ""}
        userEmail={user?.email ?? ""}
        userAvatarUrl={user?.image ?? ""}
      />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-zinc-50 px-8 py-6">{children}</main>
      </div>
    </TooltipProvider>
  );
}
