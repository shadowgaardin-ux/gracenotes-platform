import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — GraceNotes" }] }),
  component: Settings,
});

function randomCode() {
  return "GN-" + Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function Settings() {
  const { profile, roles, orgName } = useCurrentUser();
  const qc = useQueryClient();
  const isAdmin = roles.includes("admin");
  const [role, setRole] = useState<"pastor" | "staff" | "congregation">("congregation");

  const codesQ = useQuery({
    queryKey: ["access-codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("access_codes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAdmin,
  });

  async function createCode() {
    if (!profile?.organization_id) return;
    const { error } = await supabase.from("access_codes").insert({
      organization_id: profile.organization_id,
      code: randomCode(),
      role,
    });
    if (error) return toast.error(error.message);
    toast.success("Code created");
    qc.invalidateQueries({ queryKey: ["access-codes"] });
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this code?")) return;
    const { error } = await supabase.from("access_codes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["access-codes"] });
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="p-10 text-sm text-muted-foreground">Admins only.</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="px-6 md:px-10 py-10 max-w-4xl">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Administration</p>
        <h1 className="mt-1 font-display text-4xl">{orgName ?? "Settings"}</h1>

        <section className="mt-10">
          <h2 className="font-display text-2xl">Access codes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Share codes to invite pastors, staff, and the congregation. Each code grants the role you choose at creation.
          </p>

          <div className="mt-4 flex flex-wrap gap-2 items-center">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="pastor">Pastor</option>
              <option value="staff">Staff</option>
              <option value="congregation">Congregation</option>
            </select>
            <button
              onClick={createCode}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Create code
            </button>
          </div>

          <div className="mt-6 rounded-xl border border-border bg-card divide-y divide-border">
            {(codesQ.data?.length ?? 0) === 0 && (
              <div className="p-6 text-sm text-muted-foreground">No codes yet.</div>
            )}
            {codesQ.data?.map((c: any) => (
              <div key={c.id} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-sm tracking-wider">{c.code}</p>
                  <p className="mt-1 text-xs text-muted-foreground capitalize">
                    {c.role} · {c.uses} {c.uses === 1 ? "redemption" : "redemptions"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { navigator.clipboard.writeText(c.code); toast.success("Copied"); }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </button>
                  <button
                    onClick={() => revoke(c.id)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-destructive hover:text-destructive-foreground"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
