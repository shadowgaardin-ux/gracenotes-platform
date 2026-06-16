import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, ScrollText } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/sermons/")({
  head: () => ({ meta: [{ title: "Sermons — GraceNotes" }] }),
  component: SermonsList,
});

function SermonsList() {
  const { isPastoral } = useCurrentUser();
  const q = useQuery({
    queryKey: ["sermons"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sermons")
        .select("id, title, summary, delivered_at, created_at")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <AppShell>
      <div className="px-6 md:px-10 py-10 max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Library</p>
            <h1 className="mt-1 font-display text-4xl">Sermons</h1>
          </div>
          {isPastoral && (
            <Link
              to="/sermons/new"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> New sermon
            </Link>
          )}
        </div>

        <div className="mt-8 grid gap-3">
          {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!q.isLoading && (q.data?.length ?? 0) === 0 && (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <ScrollText className="h-6 w-6 mx-auto text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">No sermons in the archive yet.</p>
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
                <span className="text-xs text-muted-foreground whitespace-nowrap">
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
    </AppShell>
  );
}
