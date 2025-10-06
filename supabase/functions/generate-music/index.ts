import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

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
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    
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

    // If ElevenLabs API key is not configured, return the brief
    if (!ELEVENLABS_API_KEY) {
      return new Response(
        JSON.stringify({ 
          status: 'api_not_integrated',
          musicBrief,
          instructions: `To enable music generation:
1. Sign up for a music generation API (Mubert, Soundraw, or ElevenLabs)
2. Add the API key as a secret
3. The AI has analyzed your content and created this music brief that you can use to find matching stock music.`,
          suggestions: [
            'Use free stock music from Pixabay (pixabay.com/music)',
            'Try Incompetech (incompetech.com) for royalty-free music',
            'Search for music matching the AI brief on YouTube Audio Library',
            'Contact support@lovable.dev for music API integration assistance'
          ]
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Generate music using ElevenLabs Text-to-Sound API
    console.log("Calling ElevenLabs to generate music...");
    
    const elevenLabsResponse = await fetch('https://api.elevenlabs.io/v1/text-to-sound-effects', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: musicBrief,
        duration_seconds: Math.min(duration, 22), // ElevenLabs max is 22 seconds
        prompt_influence: 0.5,
      }),
    });

    if (!elevenLabsResponse.ok) {
      const errorText = await elevenLabsResponse.text();
      console.error('ElevenLabs API error:', errorText);
      
      if (elevenLabsResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (elevenLabsResponse.status === 402 || elevenLabsResponse.status === 401) {
        return new Response(
          JSON.stringify({ error: 'ElevenLabs credits exhausted or invalid API key. Please check your account.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`ElevenLabs API error: ${errorText}`);
    }

    // Get the audio data
    const audioArrayBuffer = await elevenLabsResponse.arrayBuffer();
    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioArrayBuffer)));
    
    console.log("Music generated successfully");

    return new Response(
      JSON.stringify({ 
        audioData: base64Audio,
        format: 'mp3',
        duration: duration,
        musicBrief: musicBrief
      }),
      {
        status: 200,
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
