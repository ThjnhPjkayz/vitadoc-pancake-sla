"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface TopbarProps {
  userName: string;
  userEmail: string;
  userAvatarUrl: string;
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Topbar({ userName, userEmail, userAvatarUrl }: TopbarProps) {
  const { t, locale, setLocale } = useI18n();

  return (
    <header className="h-14 border-b border-zinc-200 bg-white px-6 flex items-center justify-between shrink-0">
      {/* Left — App name */}
      <span className="text-sm font-semibold text-zinc-800 tracking-tight">
        {t.common.appName}
      </span>

      {/* Right — Language + Avatar */}
      <div className="flex items-center gap-3">
        {/* Language toggle */}
        <div className="flex items-center gap-0.5 rounded-md border border-zinc-200 p-0.5 text-xs font-medium">
          <button
            onClick={() => setLocale("vi")}
            className={`px-2.5 py-1 rounded transition-colors ${
              locale === "vi"
                ? "bg-zinc-900 text-white"
                : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            VI
          </button>
          <button
            onClick={() => setLocale("en")}
            className={`px-2.5 py-1 rounded transition-colors ${
              locale === "en"
                ? "bg-zinc-900 text-white"
                : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            EN
          </button>
        </div>

        {/* Avatar + dropdown */}
        <div className="relative group">
          <button className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-zinc-100 transition-colors">
            {userAvatarUrl ? (
              <img
                src={userAvatarUrl}
                alt={userName}
                className="w-8 h-8 rounded-full object-cover ring-1 ring-zinc-200"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-zinc-800 text-white text-xs font-semibold flex items-center justify-center ring-1 ring-zinc-200">
                {getInitials(userName)}
              </div>
            )}
            <span className="text-sm text-zinc-700 font-medium hidden sm:block">
              {userName}
            </span>
          </button>

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-zinc-200 rounded-xl shadow-lg shadow-zinc-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
            <div className="px-4 py-3 border-b border-zinc-100">
              <p className="text-xs font-medium text-zinc-900 truncate">{userName}</p>
              <p className="text-xs text-zinc-400 truncate mt-0.5">{userEmail}</p>
            </div>
            <div className="p-1.5">
              <button
                onClick={() => signOut({ redirectTo: "/login" })}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                {t.common.signOut}
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
