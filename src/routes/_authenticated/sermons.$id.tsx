import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Sparkles,
  Quote,
  Trash2,
  Lock,
  Users,
  Send,
  MessageCircle,
  BookOpen,
  Footprints,
  Eye,
  ScrollText,
  Star,
  Download,
  FileDown,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import { BibleVersePopover } from "@/components/bible-verse-popover";
import { downloadTranscript, exportSermonPDF } from "@/lib/sermon-export";

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

type ChatMsg = { role: "user" | "assistant"; content: string };

function SermonDetail() {
  const { id } = Route.useParams();
  const { profile } = useCurrentUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [regenerating, setRegenerating] = useState(false);

  const sermonQ = useQuery({
    queryKey: ["sermon", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("sermons").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const contentQ = useQuery({
    queryKey: ["sermon-content", id],
    queryFn: async () => (await supabase.from("sermon_content").select("*").eq("sermon_id", id)).data ?? [],
  });
  const refsQ = useQuery({
    queryKey: ["sermon-refs", id],
    queryFn: async () => (await supabase.from("scripture_refs").select("*").eq("sermon_id", id)).data ?? [],
  });

  const isAuthor = !!sermonQ.data && profile?.id === sermonQ.data.author_id;

  async function regenerate() {
    if (!sermonQ.data?.transcript) {
      toast.error("Add a transcript first to generate notes.");
      return;
    }
    setRegenerating(true);
    try {
      const { generateSermonContent } = await import("@/lib/ai.functions");
      await generateSermonContent({
        data: { sermonId: id, transcript: sermonQ.data.transcript, title: sermonQ.data.title },
      });
      toast.success("Notes refreshed.");
      qc.invalidateQueries({ queryKey: ["sermon", id] });
      qc.invalidateQueries({ queryKey: ["sermon-content", id] });
      qc.invalidateQueries({ queryKey: ["sermon-refs", id] });
    } catch (e: any) {
      toast.error(e.message ?? "Generation failed");
    } finally {
      setRegenerating(false);
    }
  }

  async function toggleShare() {
    if (!sermonQ.data) return;
    const next = sermonQ.data.visibility === "shared" ? "private" : "shared";
    const { error } = await supabase.from("sermons").update({ visibility: next }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(next === "shared" ? "Shared to Church Hub" : "Made private");
      qc.invalidateQueries({ queryKey: ["sermon", id] });
    }
  }

  async function toggleFavorite() {
    if (!sermonQ.data) return;
    const next = !sermonQ.data.is_favorite;
    const { error } = await supabase.from("sermons").update({ is_favorite: next }).eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["sermon", id] });
  }

  async function updateMeta(patch: { tags?: string[]; series?: string | null }) {
    const { error } = await supabase.from("sermons").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["sermon", id] });
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
  const notebookRow = contentQ.data?.find((c: any) => c.kind === "notebook");
  const notebook: { core_theology: string[]; action_steps: string[]; visual_metaphors: string[] } = (() => {
    if (!notebookRow) return { core_theology: [], action_steps: [], visual_metaphors: [] };
    try {
      return JSON.parse(notebookRow.content);
    } catch {
      return { core_theology: [], action_steps: [], visual_metaphors: [] };
    }
  })();
  const multiplied = (contentQ.data ?? []).filter((c: any) => c.kind !== "notebook");
  const hasNotes =
    notebook.core_theology.length + notebook.action_steps.length + notebook.visual_metaphors.length > 0;

  return (
    <AppShell>
      <div className="px-6 md:px-10 py-8 max-w-7xl">
        <Link to="/sermons" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> All sermons
        </Link>

        <div className="mt-3 flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground inline-flex items-center gap-2">
              {s.visibility === "shared" ? <Users className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
              {s.visibility === "shared" ? "Shared to hub" : "Private notebook"}
              <span className="opacity-50">·</span>
              {s.delivered_at ?? new Date(s.created_at).toLocaleDateString()}
              {s.series && (
                <>
                  <span className="opacity-50">·</span>
                  <span className="text-primary">{s.series}</span>
                </>
              )}
            </p>
            <h1 className="mt-1 font-display text-4xl md:text-5xl text-balance flex items-center gap-2">
              {s.is_favorite && (
                <Star className="h-6 w-6 fill-[color:var(--color-gold)] text-[color:var(--color-gold)]" />
              )}
              {s.title}
            </h1>
            {s.scripture_focus && <p className="mt-2 text-sm italic text-muted-foreground">{s.scripture_focus}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {isAuthor && (
              <button
                onClick={toggleFavorite}
                title={s.is_favorite ? "Unfavorite" : "Favorite"}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs hover:bg-accent"
              >
                <Star className={`h-3.5 w-3.5 ${s.is_favorite ? "fill-[color:var(--color-gold)] text-[color:var(--color-gold)]" : ""}`} />
              </button>
            )}
            {s.transcript && (
              <button
                onClick={() => downloadTranscript(s.title, s.transcript!)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs hover:bg-accent"
              >
                <Download className="h-3.5 w-3.5" /> Transcript
              </button>
            )}
            <button
              onClick={() =>
                exportSermonPDF({
                  title: s.title,
                  date: s.delivered_at,
                  scripture: s.scripture_focus,
                  series: s.series,
                  summary: s.summary,
                  notebook,
                  references: (refsQ.data ?? []).map((r: any) => r.reference),
                })
              }
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs hover:bg-accent"
            >
              <FileDown className="h-3.5 w-3.5" /> PDF
            </button>
            {isAuthor && (
              <>
                <button
                  onClick={toggleShare}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs hover:bg-accent"
                >
                  {s.visibility === "shared" ? <Lock className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                  {s.visibility === "shared" ? "Make private" : "Share to hub"}
                </button>
                <button
                  onClick={regenerate}
                  disabled={regenerating}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {regenerating ? "Working…" : hasNotes ? "Regenerate" : "Generate notes"}
                </button>
                <button
                  onClick={remove}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs hover:bg-accent"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {s.summary && (
          <div className="mt-6 rounded-lg border-l-2 border-[color:var(--color-gold)] bg-card px-5 py-4">
            <p className="text-sm leading-relaxed">{s.summary}</p>
          </div>
        )}

        {isAuthor && (
          <MetaEditor
            tags={s.tags ?? []}
            series={s.series}
            onChange={(patch) => updateMeta(patch)}
          />
        )}

        {/* NotebookLM workspace */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-5">
            {!hasNotes ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
                <Sparkles className="h-6 w-6 mx-auto text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">
                  {s.transcript
                    ? "No AI notes yet. Tap Generate notes above."
                    : "Add a transcript to unlock structured AI notes and chat."}
                </p>
              </div>
            ) : (
              <>
                <BulletCard
                  icon={<BookOpen className="h-4 w-4" />}
                  label="Core theology"
                  accent="primary"
                  items={notebook.core_theology}
                />
                <BulletCard
                  icon={<Footprints className="h-4 w-4" />}
                  label="Key action steps"
                  accent="gold"
                  items={notebook.action_steps}
                />
                <BulletCard
                  icon={<Eye className="h-4 w-4" />}
                  label="Visual metaphors"
                  accent="muted"
                  items={notebook.visual_metaphors}
                />
              </>
            )}

            {(refsQ.data?.length ?? 0) > 0 && (
              <section className="rounded-xl border border-border bg-card p-5">
                <h2 className="font-display text-lg flex items-center gap-2">
                  <Quote className="h-4 w-4 text-primary" /> Scripture citations
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">Tap any reference to read the verse.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {refsQ.data!.map((r: any) => (
                    <BibleVersePopover key={r.id} reference={r.reference} />
                  ))}
                </div>
              </section>
            )}

            {multiplied.length > 0 && (
              <details className="rounded-xl border border-border bg-card">
                <summary className="cursor-pointer px-5 py-3 text-sm font-medium flex items-center gap-2">
                  <ScrollText className="h-4 w-4 text-muted-foreground" /> Multiplied content ({multiplied.length})
                </summary>
                <div className="px-5 pb-5 grid gap-4">
                  {multiplied.map((c: any) => (
                    <div key={c.id} className="rounded-lg border border-border bg-background p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-primary">{KIND_LABELS[c.kind] ?? c.kind}</p>
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
                      <p className="mt-2 text-sm whitespace-pre-wrap leading-relaxed">{c.content}</p>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {s.transcript && (
              <details className="rounded-xl border border-border bg-card">
                <summary className="cursor-pointer px-5 py-3 text-sm font-medium">Full transcript</summary>
                <div className="px-5 pb-5 whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
                  {s.transcript}
                </div>
              </details>
            )}
          </div>

          <ChatPanel sermonId={id} canChat={!!s.transcript} />
        </div>
      </div>
    </AppShell>
  );
}

function BulletCard({
  icon,
  label,
  items,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  items: string[];
  accent: "primary" | "gold" | "muted";
}) {
  if (!items?.length) return null;
  const dot =
    accent === "primary"
      ? "bg-primary"
      : accent === "gold"
        ? "bg-[color:var(--color-gold)]"
        : "bg-muted-foreground/40";
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="font-display text-lg flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        {label}
      </h2>
      <ul className="mt-3 space-y-2.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-3 text-sm leading-relaxed">
            <span className={`mt-2 h-1.5 w-1.5 rounded-full shrink-0 ${dot}`} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ChatPanel({ sermonId, canChat }: { sermonId: string; canChat: boolean }) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function send() {
    const q = input.trim();
    if (!q || sending || !canChat) return;
    const nextHistory = [...messages, { role: "user" as const, content: q }];
    setMessages(nextHistory);
    setInput("");
    setSending(true);
    try {
      const { chatWithSermon } = await import("@/lib/ai.functions");
      const { answer } = await chatWithSermon({
        data: { sermonId, question: q, history: messages.slice(-10) },
      });
      setMessages([...nextHistory, { role: "assistant", content: answer }]);
    } catch (e: any) {
      toast.error(e.message ?? "Chat failed");
      setMessages(nextHistory);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  const suggestions = [
    "Summarize the main point in 3 lines.",
    "What scriptures did the speaker lean on most?",
    "Give me a prayer based on this sermon.",
  ];

  return (
    <aside className="lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] flex flex-col rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-primary" />
        <div>
          <p className="text-sm font-medium">Ask this sermon</p>
          <p className="text-[11px] text-muted-foreground">Grounded in the transcript only</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-[300px] max-h-[60vh] lg:max-h-none">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Try asking:</p>
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => setInput(s)}
                disabled={!canChat}
                className="block w-full text-left text-sm rounded-md border border-border bg-background px-3 py-2 hover:border-primary/40 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
            {!canChat && (
              <p className="text-xs text-muted-foreground italic mt-3">Add a transcript to chat with this sermon.</p>
            )}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-3.5 py-2 text-sm leading-relaxed"
                  : "max-w-[92%] text-sm leading-relaxed whitespace-pre-wrap text-foreground"
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <p className="text-xs text-muted-foreground italic">Thinking…</p>
        )}
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            disabled={!canChat || sending}
            rows={2}
            placeholder={canChat ? "Ask about this sermon…" : "Add a transcript first"}
            className="flex-1 resize-none bg-background border border-input rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={!canChat || sending || !input.trim()}
            className="h-9 w-9 grid place-items-center rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

function MetaEditor({
  tags,
  series,
  onChange,
}: {
  tags: string[];
  series: string | null;
  onChange: (patch: { tags?: string[]; series?: string | null }) => void;
}) {
  const [tagInput, setTagInput] = useState("");
  const [seriesInput, setSeriesInput] = useState(series ?? "");

  useEffect(() => {
    setSeriesInput(series ?? "");
  }, [series]);

  function addTag() {
    const t = tagInput.trim().toLowerCase().replace(/^#/, "");
    if (!t || tags.includes(t)) {
      setTagInput("");
      return;
    }
    onChange({ tags: [...tags, t] });
    setTagInput("");
  }
  function removeTag(t: string) {
    onChange({ tags: tags.filter((x) => x !== t) });
  }
  function commitSeries() {
    const v = seriesInput.trim();
    if ((v || null) === (series ?? null)) return;
    onChange({ series: v || null });
  }

  return (
    <div className="mt-4 rounded-lg border border-border bg-card px-5 py-4 grid gap-3 md:grid-cols-2">
      <div>
        <label className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Series</label>
        <input
          value={seriesInput}
          onChange={(e) => setSeriesInput(e.target.value)}
          onBlur={commitSeries}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          placeholder="e.g. Summer in Psalms"
          className="mt-1 w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div>
        <label className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Tags</label>
        <div className="mt-1 flex flex-wrap gap-1.5 items-center rounded-md border border-input bg-background px-2 py-1.5">
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 text-xs rounded-full bg-muted px-2 py-0.5">
              #{t}
              <button onClick={() => removeTag(t)} className="text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addTag();
              }
            }}
            onBlur={addTag}
            placeholder={tags.length ? "" : "grace, hope…"}
            className="flex-1 min-w-[80px] bg-transparent text-sm outline-none py-0.5"
          />
        </div>
      </div>
    </div>
  );
}
