import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/sermons/new")({
  head: () => ({ meta: [{ title: "New sermon — GraceNotes" }] }),
  component: NewSermon,
});

function NewSermon() {
  const { profile } = useCurrentUser();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [deliveredAt, setDeliveredAt] = useState("");
  const [scriptureFocus, setScriptureFocus] = useState("");
  const [transcript, setTranscript] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(generate: boolean) {
    if (!profile?.organization_id) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("sermons")
        .insert({
          organization_id: profile.organization_id,
          author_id: profile.id,
          title: title.trim(),
          delivered_at: deliveredAt || null,
          scripture_focus: scriptureFocus || null,
          transcript: transcript || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (generate && transcript.trim().length > 20) {
        toast.message("Generating content with Lovable AI…");
        const { generateSermonContent } = await import("@/lib/ai.functions");
        await generateSermonContent({
          data: { sermonId: data.id, transcript, title: title.trim() },
        });
        toast.success("Content generated.");
      } else {
        toast.success("Sermon saved.");
      }
      navigate({ to: "/sermons/$id", params: { id: data.id } });
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="px-6 md:px-10 py-10 max-w-3xl">
        <Link to="/sermons" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> All sermons
        </Link>
        <h1 className="mt-3 font-display text-4xl">New sermon</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste a transcript and GraceNotes will multiply it into social posts, a bulletin, a newsletter, and a discussion guide.
        </p>

        <div className="mt-8 space-y-4">
          <Field label="Title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="The Long Obedience"
              className="input"
            />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Delivered">
              <input
                type="date"
                value={deliveredAt}
                onChange={(e) => setDeliveredAt(e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Scripture focus">
              <input
                value={scriptureFocus}
                onChange={(e) => setScriptureFocus(e.target.value)}
                placeholder="Philippians 3:12–14"
                className="input"
              />
            </Field>
          </div>
          <Field label="Transcript">
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={14}
              placeholder="Paste the full sermon transcript here. (Audio/video transcription coming soon — for now, paste text.)"
              className="input font-mono text-sm leading-relaxed"
            />
          </Field>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            disabled={saving || !title}
            onClick={() => save(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {saving ? "Working…" : "Save & multiply"}
          </button>
          <button
            disabled={saving || !title}
            onClick={() => save(false)}
            className="rounded-md border border-border bg-card px-5 py-2.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            Save draft
          </button>
        </div>
      </div>

      <style>{`
        .input {
          width: 100%;
          background: var(--color-background);
          border: 1px solid var(--color-input);
          border-radius: 0.5rem;
          padding: 0.625rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }
        .input:focus { box-shadow: 0 0 0 2px var(--color-ring); }
      `}</style>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
