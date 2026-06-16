import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Lock, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/vault")({
  head: () => ({ meta: [{ title: "Pastoral Vault — GraceNotes" }] }),
  component: Vault,
});

function Vault() {
  const { profile, isPastoral } = useCurrentUser();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("counseling");
  const [body, setBody] = useState("");

  const q = useQuery({
    queryKey: ["vault"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vault_notes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: isPastoral,
  });

  async function add() {
    if (!profile?.organization_id || !title) return;
    const { error } = await supabase.from("vault_notes").insert({
      organization_id: profile.organization_id,
      author_id: profile.id,
      title,
      category,
      body,
    });
    if (error) return toast.error(error.message);
    toast.success("Saved to vault");
    setTitle(""); setBody(""); setOpen(false);
    qc.invalidateQueries({ queryKey: ["vault"] });
  }

  async function remove(id: string) {
    if (!confirm("Delete this note?")) return;
    const { error } = await supabase.from("vault_notes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["vault"] });
  }

  if (!isPastoral) {
    return (
      <AppShell>
        <div className="px-6 md:px-10 py-20 max-w-xl">
          <Lock className="h-8 w-8 text-primary" />
          <h1 className="mt-4 font-display text-3xl">Pastoral Vault</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The vault is restricted to verified pastoral roles. If you should have access, ask your admin to grant the pastor role to your account.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="px-6 md:px-10 py-10 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <Lock className="h-3.5 w-3.5" /> Restricted
            </div>
            <h1 className="mt-1 font-display text-4xl">Pastoral Vault</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Counseling notes, sermon drafts, and administrative logs. Visible only to pastoral roles within your church.
            </p>
          </div>
          <button
            onClick={() => setOpen(!open)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> New note
          </button>
        </div>

        {open && (
          <div className="mt-6 rounded-xl border border-border bg-card p-5 space-y-3">
            <input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="counseling">Counseling</option>
              <option value="sermon_draft">Sermon draft</option>
              <option value="admin">Administrative</option>
              <option value="general">General</option>
            </select>
            <textarea
              rows={6}
              placeholder="Confidential notes…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded-md border border-border px-3 py-1.5 text-sm">Cancel</button>
              <button onClick={add} disabled={!title} className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50">Save</button>
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-3">
          {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!q.isLoading && (q.data?.length ?? 0) === 0 && (
            <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              The vault is empty.
            </div>
          )}
          {q.data?.map((n: any) => (
            <div key={n.id} className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-primary">{n.category.replace("_", " ")}</p>
                  <h3 className="mt-1 font-display text-xl">{n.title}</h3>
                </div>
                <button onClick={() => remove(n.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {n.body && <p className="mt-3 text-sm whitespace-pre-wrap leading-relaxed">{n.body}</p>}
              <p className="mt-3 text-xs text-muted-foreground">
                {new Date(n.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
