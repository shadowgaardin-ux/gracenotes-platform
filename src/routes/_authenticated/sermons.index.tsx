import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, ScrollText, Lock, Users, Search, Star, Tag, Layers, LayoutGrid, List, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/sermons/")({
  head: () => ({ meta: [{ title: "Sermon Library — GraceNotes" }] }),
  component: SermonsList,
});

type SermonRow = {
  id: string;
  title: string;
  summary: string | null;
  scripture_focus: string | null;
  delivered_at: string | null;
  created_at: string;
  visibility: string;
  author_id: string;
  is_favorite: boolean | null;
  tags: string[] | null;
  series: string | null;
  primary_topic: string | null;
};

function SermonsList() {
  const { profile } = useCurrentUser();
  const [scope, setScope] = useState<"mine" | "hub">("mine");
  const [view, setView] = useState<"topics" | "list">("topics");
  const [query, setQuery] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeSeries, setActiveSeries] = useState<string | null>(null);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["sermons", scope, profile?.id, profile?.organization_id],
    enabled: !!profile?.id,
    queryFn: async () => {
      let qb = supabase
        .from("sermons")
        .select(
          "id, title, summary, scripture_focus, delivered_at, created_at, visibility, author_id, is_favorite, tags, series, primary_topic",
        )
        .order("is_favorite", { ascending: false })
        .order("created_at", { ascending: false });
      if (scope === "mine") qb = qb.eq("author_id", profile!.id);
      else qb = qb.eq("visibility", "shared");
      const { data } = await qb;
      return (data ?? []) as unknown as SermonRow[];
    },
  });

  const allTags = useMemo(() => {
    const s = new Set<string>();
    (q.data ?? []).forEach((x) => (x.tags ?? []).forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [q.data]);
  const allSeries = useMemo(() => {
    const s = new Set<string>();
    (q.data ?? []).forEach((x) => x.series && s.add(x.series));
    return Array.from(s).sort();
  }, [q.data]);
  const allTopics = useMemo(() => {
    const s = new Set<string>();
    (q.data ?? []).forEach((x) => x.primary_topic && s.add(x.primary_topic));
    return Array.from(s).sort();
  }, [q.data]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (q.data ?? []).filter((s) => {
      if (favOnly && !s.is_favorite) return false;
      if (activeTag && !(s.tags ?? []).includes(activeTag)) return false;
      if (activeSeries && s.series !== activeSeries) return false;
      if (activeTopic && s.primary_topic !== activeTopic) return false;
      if (!term) return true;
      const hay = [s.title, s.summary, s.scripture_focus, s.series, s.primary_topic, ...(s.tags ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [q.data, query, favOnly, activeTag, activeSeries, activeTopic]);

  const grouped = useMemo(() => {
    const map = new Map<string, SermonRow[]>();
    for (const s of filtered) {
      const key = s.primary_topic?.trim() || "Untagged";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries()).sort((a, b) => {
      if (a[0] === "Untagged") return 1;
      if (b[0] === "Untagged") return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [filtered]);

  return (
    <AppShell>
      <div className="px-6 md:px-10 py-10 max-w-6xl">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Library</p>
            <h1 className="mt-1 font-display text-4xl">Sermon Library</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse by topic to find the message that meets today's need.
            </p>
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
          <div className="inline-flex p-1 bg-muted/50 rounded-lg text-sm">
            <button
              onClick={() => setView("topics")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md ${view === "topics" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> By topic
            </button>
            <button
              onClick={() => setView("list")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md ${view === "list" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
            >
              <List className="h-3.5 w-3.5" /> List
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
            placeholder="Search by topic, title, scripture, or summary… (try “forgiveness”, “hope”)"
            className="w-full pl-9 pr-3 py-2.5 rounded-md border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {allTopics.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-[color:var(--color-gold)]" />
            <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mr-1">Topics</span>
            {allTopics.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTopic(activeTopic === t ? null : t)}
                className={`text-xs rounded-full px-3 py-1 border ${activeTopic === t ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {(allSeries.length > 0 || allTags.length > 0) && (
          <div className="mt-3 space-y-2">
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

        <div className="mt-6">
          {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!q.isLoading && filtered.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <ScrollText className="h-6 w-6 mx-auto text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                {query || favOnly || activeTag || activeSeries || activeTopic
                  ? "No sermons match your filters."
                  : scope === "mine"
                    ? "Your notebook is empty. Record or paste your first sermon."
                    : "No shared sermons in your church hub yet."}
              </p>
            </div>
          )}

          {view === "list" && (
            <div className="grid gap-3">
              {filtered.map((s) => (
                <SermonCard key={s.id} s={s} />
              ))}
            </div>
          )}

          {view === "topics" && filtered.length > 0 && (
            <div className="space-y-8">
              {grouped.map(([topic, items]) => (
                <section key={topic}>
                  <div className="flex items-baseline justify-between gap-2 border-b border-border pb-2 mb-4">
                    <h2 className="font-display text-2xl">
                      {topic}
                      <span className="ml-2 text-xs font-sans text-muted-foreground">({items.length})</span>
                    </h2>
                    {topic !== "Untagged" && (
                      <button
                        onClick={() => setActiveTopic(activeTopic === topic ? null : topic)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        {activeTopic === topic ? "Show all topics" : "Focus this topic"}
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {items.map((s) => (
                      <SermonCard key={s.id} s={s} showTopic={false} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function SermonCard({ s, showTopic = true }: { s: SermonRow; showTopic?: boolean }) {
  return (
    <Link
      to="/sermons/$id"
      params={{ id: s.id }}
      className="block h-full rounded-lg border border-border bg-card p-5 hover:border-primary/40 hover:shadow-sm transition"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-display text-xl flex items-center gap-2 leading-tight">
          {s.is_favorite && <Star className="h-4 w-4 fill-[color:var(--color-gold)] text-[color:var(--color-gold)]" />}
          {s.title}
        </h3>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
          {s.visibility === "shared" ? <Users className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
          {s.delivered_at ?? new Date(s.created_at).toLocaleDateString()}
        </span>
      </div>
      {showTopic && s.primary_topic && (
        <p className="mt-1 inline-block text-[10px] uppercase tracking-[0.16em] text-primary/80 border border-primary/30 rounded-full px-2 py-0.5">
          {s.primary_topic}
        </p>
      )}
      {s.series && <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{s.series}</p>}
      {s.summary ? (
        <p className="mt-2 text-sm text-foreground/80 line-clamp-4 leading-relaxed">{s.summary}</p>
      ) : (
        <p className="mt-2 text-xs italic text-muted-foreground">No AI summary yet — open to generate.</p>
      )}
      {(s.tags?.length ?? 0) > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {s.tags!.slice(0, 4).map((t) => (
            <span key={t} className="text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
              #{t}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

