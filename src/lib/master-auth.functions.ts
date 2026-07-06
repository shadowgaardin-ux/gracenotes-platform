import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Master password self-heal for the platform super admin.
 * If the provided email+password matches the configured master credentials,
 * we reset that user's Supabase password to the master password so a normal
 * signInWithPassword call from the client will succeed.
 *
 * Hardcoded to accept ONLY the configured master email — every other request
 * returns { ok: false } without touching anything.
 */
export const ensureMasterSuperAdmin = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ email: z.string().email(), password: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const masterEmail = process.env.MASTER_SUPER_ADMIN_EMAIL;
    const masterPassword = process.env.MASTER_SUPER_ADMIN_PASSWORD;
    if (!masterEmail || !masterPassword) return { ok: false as const };
    if (data.email.trim().toLowerCase() !== masterEmail.toLowerCase()) {
      return { ok: false as const };
    }
    if (data.password !== masterPassword) return { ok: false as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Look up user by email
    const { data: userLookup, error: lookupErr } =
      await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (lookupErr) throw lookupErr;
    const user = userLookup.users.find(
      (u) => (u.email ?? "").toLowerCase() === masterEmail.toLowerCase(),
    );
    if (!user) return { ok: false as const };

    // Reset password to master value (idempotent self-heal) and ensure confirmed.
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: masterPassword,
      email_confirm: true,
    });
    if (updateErr) throw updateErr;

    // Ensure super_admin role is granted.
    await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: user.id, role: "super_admin", organization_id: null },
        { onConflict: "user_id,organization_id,role" },
      );

    return { ok: true as const };
  });
