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
    const { slides, targetLanguages, unusedText } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

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

    const translatedResults = [];
    const translatedUnusedText: Record<string, string> = {};

    for (const langCode of targetLanguages) {
      const langName = languageNames[langCode];
      
      // Translate unused text if provided
      if (unusedText && unusedText.trim()) {
        const unusedPrompt = `Translate the following text to ${langName}. Keep the same structure and formatting.

${unusedText}`;

        const unusedResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
                content: "You are a professional translator. Translate text accurately while preserving meaning, tone, and formatting.",
              },
              { role: "user", content: unusedPrompt },
            ],
          }),
        });

        if (unusedResponse.ok) {
          const unusedData = await unusedResponse.json();
          translatedUnusedText[langCode] = unusedData.choices[0].message.content.trim();
        }
      }
      
      for (const slide of slides) {
        const prompt = `Translate the following text to ${langName}. 

IMPORTANT: Return ONLY the translated text without any labels, prefixes, or formatting. Do not include words like "Title:", "Text:", "Titel:", "Texto:", etc.

Original text to translate:
${slide.title}
${slide.body || ""}`;

        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
                content: "You are a professional translator. Translate text accurately while preserving meaning and tone. Return ONLY the translated text without any labels, metadata, or formatting markers.",
              },
              { role: "user", content: prompt },
            ],
          }),
        });

        if (!response.ok) {
          if (response.status === 429) {
            return new Response(
              JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
              {
                status: 429,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
          if (response.status === 402) {
            return new Response(
              JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
              {
                status: 402,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
          throw new Error("Translation failed");
        }

        const data = await response.json();
        const translatedText = data.choices[0].message.content.trim();
        
        // Remove common labels in multiple languages
        let cleanedText = translatedText
          .replace(/^(Title|Titel|Título|Titre|Titolo):\s*/i, '')
          .replace(/\n(Body|Text|Texto|Texte|Testo):\s*/gi, '\n')
          .replace(/^(Body|Text|Texto|Texte|Testo):\s*/i, '');
        
        // Split into title and body
        const lines = cleanedText.split("\n").filter((line: string) => line.trim());
        let translatedTitle = "";
        let translatedBody = "";

        if (lines.length > 0) {
          translatedTitle = lines[0].trim();
          if (lines.length > 1) {
            translatedBody = lines.slice(1).join(" ").trim();
          }
        }

        translatedResults.push({
          ...slide,
          id: crypto.randomUUID(),
          title: `[${langName}] ${translatedTitle}`,
          body: translatedBody || undefined,
          language: langCode,
        });
      }
    }

    return new Response(JSON.stringify({ 
      translatedSlides: translatedResults,
      translatedUnusedText: Object.keys(translatedUnusedText).length > 0 ? translatedUnusedText : undefined
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Translation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
