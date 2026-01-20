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

async function extractVideoWithCobalt(url: string): Promise<string | null> {
  console.log("Extracting video with Cobalt:", url);
  
  try {
    // Use Cobalt public API endpoint
    const response = await fetch("https://co.wuk.sh/api/json", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: url,
        vQuality: "720",
        filenamePattern: "basic",
        isAudioOnly: false,
      }),
    });

    if (!response.ok) {
      console.error("Cobalt API error:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    console.log("Cobalt response status:", data.status);

    // Cobalt returns different response formats
    if (data.status === "error") {
      console.error("Cobalt error:", data.text);
      return null;
    }

    // Handle stream/redirect response - direct video URL
    if (data.status === "stream" || data.status === "redirect") {
      console.log("Got direct URL from Cobalt");
      return data.url;
    }

    // Handle picker response (multiple options like video + audio)
    if (data.status === "picker" && data.picker?.length > 0) {
      console.log("Got picker with", data.picker.length, "options");
      // Find video option
      const videoOption = data.picker.find((p: any) => p.type === "video") || data.picker[0];
      return videoOption?.url;
    }

    console.error("Unknown Cobalt response:", JSON.stringify(data).slice(0, 200));
    return null;
  } catch (error) {
    console.error("Cobalt extraction error:", error);
    return null;
  }
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
