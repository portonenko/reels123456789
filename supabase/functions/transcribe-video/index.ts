import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Social media hosts that need video extraction via Cobalt
const SOCIAL_MEDIA_HOSTS = [
  'instagram.com', 'www.instagram.com',
  'tiktok.com', 'www.tiktok.com', 'vm.tiktok.com',
  'youtube.com', 'www.youtube.com', 'youtu.be',
  'twitter.com', 'x.com',
  'facebook.com', 'www.facebook.com', 'fb.watch',
  'vimeo.com', 'www.vimeo.com',
];

// Fallback list (used if instance discovery fails)
const COBALT_BASE_URLS_FALLBACK = [
  "https://kityune.imput.net",
  "https://nachos.imput.net",
  "https://cobalt-api.meowing.de",
  "https://cobalt-backend.canine.tools",
  "https://capi.3kh0.net",
];

let cobaltCache:
  | { expiresAt: number; endpoints: string[] }
  | null = null;

async function getCobaltEndpoints(): Promise<string[]> {
  // cache for 10 minutes to reduce latency
  const now = Date.now();
  if (cobaltCache && cobaltCache.expiresAt > now) return cobaltCache.endpoints;

  try {
    const resp = await fetch("https://instances.cobalt.best/instances.json", {
      headers: {
        Accept: "application/json",
        // required by the tracker
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
      .map((i: any) => `${i.protocol ?? "https"}://${i.api}`);

    const finalEndpoints = endpoints.length ? endpoints : COBALT_BASE_URLS_FALLBACK;
    cobaltCache = { expiresAt: now + 10 * 60 * 1000, endpoints: finalEndpoints };
    return finalEndpoints;
  } catch (e) {
    console.error("Cobalt instances discovery error:", e);
    cobaltCache = { expiresAt: now + 2 * 60 * 1000, endpoints: COBALT_BASE_URLS_FALLBACK };
    return COBALT_BASE_URLS_FALLBACK;
  }
}

  for (const base of COBALT_BASE_URLS) {
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
          console.error("Cobalt endpoint error:", endpoint, response.status, await response.text());
          continue;
        }

        const data = await response.json();
        console.log("Cobalt response status:", data.status);

        if (data.status === "error") {
          console.error("Cobalt error:", endpoint, data.text ?? JSON.stringify(data).slice(0, 200));
          continue;
        }

        if (data.status === "stream" || data.status === "redirect") {
          return data.url ?? null;
        }

        if (data.status === "picker" && Array.isArray(data.picker) && data.picker.length > 0) {
          const videoOption = data.picker.find((p: any) => p.type === "video") || data.picker[0];
          return videoOption?.url ?? null;
        }

        console.error("Unknown Cobalt response:", endpoint, JSON.stringify(data).slice(0, 200));
      } catch (error) {
        console.error("Cobalt endpoint failed:", endpoint, error);
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  return null;
}

function isSocialMediaUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return SOCIAL_MEDIA_HOSTS.some(host => urlObj.hostname.includes(host));
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoUrl } = await req.json();

    if (!videoUrl) {
      return new Response(
        JSON.stringify({ error: "URL видео обязателен" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing video URL:", videoUrl);

    // Validate URL format
    try {
      new URL(videoUrl);
    } catch {
      return new Response(
        JSON.stringify({ error: "Неверный формат URL" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let directVideoUrl = videoUrl;

    // If it's a social media URL, extract direct video link via Cobalt
    if (isSocialMediaUrl(videoUrl)) {
      console.log("Detected social media URL, extracting via Cobalt...");
      
      const extractedUrl = await extractVideoWithCobalt(videoUrl);
      
      if (!extractedUrl) {
        return new Response(
          JSON.stringify({ 
            error: "Не удалось извлечь видео из ссылки. Попробуйте другую ссылку или прямой URL на видеофайл." 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      directVideoUrl = extractedUrl;
      console.log("Extracted direct video URL:", directVideoUrl);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI сервис не настроен" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Sending video to Gemini for OCR...");

    // Use Lovable AI with Gemini for video text extraction (OCR)
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
                text: "Извлеки весь видимый текст из этого видео. Только текст, который отображается на экране (субтитры, заголовки, надписи), без транскрипции речи.",
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
        return new Response(
          JSON.stringify({ error: "Превышен лимит запросов. Попробуйте позже." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Требуется пополнение баланса AI." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Ошибка AI сервиса при обработке видео" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const transcription = data.choices?.[0]?.message?.content;

    if (!transcription) {
      return new Response(
        JSON.stringify({ error: "Не удалось получить текст из видео" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("OCR successful, text length:", transcription.length);

    return new Response(
      JSON.stringify({ transcription }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Transcription error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Неизвестная ошибка" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
