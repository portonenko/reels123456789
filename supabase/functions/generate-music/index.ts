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
    const { prompt, duration, slideTimings, slides } = await req.json();
    
    if (!duration || duration <= 0) {
      throw new Error('Valid duration is required');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Generating music for:', { duration, slideCount: slides?.length, prompt });

    // Analyze slides to understand content and timing
    const slideInfo = slides?.map((s: any) => 
      `Slide ${s.index}: "${s.title}" (${s.duration}s)`
    ).join('\n') || 'No slide information';

    // Use Lovable AI to analyze content and generate music parameters
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
            content: 'You are a music production expert who analyzes video content and creates detailed music specifications with timing markers for slide transitions.'
          },
          {
            role: 'user',
            content: `Analyze this video and create music specifications:

Total Duration: ${duration} seconds
Style Request: ${prompt || 'Auto-detect from content'}

Slide Timings:
${slideInfo}

Please provide:
1. Overall music style and mood
2. BPM (beats per minute)
3. Key and scale
4. Instruments to use
5. Timing markers for transitions at each slide change
6. Dynamic changes (intensity, tempo) matching content flow

Format as a detailed music brief that could be used with a music generation API.`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error('Rate limit exceeded');
      } else if (aiResponse.status === 402) {
        throw new Error('Payment required');
      }
      
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const musicBrief = aiData.choices?.[0]?.message?.content;

    console.log('AI Music Brief Generated:', musicBrief?.substring(0, 200) + '...');

    // NOTE: This is where you would integrate with a music generation API
    // Examples: Mubert, Soundraw, AIVA, ElevenLabs Music, Suno
    
    // For now, return the AI analysis with instructions
    return new Response(
      JSON.stringify({ 
        error: 'Music API not integrated',
        musicBrief,
        instructions: `To enable music generation:
1. Sign up for a music generation API (Mubert, Soundraw, or ElevenLabs)
2. Add the API key as a secret
3. The AI has analyzed your content and created this music brief:

${musicBrief}

For now, you can:
- Upload your own music that matches this brief
- Use free stock music from sites like Pixabay or Incompetech
- Contact support@lovable.dev for music API integration assistance`,
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
