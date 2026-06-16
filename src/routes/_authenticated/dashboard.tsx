import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ScrollText, Lock, Sparkles, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — GraceNotes" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { profile, orgName, isPastoral } = useCurrentUser();

  const sermonsQ = useQuery({
    queryKey: ["sermons-recent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sermons")
        .select("id, title, delivered_at, summary, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  return (
    <AppShell>
      <div className="px-6 md:px-10 py-10 max-w-5xl">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {orgName ?? "Your church"}
        </p>
        <h1 className="mt-2 font-display text-5xl text-balance">
          Grace and peace, {profile?.full_name?.split(" ")[0] ?? "friend"}.
        </h1>
        <div className="mt-4 h-px gold-line w-40" />

        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ActionCard
            to="/sermons/new"
            icon={Sparkles}
            label="New sermon"
            sub="Transcribe and multiply"
            show={isPastoral}
          />
          <ActionCard to="/sermons" icon={ScrollText} label="Sermons" sub="Browse the archive" show />
          <ActionCard to="/vault" icon={Lock} label="Pastoral Vault" sub="Private notes" show={isPastoral} />
        </div>

        <section className="mt-12">
          <h2 className="font-display text-2xl">Recent sermons</h2>
          <div className="mt-4 rounded-xl border border-border bg-card divide-y divide-border">
            {sermonsQ.isLoading && (
              <div className="p-6 text-sm text-muted-foreground">Loading…</div>
            )}
            {!sermonsQ.isLoading && (sermonsQ.data?.length ?? 0) === 0 && (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No sermons yet.{" "}
                {isPastoral && (
                  <Link to="/sermons/new" className="text-primary hover:underline">
                    Add the first one →
                  </Link>
                )}
              </div>
            )}
            {sermonsQ.data?.map((s: any) => (
              <Link
                key={s.id}
                to="/sermons/$id"
                params={{ id: s.id }}
                className="flex items-center justify-between p-5 hover:bg-accent"
              >
                <div>
                  <p className="font-medium">{s.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {s.delivered_at ?? new Date(s.created_at).toLocaleDateString()}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function ActionCard({
  to, icon: Icon, label, sub, show,
}: { to: string; icon: any; label: string; sub: string; show: boolean }) {
  if (!show) return null;
  return (
    <Link
      to={to}
      className="group rounded-xl border border-border bg-card p-6 hover:border-primary/40 hover:shadow-sm transition"
    >
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-4 font-display text-2xl">{label}</p>
      <p className="text-sm text-muted-foreground">{sub}</p>
      <ArrowRight className="mt-3 h-4 w-4 text-muted-foreground group-hover:text-primary transition" />
    </Link>
  );
}
