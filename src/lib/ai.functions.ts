import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

async function callGateway(messages: Array<{ role: string; content: string }>, jsonMode = false) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI gateway not configured");

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (res.status === 429) throw new Error("AI rate limit reached. Try again shortly.");
  if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
  if (!res.ok) throw new Error(`AI error ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content ?? "";
}

const ContentInput = z.object({
  sermonId: z.string().uuid(),
  transcript: z.string().min(20),
  title: z.string(),
});

export const generateSermonContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ContentInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify sermon belongs to user's org (RLS will also enforce on insert)
    const { data: sermon, error: sErr } = await supabase
      .from("sermons")
      .select("id, organization_id")
      .eq("id", data.sermonId)
      .maybeSingle();
    if (sErr || !sermon) throw new Error("Sermon not found");

    const prompt = `You are a content multiplier for a church. From this sermon transcript titled "${data.title}", produce JSON with these exact keys:
{
  "summary": "2-3 sentence pastoral summary",
  "social_x": "a single tweet under 280 chars, reverent, includes a hook",
  "social_instagram": "instagram caption 100-200 words with line breaks and a closing CTA",
  "social_facebook": "facebook post 150-250 words inviting reflection",
  "discussion_guide": "3-5 numbered small-group discussion questions",
  "bulletin": "a 120 word bulletin paragraph",
  "newsletter": "a 200 word newsletter summary",
  "scripture_refs": ["Book C:V", ...]   // every scripture reference cited (e.g. "John 3:16", "Romans 8:28-30")
}
Return ONLY valid JSON. Transcript:\n\n${data.transcript.slice(0, 12000)}`;

    const raw = await callGateway(
      [{ role: "user", content: prompt }],
      true,
    );

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("AI returned malformed content");
      parsed = JSON.parse(m[0]);
    }

    const orgId = sermon.organization_id;
    const kinds: Array<[string, string]> = [
      ["social_x", parsed.social_x],
      ["social_instagram", parsed.social_instagram],
      ["social_facebook", parsed.social_facebook],
      ["discussion_guide", parsed.discussion_guide],
      ["bulletin", parsed.bulletin],
      ["newsletter", parsed.newsletter],
    ];

    // Replace existing
    await supabase.from("sermon_content").delete().eq("sermon_id", data.sermonId);
    await supabase.from("scripture_refs").delete().eq("sermon_id", data.sermonId);

    await supabase.from("sermon_content").insert(
      kinds
        .filter(([, v]) => typeof v === "string" && v.length)
        .map(([kind, content]) => ({
          sermon_id: data.sermonId,
          organization_id: orgId,
          kind,
          content,
        })),
    );

    const refs: string[] = Array.isArray(parsed.scripture_refs) ? parsed.scripture_refs : [];
    if (refs.length) {
      await supabase.from("scripture_refs").insert(
        refs.map((reference) => {
          const m = reference.match(/^([\w\s]+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/);
          return {
            sermon_id: data.sermonId,
            organization_id: orgId,
            reference,
            book: m?.[1]?.trim() ?? null,
            chapter: m?.[2] ? parseInt(m[2]) : null,
            verse_start: m?.[3] ? parseInt(m[3]) : null,
            verse_end: m?.[4] ? parseInt(m[4]) : null,
          };
        }),
      );
    }

    if (parsed.summary) {
      await supabase.from("sermons").update({ summary: parsed.summary }).eq("id", data.sermonId);
    }

    void userId;
    return { ok: true };
  });
