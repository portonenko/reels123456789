import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type IncomingSlide = {
  id?: string;
  title: string;
  body?: string;
  [k: string]: unknown;
};

const safeJsonExtract = (raw: string): any | null => {
  try {
    return JSON.parse(raw);
  } catch {
    // Try to extract the first JSON object/array from a larger string
    const objStart = raw.indexOf("{");
    const arrStart = raw.indexOf("[");
    const start =
      objStart === -1 ? arrStart : arrStart === -1 ? objStart : Math.min(objStart, arrStart);
    if (start === -1) return null;

    const candidate = raw.slice(start).trim();
    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { slides, targetLanguages, unusedText } = (await req.json()) as {
      slides: IncomingSlide[];
      targetLanguages: string[];
      unusedText?: string;
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const languageNames: Record<string, string> = {
      en: "English",
      de: "German",
      pl: "Polish",
      es: "Spanish",
      fr: "French",
      it: "Italian",
      pt: "Portuguese",
      uk: "Ukrainian",
      zh: "Chinese",
      ja: "Japanese",
    };

    // ENERGIA replacement rules per language
    const energiaReplacements: Record<string, string> = {
      en: "energy",
      de: "energie",
      pl: "Energia",
      es: "energía",
      fr: "énergie",
      it: "energia",
      pt: "energia",
      uk: "енергія",
      zh: "能量",
      ja: "エネルギー",
    };

    const applyEnergiaRule = (text: string, langCode: string): string => {
      const replacement = energiaReplacements[langCode];
      if (!replacement) return text;
      return text.replace(/ENERGIA/gi, replacement);
    };

    const callAi = async ({ langName, payload }: { langName: string; payload: unknown }) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25_000);
      try {
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content:
                  `You are a professional translator. Translate to ${langName}. ` +
                  "Return STRICT JSON only (no markdown, no explanations).",
              },
              { role: "user", content: JSON.stringify(payload) },
            ],
          }),
          signal: controller.signal,
        });

        if (!resp.ok) {
          if (resp.status === 429) {
            return { status: 429 as const, data: { error: "Rate limit exceeded. Please try again later." } };
          }
          if (resp.status === 402) {
            return {
              status: 402 as const,
              data: { error: "Payment required. Please add credits to your workspace." },
            };
          }
          const t = await resp.text();
          console.error("AI gateway error:", resp.status, t);
          throw new Error(`AI gateway error (${resp.status})`);
        }

        const data = await resp.json();
        const raw = (data?.choices?.[0]?.message?.content ?? "").trim();
        return { status: 200 as const, data: raw };
      } finally {
        clearTimeout(timeout);
      }
    };

    const translatedSlides: any[] = [];
    const translatedUnusedText: Record<string, string> = {};

    for (const langCode of targetLanguages ?? []) {
      const langName = languageNames[langCode] || langCode;

      // unused/caption text
      if (unusedText && unusedText.trim()) {
        console.log(`Translating unused text to ${langName}, length:`, unusedText.length);
        const res = await callAi({
          langName,
          payload: { text: unusedText },
        });

        if (res.status === 429 || res.status === 402) {
          return new Response(JSON.stringify(res.data), {
            status: res.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const parsed = safeJsonExtract(res.data as string);
        const txt = (parsed?.text ?? "").toString().trim();
        if (txt) translatedUnusedText[langCode] = applyEnergiaRule(txt, langCode);
      } else {
        console.log(`No unused text to translate for ${langName}`);
      }

      // slides - translate in ONE call per language (prevents timeouts / connection drops)
      const slidePayload = {
        slides: (slides ?? []).map((s) => ({
          title: s.title ?? "",
          body: s.body ?? "",
        })),
      };

      console.log(`Translating ${slidePayload.slides.length} slides to ${langName}`);

      const res = await callAi({ langName, payload: slidePayload });
      if (res.status === 429 || res.status === 402) {
        return new Response(JSON.stringify(res.data), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const parsed = safeJsonExtract(res.data as string);
      const outSlides: Array<{ title: string; body?: string }> = parsed?.slides;

      if (!Array.isArray(outSlides) || outSlides.length !== (slides?.length ?? 0)) {
        console.error("Invalid translation response:", res.data);
        throw new Error("Translation service returned invalid JSON");
      }

      for (let i = 0; i < outSlides.length; i++) {
        const original = slides[i];
        const t = outSlides[i];

        const title = applyEnergiaRule((t?.title ?? "").toString().trim(), langCode);
        const bodyRaw = (t?.body ?? "").toString();
        const body = bodyRaw.trim() ? applyEnergiaRule(bodyRaw.trim(), langCode) : undefined;

        translatedSlides.push({
          ...original,
          id: crypto.randomUUID(),
          title,
          body,
          language: langCode,
        });
      }
    }

    return new Response(
      JSON.stringify({
        translatedSlides,
        translatedUnusedText: Object.keys(translatedUnusedText).length ? translatedUnusedText : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Translation error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
