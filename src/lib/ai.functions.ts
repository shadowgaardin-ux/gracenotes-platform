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
    const { supabase } = context;

    const { data: sermon, error: sErr } = await supabase
      .from("sermons")
      .select("id, organization_id, author_id")
      .eq("id", data.sermonId)
      .maybeSingle();
    if (sErr || !sermon) throw new Error("Sermon not found");

    const prompt = `You are a study companion analyzing a sermon titled "${data.title}". Produce JSON with EXACTLY these keys — every list item must be a single tight bullet (one sentence, no markdown bullets/dashes):

  "primary_topic": "ONE short topic tag capturing the main theme (e.g. Faith, Forgiveness, Hope, Prayer, Grace, Suffering, Identity, Marriage, Stewardship). Title-case, single word or short phrase.",

{
  "summary": "2-3 sentence pastoral summary",
  "core_theology": ["3-6 bullets naming the central theological claims"],
  "action_steps": ["3-6 bullets of concrete, do-this-week applications"],
  "visual_metaphors": ["2-5 bullets of memorable images, illustrations, or stories the speaker used"],
  "scripture_refs": ["every scripture cited as 'Book C:V' or 'Book C:V-V'"],
  "social_x": "single tweet under 280 chars, reverent, with a hook",
  "social_instagram": "instagram caption 100-200 words with line breaks and a closing CTA",
  "social_facebook": "facebook post 150-250 words inviting reflection",
  "discussion_guide": "3-5 numbered small-group discussion questions",
  "bulletin": "120 word bulletin paragraph",
  "newsletter": "200 word newsletter summary"
}

Return ONLY valid JSON. Transcript:\n\n${data.transcript.slice(0, 12000)}`;

    const raw = await callGateway([{ role: "user", content: prompt }], true);

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("AI returned malformed content");
      parsed = JSON.parse(m[0]);
    }

    const orgId = sermon.organization_id;

    await supabase.from("sermon_content").delete().eq("sermon_id", data.sermonId);
    await supabase.from("scripture_refs").delete().eq("sermon_id", data.sermonId);

    const notebook = {
      core_theology: Array.isArray(parsed.core_theology) ? parsed.core_theology : [],
      action_steps: Array.isArray(parsed.action_steps) ? parsed.action_steps : [],
      visual_metaphors: Array.isArray(parsed.visual_metaphors) ? parsed.visual_metaphors : [],
    };

    const rows: Array<{ sermon_id: string; organization_id: string; kind: string; content: string }> = [
      { sermon_id: data.sermonId, organization_id: orgId, kind: "notebook", content: JSON.stringify(notebook) },
    ];
    for (const k of ["social_x", "social_instagram", "social_facebook", "discussion_guide", "bulletin", "newsletter"]) {
      if (typeof parsed[k] === "string" && parsed[k].length) {
        rows.push({ sermon_id: data.sermonId, organization_id: orgId, kind: k, content: parsed[k] });
      }
    }
    await supabase.from("sermon_content").insert(rows);

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

    return { ok: true };
  });

const ChatInput = z.object({
  sermonId: z.string().uuid(),
  question: z.string().min(1).max(2000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .max(20)
    .optional(),
});

export const chatWithSermon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ChatInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: sermon, error } = await supabase
      .from("sermons")
      .select("title, transcript, summary, scripture_focus")
      .eq("id", data.sermonId)
      .maybeSingle();
    if (error || !sermon) throw new Error("Sermon not found");
    if (!sermon.transcript) throw new Error("This sermon has no transcript to discuss yet.");

    const system = `You are a thoughtful study companion grounded ONLY in the provided sermon. If the answer is not in the transcript, say so plainly. Cite the speaker's own phrasing when helpful. Keep answers tight and bullet-friendly.

SERMON TITLE: ${sermon.title}
SCRIPTURE FOCUS: ${sermon.scripture_focus ?? "—"}
SUMMARY: ${sermon.summary ?? "—"}

TRANSCRIPT:
${(sermon.transcript ?? "").slice(0, 14000)}`;

    const messages = [
      { role: "system", content: system },
      ...(data.history ?? []),
      { role: "user", content: data.question },
    ];
    const answer = await callGateway(messages);
    return { answer };
  });

// ---------- Audio transcription ----------
const TranscribeInput = z.object({
  audioBase64: z.string().min(20),
  format: z.enum(["webm", "mp3", "wav", "m4a", "ogg", "aac", "flac"]),
});

export const transcribeAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TranscribeInput.parse(d))
  .handler(async ({ data }) => {
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
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Transcribe this sermon audio verbatim into clear paragraphs. Preserve scripture references exactly as spoken. Return only the transcript text — no headings, no commentary.",
              },
              {
                type: "input_audio",
                input_audio: { data: data.audioBase64, format: data.format },
              },
            ],
          },
        ],
      }),
    });
    if (res.status === 429) throw new Error("AI rate limit reached. Try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
    if (!res.ok) throw new Error(`Transcription failed (${res.status}): ${await res.text()}`);
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const transcript = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!transcript) throw new Error("No transcript returned");
    return { transcript };
  });
