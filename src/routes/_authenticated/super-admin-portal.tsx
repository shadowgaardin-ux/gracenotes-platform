import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/super-admin-portal")({
  head: () => ({ meta: [{ title: "GraceNotes" }] }),
  component: SuperPortal,
});

type Tab = "orgs" | "approvals" | "inquiries" | "codes";

function SuperPortal() {
  const { isSuperAdmin, loading } = useCurrentUser();
  const [tab, setTab] = useState<Tab>("approvals");

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!isSuperAdmin) {
    // 404 — no hint this exists
    throw notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between">
          <h1 className="font-display text-2xl">Operations</h1>
          <span className="text-xs text-muted-foreground">Internal</span>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="flex gap-1 rounded-md bg-muted p-1 w-fit">
          {([
            ["approvals", "Pending Approvals"],
            ["orgs", "Organizations"],
            ["inquiries", "Inquiries"],
            ["codes", "Access Codes"],
          ] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded px-3 py-1.5 text-sm font-medium ${tab === t ? "bg-card shadow-sm" : "text-muted-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-6">
          {tab === "approvals" && <PendingApprovals />}
          {tab === "orgs" && <Organizations />}
          {tab === "inquiries" && <Inquiries />}
          {tab === "codes" && <AccessCodes />}
        </div>
      </div>
    </div>
  );
}

function PendingApprovals() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("payment_receipts")
      .select("id, organization_id, file_path, file_mime, amount_cents, note, status, created_at, organizations(name, subscription_price_cents, subscription_period_days, subscription_currency)")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setRows(data ?? []);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function viewFile(path: string) {
    const { data } = await supabase.storage.from("receipts").createSignedUrl(path, 600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function approve(row: any) {
    const days = prompt("Subscription period in days?", String(row.organizations?.subscription_period_days ?? 30));
    if (!days) return;
    const price = prompt("Price (cents)?", String(row.organizations?.subscription_price_cents ?? row.amount_cents ?? 0));
    const { data, error } = await supabase.rpc("approve_receipt_and_activate" as any, {
      _receipt_id: row.id,
      _period_days: parseInt(days, 10),
      _price_cents: price ? parseInt(price, 10) : null,
    });
    if (error) { toast.error(error.message); return; }
    const code = (data as any)?.[0]?.access_code;
    toast.success(`Approved. Access code: ${code}`);
    void load();
  }

  async function reject(row: any) {
    const reason = prompt("Rejection reason?");
    if (!reason) return;
    const { error } = await supabase.rpc("reject_receipt" as any, { _receipt_id: row.id, _reason: reason });
    if (error) { toast.error(error.message); return; }
    toast.success("Rejected");
    void load();
  }

  if (loading) return <div className="text-muted-foreground text-sm">Loading…</div>;
  if (!rows.length) return <div className="text-muted-foreground text-sm">No pending receipts.</div>;

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.id} className="rounded-lg border border-border bg-card p-4">
          <div className="flex justify-between gap-4 flex-wrap">
            <div>
              <div className="font-medium">{r.organizations?.name ?? "—"}</div>
              <div className="text-xs text-muted-foreground mt-1">
                Submitted {new Date(r.created_at).toLocaleString()}
                {r.amount_cents != null && <> · Stated amount: {(r.amount_cents / 100).toFixed(2)}</>}
                {r.organizations?.subscription_price_cents != null && (
                  <> · Agreed price: {(r.organizations.subscription_price_cents / 100).toFixed(2)} {r.organizations.subscription_currency ?? ""}</>
                )}
              </div>
              {r.note && <div className="text-sm mt-2">{r.note}</div>}
            </div>
            <div className="flex gap-2 items-start">
              <button onClick={() => viewFile(r.file_path)} className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent">View receipt</button>
              <button onClick={() => approve(r)} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90">Approve & generate code</button>
              <button onClick={() => reject(r)} className="rounded-md border border-destructive text-destructive px-3 py-1.5 text-sm hover:bg-destructive/10">Reject</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Organizations() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [price, setPrice] = useState("");
  const [days, setDays] = useState("30");

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("organizations")
      .select("id, name, status, subscription_price_cents, subscription_currency, subscription_period_days, subscription_expires_at, created_at")
      .order("created_at", { ascending: false });
    setRows(data ?? []);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function create() {
    if (!name) return;
    const { error } = await supabase.rpc("super_create_organization" as any, {
      _name: name,
      _admin_email: email,
      _price_cents: price ? Math.round(parseFloat(price) * 100) : null,
      _period_days: parseInt(days, 10),
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Organization created");
    setShowNew(false); setName(""); setEmail(""); setPrice(""); setDays("30");
    void load();
  }

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("organizations").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Updated");
    void load();
  }

  return (
    <div>
      <div className="flex justify-between mb-4">
        <div className="text-sm text-muted-foreground">{rows.length} organizations</div>
        <button onClick={() => setShowNew(!showNew)} className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm">
          {showNew ? "Cancel" : "+ New organization"}
        </button>
      </div>
      {showNew && (
        <div className="rounded-lg border border-border bg-card p-4 mb-4 grid sm:grid-cols-2 gap-3">
          <input placeholder="Organization name" value={name} onChange={e=>setName(e.target.value)} className="rounded-md border border-input px-3 py-2 text-sm bg-background" />
          <input placeholder="Admin email (must already have an account)" value={email} onChange={e=>setEmail(e.target.value)} className="rounded-md border border-input px-3 py-2 text-sm bg-background" />
          <input placeholder="Price (e.g. 49.00)" value={price} onChange={e=>setPrice(e.target.value)} className="rounded-md border border-input px-3 py-2 text-sm bg-background" />
          <input placeholder="Period (days)" value={days} onChange={e=>setDays(e.target.value)} className="rounded-md border border-input px-3 py-2 text-sm bg-background" />
          <button onClick={create} className="sm:col-span-2 rounded-md bg-primary text-primary-foreground py-2 text-sm">Create</button>
        </div>
      )}
      {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : (
        <div className="space-y-2">
          {rows.map((o) => (
            <div key={o.id} className="rounded-lg border border-border bg-card p-4 flex justify-between flex-wrap gap-3">
              <div>
                <div className="font-medium">{o.name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Status: <span className="font-mono">{o.status}</span>
                  {o.subscription_price_cents != null && <> · {(o.subscription_price_cents/100).toFixed(2)} {o.subscription_currency} / {o.subscription_period_days}d</>}
                  {o.subscription_expires_at && <> · expires {new Date(o.subscription_expires_at).toLocaleDateString()}</>}
                </div>
              </div>
              <div className="flex gap-2">
                {o.status === "active" && <button onClick={()=>setStatus(o.id,"suspended")} className="text-xs border rounded px-2 py-1">Suspend</button>}
                {o.status === "suspended" && <button onClick={()=>setStatus(o.id,"active")} className="text-xs border rounded px-2 py-1">Reactivate</button>}
                {o.status === "expired" && <button onClick={()=>setStatus(o.id,"pending_payment")} className="text-xs border rounded px-2 py-1">Reset to pending</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Inquiries() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("organization_inquiries").select("*").order("created_at", { ascending: false });
      setRows(data ?? []);
    })();
  }, []);
  async function updateStatus(id: string, status: string) {
    await supabase.from("organization_inquiries").update({ status }).eq("id", id);
    setRows(r => r.map(x => x.id === id ? { ...x, status } : x));
  }
  if (!rows.length) return <div className="text-sm text-muted-foreground">No inquiries.</div>;
  return (
    <div className="space-y-3">
      {rows.map((i) => (
        <div key={i.id} className="rounded-lg border border-border bg-card p-4">
          <div className="flex justify-between gap-4 flex-wrap">
            <div>
              <div className="font-medium">{i.organization_name}</div>
              <div className="text-sm">{i.contact_name} · <a href={`mailto:${i.email}`} className="text-primary underline">{i.email}</a></div>
              {i.size && <div className="text-xs text-muted-foreground mt-1">Size: {i.size}</div>}
              {i.message && <div className="text-sm mt-2">{i.message}</div>}
              <div className="text-xs text-muted-foreground mt-2">{new Date(i.created_at).toLocaleString()} · <span className="font-mono">{i.status}</span></div>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>updateStatus(i.id,"contacted")} className="text-xs border rounded px-2 py-1">Mark contacted</button>
              <button onClick={()=>updateStatus(i.id,"converted")} className="text-xs border rounded px-2 py-1">Converted</button>
              <button onClick={()=>updateStatus(i.id,"closed")} className="text-xs border rounded px-2 py-1">Close</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AccessCodes() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("access_codes")
        .select("id, code, role, organization_id, expires_at, uses, max_uses, created_at, organizations(name)")
        .order("created_at", { ascending: false });
      setRows(data ?? []);
    })();
  }, []);
  async function revoke(id: string) {
    if (!confirm("Revoke this code?")) return;
    await supabase.from("access_codes").update({ expires_at: new Date().toISOString() }).eq("id", id);
    setRows(r => r.map(x => x.id === id ? { ...x, expires_at: new Date().toISOString() } : x));
    toast.success("Revoked");
  }
  return (
    <div className="space-y-2">
      {rows.map((c) => {
        const expired = c.expires_at && new Date(c.expires_at) < new Date();
        return (
          <div key={c.id} className="rounded-lg border border-border bg-card p-3 flex justify-between flex-wrap gap-3">
            <div>
              <div className="font-mono text-sm">{c.code}</div>
              <div className="text-xs text-muted-foreground">
                {c.organizations?.name} · {c.role} · uses {c.uses}{c.max_uses ? `/${c.max_uses}` : ""}
                {c.expires_at && <> · {expired ? "expired" : "expires"} {new Date(c.expires_at).toLocaleDateString()}</>}
              </div>
            </div>
            {!expired && <button onClick={()=>revoke(c.id)} className="text-xs border rounded px-2 py-1">Revoke</button>}
          </div>
        );
      })}
    </div>
  );
}
