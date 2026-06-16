import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Sparkles, Quote, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/sermons/$id")({
  head: () => ({ meta: [{ title: "Sermon — GraceNotes" }] }),
  component: SermonDetail,
});

const KIND_LABELS: Record<string, string> = {
  social_x: "X / Twitter",
  social_instagram: "Instagram",
  social_facebook: "Facebook",
  discussion_guide: "Discussion guide",
  bulletin: "Bulletin",
  newsletter: "Newsletter",
};

function SermonDetail() {
  const { id } = Route.useParams();
  const { isPastoral } = useCurrentUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [regenerating, setRegenerating] = useState(false);

  const sermonQ = useQuery({
    queryKey: ["sermon", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sermons")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const contentQ = useQuery({
    queryKey: ["sermon-content", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("sermon_content")
        .select("*")
        .eq("sermon_id", id);
      return data ?? [];
    },
  });

  const refsQ = useQuery({
    queryKey: ["sermon-refs", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("scripture_refs")
        .select("*")
        .eq("sermon_id", id);
      return data ?? [];
    },
  });

  async function regenerate() {
    if (!sermonQ.data?.transcript) {
      toast.error("Add a transcript first.");
      return;
    }
    setRegenerating(true);
    try {
      const { generateSermonContent } = await import("@/lib/ai.functions");
      await generateSermonContent({
        data: {
          sermonId: id,
          transcript: sermonQ.data.transcript,
          title: sermonQ.data.title,
        },
      });
      toast.success("Refreshed.");
      qc.invalidateQueries({ queryKey: ["sermon", id] });
      qc.invalidateQueries({ queryKey: ["sermon-content", id] });
      qc.invalidateQueries({ queryKey: ["sermon-refs", id] });
    } catch (e: any) {
      toast.error(e.message ?? "Generation failed");
    } finally {
      setRegenerating(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this sermon and all derived content?")) return;
    const { error } = await supabase.from("sermons").delete().eq("id", id);
    if (error) toast.error(error.message);
    else navigate({ to: "/sermons" });
  }

  if (sermonQ.isLoading) {
    return <AppShell><div className="p-10 text-sm text-muted-foreground">Loading…</div></AppShell>;
  }
  if (!sermonQ.data) {
    return <AppShell><div className="p-10 text-sm text-muted-foreground">Sermon not found.</div></AppShell>;
  }

  const s = sermonQ.data;

  return (
    <AppShell>
      <div className="px-6 md:px-10 py-10 max-w-4xl">
        <Link to="/sermons" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> All sermons
        </Link>

        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {s.delivered_at ?? new Date(s.created_at).toLocaleDateString()}
            </p>
            <h1 className="mt-1 font-display text-5xl text-balance">{s.title}</h1>
            {s.scripture_focus && (
              <p className="mt-2 text-sm italic text-muted-foreground">{s.scripture_focus}</p>
            )}
          </div>
          {isPastoral && (
            <div className="flex gap-2">
              <button
                onClick={regenerate}
                disabled={regenerating}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {regenerating ? "Working…" : "Regenerate"}
              </button>
              <button
                onClick={remove}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs hover:bg-accent"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          )}
        </div>

        {s.summary && (
          <div className="mt-6 rounded-lg border-l-2 border-[color:var(--color-gold)] bg-card px-5 py-4">
            <p className="text-sm leading-relaxed">{s.summary}</p>
          </div>
        )}

        {(refsQ.data?.length ?? 0) > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-2xl flex items-center gap-2">
              <Quote className="h-4 w-4 text-primary" /> Scripture cited
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {refsQ.data!.map((r: any) => (
                <a
                  key={r.id}
                  href={`https://www.biblegateway.com/passage/?search=${encodeURIComponent(r.reference)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-border bg-card px-3 py-1 text-xs hover:border-primary/40"
                >
                  {r.reference}
                </a>
              ))}
            </div>
          </section>
        )}

        <section className="mt-10">
          <h2 className="font-display text-2xl">Multiplied content</h2>
          {(contentQ.data?.length ?? 0) === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No derived content yet. {isPastoral && "Click Regenerate above to create it."}
            </p>
          ) : (
            <div className="mt-4 grid gap-4">
              {contentQ.data!.map((c: any) => (
                <div key={c.id} className="rounded-lg border border-border bg-card p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.16em] text-primary">
                      {KIND_LABELS[c.kind] ?? c.kind}
                    </p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(c.content);
                        toast.success("Copied");
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="mt-3 text-sm whitespace-pre-wrap leading-relaxed">{c.content}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {s.transcript && (
          <details className="mt-10 rounded-lg border border-border bg-card">
            <summary className="cursor-pointer px-5 py-3 text-sm font-medium">Full transcript</summary>
            <div className="px-5 pb-5 whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
              {s.transcript}
            </div>
          </details>
        )}
      </div>
    </AppShell>
  );
}
