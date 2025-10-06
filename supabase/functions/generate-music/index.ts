import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, duration } = await req.json();
    
    if (!prompt) {
      throw new Error('Prompt is required');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Use Lovable AI to generate music description and metadata
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a music generation assistant. Generate detailed music parameters based on user prompts.'
          },
          {
            role: 'user',
            content: `Based on this prompt: "${prompt}", suggest BPM, key, mood, and instruments for ${duration} second background music.`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const musicDescription = aiData.choices?.[0]?.message?.content;

    // For now, return a placeholder since actual music generation requires
    // a specialized API like Mubert, Soundraw, or AIVA
    // You would need to integrate one of these services here
    
    // Placeholder response - in production, this would call a music generation API
    return new Response(
      JSON.stringify({ 
        error: 'Music generation API not yet integrated',
        suggestion: musicDescription,
        message: 'Please upload your own music for now. AI music generation requires integration with a music API like Mubert or Soundraw.'
      }),
      {
        status: 501,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );

  } catch (error: any) {
    console.error('Music generation error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
