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
        console.log(`Translating unused text to ${langName}, length:`, unusedText.length);
        
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
                content: `You are a translator. Translate to ${langName}. Preserve line breaks and structure.`,
              },
              { role: "user", content: unusedText },
            ],
          }),
        });

        if (unusedResponse.ok) {
          const unusedData = await unusedResponse.json();
          const translated = unusedData.choices[0].message.content.trim();
          translatedUnusedText[langCode] = translated;
          console.log(`Translated unused text to ${langCode}, length:`, translated.length);
        } else {
          console.error(`Failed to translate unused text to ${langCode}:`, unusedResponse.status);
        }
      } else {
        console.log(`No unused text to translate for ${langName}`);
      }
      
      for (const slide of slides) {
        const hasBody = slide.body && slide.body.trim();
        const textToTranslate = hasBody 
          ? `${slide.title}\n${slide.body}`
          : slide.title;

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
                content: `You are a translator. Translate to ${langName}. Return only the translation, preserving line breaks.`,
              },
              { role: "user", content: textToTranslate },
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
        
        // Parse the translation based on whether we expect body text
        let translatedTitle = "";
        let translatedBody = "";

        if (hasBody) {
          // Split by first newline for title/body separation
          const firstNewline = translatedText.indexOf("\n");
          if (firstNewline > 0) {
            translatedTitle = translatedText.substring(0, firstNewline).trim();
            translatedBody = translatedText.substring(firstNewline + 1).trim();
          } else {
            translatedTitle = translatedText;
          }
        } else {
          translatedTitle = translatedText;
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
