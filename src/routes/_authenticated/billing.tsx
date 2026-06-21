import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Upload, KeyRound, Clock, CheckCircle2, Copy, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({ meta: [{ title: "Workspace — GraceNotes" }] }),
  component: BillingPage,
});

function BillingPage() {
  const navigate = useNavigate();
  const { org, isOrgAdmin, isPastoral, loading } = useCurrentUser();
  const [file, setFile] = useState<File | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [activeCode, setActiveCode] = useState<{ code: string; expires_at: string | null } | null>(null);

  useEffect(() => {
    if (!org) return;
    if (org.status === "active" && isPastoral) {
      // Fetch current active code
      void (async () => {
        const { data } = await supabase
          .from("access_codes")
          .select("code, expires_at")
          .eq("organization_id", org.id)
          .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
          .eq("role", "congregation")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) setActiveCode(data as any);
      })();
    }
  }, [org, isPastoral]);

  async function submitReceipt() {
    if (!file || !org) return;
    if (!isOrgAdmin && !isPastoral) {
      toast.error("Only your organization's admin can submit a receipt.");
      return;
    }
    setUploading(true);
    try {
      const path = `${org.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("receipts").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upErr) throw upErr;
      const amt = amount ? Math.round(parseFloat(amount) * 100) : null;
      const { error: rpcErr } = await supabase.rpc("submit_payment_receipt" as any, {
        _file_path: path,
        _file_mime: file.type,
        _amount_cents: amt,
        _note: note || null,
      });
      if (rpcErr) throw rpcErr;
      toast.success("Receipt submitted. We'll activate your workspace shortly.");
      setFile(null);
      setAmount("");
      setNote("");
      // refresh
      setTimeout(() => window.location.reload(), 500);
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (loading || !org) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading…</div>
      </div>
    );
  }

  // Members (non-admins) see a soft holding screen
  if (!isOrgAdmin && !isPastoral && org.status !== "active") {
    return (
      <CenteredCard>
        <Clock className="h-8 w-8 mx-auto text-primary" />
        <h1 className="mt-4 font-display text-3xl">Workspace being set up</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {org.name} is finalizing setup. Your administrator will let you know when the workspace is ready.
        </p>
      </CenteredCard>
    );
  }

  // Active — show access code
  if (org.status === "active") {
    return (
      <CenteredCard>
        <CheckCircle2 className="h-8 w-8 mx-auto text-primary" />
        <h1 className="mt-4 font-display text-3xl">{org.name} is active</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Share this access code with members so they can join your workspace.
        </p>
        {activeCode ? (
          <div className="mt-6 rounded-md border-2 border-dashed border-[color:var(--color-gold)] bg-background p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground flex items-center justify-center gap-1.5">
              <KeyRound className="h-3 w-3" /> Access code
            </p>
            <p className="font-mono text-2xl tracking-wider mt-2">{activeCode.code}</p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(activeCode.code);
                toast.success("Code copied");
              }}
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Copy className="h-3 w-3" /> Copy
            </button>
            {activeCode.expires_at && (
              <p className="mt-3 text-xs text-muted-foreground">
                Expires {new Date(activeCode.expires_at).toLocaleDateString()}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">No active code yet.</p>
        )}
        <button
          onClick={() => navigate({ to: "/dashboard" })}
          className="mt-6 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Enter workspace
        </button>
      </CenteredCard>
    );
  }

  if (org.status === "pending_review") {
    return (
      <CenteredCard>
        <Clock className="h-8 w-8 mx-auto text-primary" />
        <h1 className="mt-4 font-display text-3xl">Receipt under review</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          We've received your payment receipt for {org.name}. Your workspace will be activated as soon as it's verified — usually within one business day.
        </p>
      </CenteredCard>
    );
  }

  // pending_payment / expired / suspended
  const renewing = org.status === "expired";
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-8">
        <div className="text-center">
          {renewing ? (
            <AlertCircle className="h-8 w-8 mx-auto text-primary" />
          ) : (
            <Upload className="h-8 w-8 mx-auto text-primary" />
          )}
          <h1 className="mt-4 font-display text-3xl">
            {renewing ? "Renew your workspace" : "Activate your workspace"}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Submit a payment receipt to {renewing ? "renew" : "activate"} {org.name}'s workspace.
          </p>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium">Receipt file (image or PDF)</label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-2 w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:px-3 file:py-2 file:text-sm file:font-medium file:cursor-pointer"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Amount paid (optional)</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            disabled={!file || uploading}
            onClick={submitReceipt}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Submit receipt"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center">
        {children}
      </div>
    </div>
  );
}
