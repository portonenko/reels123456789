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
    const { slides, targetLanguages } = await req.json();
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

    for (const langCode of targetLanguages) {
      const langName = languageNames[langCode];
      
      for (const slide of slides) {
        const prompt = `Translate the following text to ${langName}. Return ONLY the translated text without any additional explanation or formatting.

Title: ${slide.title}
${slide.body ? `Body: ${slide.body}` : ""}`;

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
                content: "You are a professional translator. Translate text accurately while preserving the meaning and tone.",
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
        
        // Parse the translation - expecting "Title: X\nBody: Y" format or just the text
        const lines = translatedText.split("\n").filter((line: string) => line.trim());
        let translatedTitle = "";
        let translatedBody = "";

        if (lines[0].toLowerCase().startsWith("title:")) {
          translatedTitle = lines[0].replace(/^title:\s*/i, "").trim();
          if (lines[1]?.toLowerCase().startsWith("body:")) {
            translatedBody = lines[1].replace(/^body:\s*/i, "").trim();
          }
        } else {
          // If format is different, use the whole text as title
          translatedTitle = lines[0];
          if (lines.length > 1) {
            translatedBody = lines.slice(1).join(" ");
          }
        }

        translatedResults.push({
          ...slide,
          id: crypto.randomUUID(),
          title: `[${langName}] ${translatedTitle}`,
          body: translatedBody ? `[${langName}] ${translatedBody}` : slide.body ? `[${langName}] ${slide.body}` : undefined,
          language: langCode,
        });
      }
    }

    return new Response(JSON.stringify({ translatedSlides: translatedResults }), {
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
