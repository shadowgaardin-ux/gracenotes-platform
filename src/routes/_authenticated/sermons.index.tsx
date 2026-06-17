import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, ScrollText, Lock, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { NewSermonDialog } from "@/components/new-sermon-dialog";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/sermons/")({
  head: () => ({ meta: [{ title: "Sermons — GraceNotes" }] }),
  component: SermonsList,
});

function SermonsList() {
  const { profile } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"mine" | "hub">("mine");

  const q = useQuery({
    queryKey: ["sermons", scope, profile?.id, profile?.organization_id],
    enabled: !!profile?.id,
    queryFn: async () => {
      let query = supabase
        .from("sermons")
        .select("id, title, summary, delivered_at, created_at, visibility, author_id")
        .order("created_at", { ascending: false });
      if (scope === "mine") query = query.eq("author_id", profile!.id);
      else query = query.eq("visibility", "shared");
      const { data } = await query;
      return data ?? [];
    },
  });

  return (
    <AppShell>
      <div className="px-6 md:px-10 py-10 max-w-5xl">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Library</p>
            <h1 className="mt-1 font-display text-4xl">Sermons</h1>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> New sermon
          </button>
        </div>

        <div className="mt-6 inline-flex p-1 bg-muted/50 rounded-lg text-sm">
          <button
            onClick={() => setScope("mine")}
            className={`px-4 py-1.5 rounded-md ${scope === "mine" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
          >
            My notebook
          </button>
          <button
            onClick={() => setScope("hub")}
            className={`px-4 py-1.5 rounded-md ${scope === "hub" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
          >
            Church Hub
          </button>
        </div>

        <div className="mt-6 grid gap-3">
          {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!q.isLoading && (q.data?.length ?? 0) === 0 && (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <ScrollText className="h-6 w-6 mx-auto text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                {scope === "mine" ? "Your notebook is empty. Record or paste your first sermon." : "No shared sermons in your church hub yet."}
              </p>
            </div>
          )}
          {q.data?.map((s: any) => (
            <Link
              key={s.id}
              to="/sermons/$id"
              params={{ id: s.id }}
              className="rounded-lg border border-border bg-card p-5 hover:border-primary/40 hover:shadow-sm transition"
            >
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="font-display text-2xl">{s.title}</h2>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                  {s.visibility === "shared" ? <Users className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                  {s.delivered_at ?? new Date(s.created_at).toLocaleDateString()}
                </span>
              </div>
              {s.summary && (
                <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{s.summary}</p>
              )}
            </Link>
          ))}
        </div>
      </div>

      <NewSermonDialog open={open} onOpenChange={setOpen} />
    </AppShell>
  );
}
