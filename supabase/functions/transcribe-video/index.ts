import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Validate URL
    try {
      new URL(videoUrl);
    } catch {
      return new Response(
        JSON.stringify({ error: "Неверный формат URL" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI сервис не настроен" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use Lovable AI with Gemini for video text extraction (OCR)
    // Gemini 2.5 Pro supports video input and can read text from frames
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
                  url: videoUrl,
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
        JSON.stringify({ error: "Не удалось получить транскрипцию" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Transcription successful, length:", transcription.length);

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
