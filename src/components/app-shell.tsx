import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, ScrollText, Lock, Settings, LogOut, BookOpenText, Sun, Moon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, orgName, isPastoral, roles } = useCurrentUser();
  const { toggle } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const nav = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: true },
    { to: "/sermons", label: "Sermons", icon: ScrollText, show: true },
    { to: "/vault", label: "Pastoral Vault", icon: Lock, show: isPastoral },
    { to: "/settings", label: "Settings", icon: Settings, show: true },
  ].filter((n) => n.show);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="px-6 py-7 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <BookOpenText className="h-6 w-6 text-sidebar-primary" />
            <span className="font-display text-2xl tracking-tight">GraceNotes</span>
          </div>
          {orgName && (
            <p className="mt-3 text-xs uppercase tracking-[0.18em] text-sidebar-foreground/60">
              {orgName}
            </p>
          )}
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((n) => {
            const active = pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-4 border-t border-sidebar-border">
          <div className="text-sm">
            <p className="font-medium truncate">{profile?.full_name ?? profile?.email}</p>
            <p className="text-xs text-sidebar-foreground/60 capitalize">
              {roles.join(" · ") || "member"}
            </p>
          </div>
          <button
            onClick={signOut}
            className="mt-3 inline-flex items-center gap-2 text-xs text-sidebar-foreground/70 hover:text-sidebar-primary"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
