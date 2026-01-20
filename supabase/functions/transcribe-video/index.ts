import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Social media hosts that need video extraction via Cobalt
const SOCIAL_MEDIA_HOSTS = [
  "instagram.com",
  "www.instagram.com",
  "tiktok.com",
  "www.tiktok.com",
  "vm.tiktok.com",
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
  "twitter.com",
  "x.com",
  "facebook.com",
  "www.facebook.com",
  "fb.watch",
  "vimeo.com",
  "www.vimeo.com",
];

// Fallback list (used if instance discovery fails)
const COBALT_BASE_URLS_FALLBACK = [
  "https://kityune.imput.net",
  "https://nachos.imput.net",
  "https://cobalt-api.meowing.de",
  "https://cobalt-backend.canine.tools",
];

let cobaltCache: { expiresAt: number; endpoints: string[] } | null = null;

function isSocialMediaUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return SOCIAL_MEDIA_HOSTS.some((host) => urlObj.hostname.includes(host));
  } catch {
    return false;
  }
}

async function getCobaltEndpoints(): Promise<string[]> {
  const now = Date.now();
  if (cobaltCache && cobaltCache.expiresAt > now) return cobaltCache.endpoints;

  try {
    const resp = await fetch("https://instances.cobalt.best/instances.json", {
      headers: {
        Accept: "application/json",
        "User-Agent": "LovableOCRBot/1.0",
      },
    });

    if (!resp.ok) {
      console.error("Cobalt instances list failed:", resp.status);
      throw new Error("instances list not ok");
    }

    const instances = await resp.json();
    const endpoints = (Array.isArray(instances) ? instances : [])
      .filter((i: any) => i?.online)
      .sort((a: any, b: any) => (b?.score ?? 0) - (a?.score ?? 0))
      .slice(0, 8)
      .map((i: any) => `${i.protocol ?? "https"}://${i.api}`)
      .filter((u: any) => typeof u === "string" && u.startsWith("http"));

    const finalEndpoints = endpoints.length ? endpoints : COBALT_BASE_URLS_FALLBACK;
    cobaltCache = { expiresAt: now + 10 * 60 * 1000, endpoints: finalEndpoints };
    return finalEndpoints;
  } catch (e) {
    console.error("Cobalt instances discovery error:", e);
    cobaltCache = { expiresAt: now + 2 * 60 * 1000, endpoints: COBALT_BASE_URLS_FALLBACK };
    return COBALT_BASE_URLS_FALLBACK;
  }
}

type CobaltExtractResult = { url: string | null; debug: string };

async function extractVideoWithCobalt(url: string): Promise<CobaltExtractResult> {
  console.log("Extracting video with Cobalt:", url);

  const baseUrls = await getCobaltEndpoints();
  const pathCandidates = ["/", "/api/json"]; // prefer modern, fallback legacy

  const payload = {
    url,
    videoQuality: "720",
    vQuality: "720",
    filenamePattern: "basic",
    filenameStyle: "basic",
    isAudioOnly: false,
  };

  const failures: string[] = [];

  for (const base of baseUrls) {
    for (const path of pathCandidates) {
      const endpoint = `${base}${path}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12_000);

      try {
        console.log("Trying Cobalt endpoint:", endpoint);

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "User-Agent": "LovableOCRBot/1.0",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!response.ok) {
          const body = (await response.text()).slice(0, 180);
          failures.push(`${endpoint} -> ${response.status} ${body}`);
          continue;
        }

        const data = await response.json();

        if (data?.status === "error") {
          failures.push(`${endpoint} -> cobalt_error ${data?.text ?? JSON.stringify(data).slice(0, 180)}`);
          continue;
        }

        if (data?.status === "stream" || data?.status === "redirect") {
          return { url: data?.url ?? null, debug: "ok" };
        }

        if (data?.status === "picker" && Array.isArray(data.picker) && data.picker.length > 0) {
          const videoOption = data.picker.find((p: any) => p.type === "video") || data.picker[0];
          return { url: videoOption?.url ?? null, debug: "ok" };
        }

        failures.push(`${endpoint} -> unknown_status ${JSON.stringify(data).slice(0, 180)}`);
      } catch (error) {
        failures.push(`${endpoint} -> exception ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  return {
    url: null,
    debug: failures.slice(0, 3).join("\n"),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoUrl } = await req.json();

    if (!videoUrl) {
      return new Response(JSON.stringify({ error: "URL видео обязателен" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Processing video URL:", videoUrl);

    // Validate URL format
    try {
      new URL(videoUrl);
    } catch {
      return new Response(JSON.stringify({ error: "Неверный формат URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let directVideoUrl = videoUrl;

    // If it's a social media URL, extract direct video link via Cobalt
    if (isSocialMediaUrl(videoUrl)) {
      console.log("Detected social media URL, extracting via Cobalt...");

      const extracted = await extractVideoWithCobalt(videoUrl);

      if (!extracted.url) {
        return new Response(
          JSON.stringify({
            error:
              "Не удалось извлечь видео из ссылки. Большинство публичных инстансов блокируются (Cloudflare/JWT). Попробуйте прямой URL на видеофайл или загрузку видео.",
            debug: extracted.debug,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      directVideoUrl = extracted.url;
      console.log("Extracted direct video URL:", directVideoUrl);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(JSON.stringify({ error: "AI сервис не настроен" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Sending video to Gemini for OCR...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: `Ты - профессиональный OCR-специалист. Твоя задача - извлечь ВЕСЬ ВИДИМЫЙ ТЕКСТ из видео.

Инструкции:
1. Просмотри видео кадр за кадром
2. Извлеки ВСЮ текстовую информацию, которая ОТОБРАЖАЕТСЯ на экране:
   - Субтитры / титры
   - Заголовки и надписи
   - Текст на плашках и баннерах
   - Текст в графике и инфографике
   - Любой другой текст на экране
3. НЕ транскрибируй речь — только видимый текст!
4. Сохраняй порядок появления текста
5. Разделяй блоки текста переносами строк
6. Если текст повторяется на нескольких кадрах, включи его только один раз
7. Если в видео нет видимого текста, напиши "В видео не обнаружено текста на экране"`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Извлеки весь видимый текст из этого видео. Только текст, который отображается на экране (субтитры, заголовки, надписи), без транскрипции речи.",
              },
              {
                type: "video_url",
                video_url: {
                  url: directVideoUrl,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Превышен лимит запросов. Попробуйте позже." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Требуется пополнение баланса AI." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Ошибка AI сервиса при обработке видео" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const transcription = data.choices?.[0]?.message?.content;

    if (!transcription) {
      return new Response(JSON.stringify({ error: "Не удалось получить текст из видео" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("OCR successful, text length:", transcription.length);

    return new Response(JSON.stringify({ transcription }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Transcription error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Неизвестная ошибка" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
