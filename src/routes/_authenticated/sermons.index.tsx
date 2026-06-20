import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, ScrollText, Lock, Users, Search, Star, Tag, Layers } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/sermons/")({
  head: () => ({ meta: [{ title: "Sermons — GraceNotes" }] }),
  component: SermonsList,
});

function SermonsList() {
  const { profile } = useCurrentUser();
  const [scope, setScope] = useState<"mine" | "hub">("mine");
  const [query, setQuery] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeSeries, setActiveSeries] = useState<string | null>(null);


  const q = useQuery({
    queryKey: ["sermons", scope, profile?.id, profile?.organization_id],
    enabled: !!profile?.id,
    queryFn: async () => {
      let qb = supabase
        .from("sermons")
        .select("id, title, summary, scripture_focus, delivered_at, created_at, visibility, author_id, is_favorite, tags, series")
        .order("is_favorite", { ascending: false })
        .order("created_at", { ascending: false });
      if (scope === "mine") qb = qb.eq("author_id", profile!.id);
      else qb = qb.eq("visibility", "shared");
      const { data } = await qb;
      return data ?? [];
    },
  });

  const allTags = useMemo(() => {
    const s = new Set<string>();
    (q.data ?? []).forEach((x: any) => (x.tags ?? []).forEach((t: string) => s.add(t)));
    return Array.from(s).sort();
  }, [q.data]);
  const allSeries = useMemo(() => {
    const s = new Set<string>();
    (q.data ?? []).forEach((x: any) => x.series && s.add(x.series));
    return Array.from(s).sort();
  }, [q.data]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (q.data ?? []).filter((s: any) => {
      if (favOnly && !s.is_favorite) return false;
      if (activeTag && !(s.tags ?? []).includes(activeTag)) return false;
      if (activeSeries && s.series !== activeSeries) return false;
      if (!term) return true;
      const hay = [s.title, s.summary, s.scripture_focus, s.series, ...(s.tags ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [q.data, query, favOnly, activeTag, activeSeries]);

  return (
    <AppShell>
      <div className="px-6 md:px-10 py-10 max-w-5xl">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Library</p>
            <h1 className="mt-1 font-display text-4xl">Sermons</h1>
          </div>
          <Link
            to="/sermons/new"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> New sermon
          </Link>

        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="inline-flex p-1 bg-muted/50 rounded-lg text-sm">
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
          <button
            onClick={() => setFavOnly((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs ${favOnly ? "border-[color:var(--color-gold)] bg-[color:var(--color-gold)]/10 text-foreground" : "border-border bg-card text-muted-foreground"}`}
          >
            <Star className={`h-3.5 w-3.5 ${favOnly ? "fill-[color:var(--color-gold)] text-[color:var(--color-gold)]" : ""}`} />
            Favorites
          </button>
        </div>

        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, summary, scripture, tags…"
            className="w-full pl-9 pr-3 py-2.5 rounded-md border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {(allSeries.length > 0 || allTags.length > 0) && (
          <div className="mt-4 space-y-2">
            {allSeries.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                {allSeries.map((s) => (
                  <button
                    key={s}
                    onClick={() => setActiveSeries(activeSeries === s ? null : s)}
                    className={`text-xs rounded-full px-2.5 py-1 border ${activeSeries === s ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {allTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                {allTags.map((t) => (
                  <button
                    key={t}
                    onClick={() => setActiveTag(activeTag === t ? null : t)}
                    className={`text-xs rounded-full px-2.5 py-1 border ${activeTag === t ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
                  >
                    #{t}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 grid gap-3">
          {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!q.isLoading && filtered.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <ScrollText className="h-6 w-6 mx-auto text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                {query || favOnly || activeTag || activeSeries
                  ? "No sermons match your filters."
                  : scope === "mine"
                    ? "Your notebook is empty. Record or paste your first sermon."
                    : "No shared sermons in your church hub yet."}
              </p>
            </div>
          )}
          {filtered.map((s: any) => (
            <Link
              key={s.id}
              to="/sermons/$id"
              params={{ id: s.id }}
              className="rounded-lg border border-border bg-card p-5 hover:border-primary/40 hover:shadow-sm transition"
            >
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="font-display text-2xl flex items-center gap-2">
                  {s.is_favorite && <Star className="h-4 w-4 fill-[color:var(--color-gold)] text-[color:var(--color-gold)]" />}
                  {s.title}
                </h2>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                  {s.visibility === "shared" ? <Users className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                  {s.delivered_at ?? new Date(s.created_at).toLocaleDateString()}
                </span>
              </div>
              {s.series && <p className="mt-1 text-xs uppercase tracking-wider text-primary/80">{s.series}</p>}
              {s.summary && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{s.summary}</p>}
              {(s.tags?.length ?? 0) > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {s.tags.map((t: string) => (
                    <span key={t} className="text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>

    </AppShell>

  );
}
