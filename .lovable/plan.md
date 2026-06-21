# Super Admin + Receipt Activation + Access Code Lifecycle

A complete white-label workflow: you (hidden super admin) create organizations and set custom pricing, org admins upload receipts to activate, and access codes expire with the subscription.

## 1. Database changes (one migration)

**New role**: add `super_admin` to the `app_role` enum. Only you will hold it.

**`organizations`** — add columns:
- `status` text — `pending_payment` | `pending_review` | `active` | `expired` | `suspended` (default `pending_payment`)
- `subscription_price_cents` int
- `subscription_currency` text (default `USD`)
- `subscription_period_days` int (e.g. 30, 365)
- `subscription_started_at` timestamptz
- `subscription_expires_at` timestamptz
- `notes` text (internal super-admin notes)

**`payment_receipts`** — new table:
- `organization_id`, `uploaded_by` (user id), `file_path` (storage), `file_mime`, `amount_cents`, `note`, `status` (`pending`|`approved`|`rejected`), `reviewed_at`, `rejection_reason`

**`access_codes`** — already exists. Add:
- `subscription_cycle_id` uuid (links code to a specific paid cycle so renewal rotates codes)
- Update `redeem_access_code` to also reject codes when `organizations.status != 'active'` or `subscription_expires_at < now()`.

**Storage bucket**: private `receipts` bucket. RLS: org admins can upload/read their own org's receipts; super admin can read all.

**RLS / security-definer functions**:
- `is_super_admin(uid)` — stable, security definer
- `submit_payment_receipt(file_path, amount, note)` — org admin only, sets org `status = 'pending_review'`
- `approve_receipt_and_activate(receipt_id, period_days, price_cents)` — super admin only; marks receipt approved, sets org active, sets `subscription_started_at = now()` and `subscription_expires_at = now() + period`, generates a fresh access code, expires prior codes for that org
- `reject_receipt(receipt_id, reason)` — super admin only
- `create_organization_for_client(name, admin_email, price_cents, period_days)` — super admin only; creates org in `pending_payment`, sends/links the admin
- Scheduled check (or on-read check) flips org to `expired` when `now() > subscription_expires_at`

## 2. Bootstrapping the super admin (you)

One-time: a migration inserts a `super_admin` row in `user_roles` for your auth user id. I'll ask you for your email; the migration looks up the id from `auth.users` by email and grants the role. No UI exposes this role.

## 3. Routes & UI

**Public / marketing changes**
- Landing page: replace any pricing copy with a "Request Access for Your Organization" CTA → opens an inquiry form (name, org name, email, size, message). Stored in a new `organization_inquiries` table. No prices anywhere.

**Org-admin experience (white-labeled, no mention of a super admin)**
- `/_authenticated/billing` — appears automatically when their org status is `pending_payment`, `pending_review`, or `expired`. Shows:
  - `pending_payment`: "Submit payment receipt to activate your organization's workspace." Upload widget (image/PDF), amount, optional note.
  - `pending_review`: "Your receipt is being processed. We'll notify you once your workspace is active."
  - `expired`: same as pending_payment, framed as renewal.
  - `active`: shows the org's current access code, expiry date, and a "Copy code" button. Org admins share this with members.
- App shell: when org status is not `active`, redirect non-billing routes to `/billing` and hide normal nav. Members (non-admins) see "Your organization's workspace is being set up" with no upload UI.

**Hidden super-admin portal** at `/super-admin-portal` (also `/_authenticated/_super/...` subtree)
- Route guard: `beforeLoad` calls a server fn that checks `has_role(uid, 'super_admin')`; on false, `throw notFound()` (so it 404s — no hint it exists).
- Never linked from anywhere. Not in nav. Not referenced in any user-visible string.
- Tabs:
  1. **Organizations** — list all orgs with status, price, expiry, active codes. Create new org (name, admin email, price, period). Edit price/period. Suspend/reactivate.
  2. **Pending Approvals** — receipts with status `pending`, with org name, agreed price, uploaded amount, file preview. Buttons: **Approve & Generate Access Code** (prompts for period if not preset), **Reject** (with reason).
  3. **Inquiries** — submissions from the public form; mark as contacted / converted.
  4. **Access Codes** — view/revoke/extend any code.

## 4. Access code lifecycle

- One active code per org per cycle. Approval rotates: previous codes for that org get `expires_at = now()`.
- `expires_at` on the code mirrors `organizations.subscription_expires_at`.
- `redeem_access_code` already checks expiry; we extend it to also require `org.status = 'active'`.
- When the org expires, the code stops working and the admin sees the renewal flow on next login. Already-onboarded members keep their accounts but the app gates them behind a "Workspace inactive — your administrator has been notified" screen.

## 5. Technical notes

- Server fns (`createServerFn` + `requireSupabaseAuth`) for: submit receipt, approve, reject, create org, list pending (super-admin only). Each privileged fn re-checks `has_role(..., 'super_admin')` server-side — never trust the client.
- Storage: private `receipts` bucket; uploads via signed URL from a server fn; super-admin views via signed URL too.
- Edge case: status flip to `expired` is computed in a security-definer fn called on each `/billing` and `/dashboard` load (cheap), so we don't need cron.
- Generated types regenerate after the migration; UI code lands in a follow-up edit.

## What I need from you before I start

1. The **email address** of the auth account that should become super admin (so the migration can grant the role).
2. Confirm the **inquiry form** should email you, or just collect in-app (visible only in the super-admin Inquiries tab). Email requires a Resend-style secret; in-app is zero-config.
3. Default **subscription period** to prefill on the approve dialog (e.g. 30 days, 365 days)?
