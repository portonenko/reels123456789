import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  try {
    console.log('Received conversion request');
    
    // Get the WebM blob from the request
    const formData = await req.formData();
    const webmFile = formData.get('video') as File;
    
    if (!webmFile) {
      return new Response(JSON.stringify({ error: 'No video file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing video: ${webmFile.size} bytes`);

    // Convert File to Uint8Array
    const webmArrayBuffer = await webmFile.arrayBuffer();
    const webmBytes = new Uint8Array(webmArrayBuffer);

    // Write input file
    await Deno.writeFile('/tmp/input.webm', webmBytes);
    console.log('Input file written');

    // Run FFmpeg conversion
    const ffmpegCommand = new Deno.Command('ffmpeg', {
      args: [
        '-i', '/tmp/input.webm',
        '-c:v', 'libx264',           // H.264 video codec
        '-preset', 'ultrafast',      // Fast encoding
        '-crf', '28',                // Quality level
        '-c:a', 'aac',               // AAC audio codec
        '-b:a', '128k',              // Audio bitrate
        '-movflags', '+faststart',   // Optimize for streaming
        '-y',                        // Overwrite output
        '/tmp/output.mp4'
      ],
      stdout: 'piped',
      stderr: 'piped',
    });

    console.log('Starting FFmpeg conversion...');
    const process = ffmpegCommand.spawn();
    
    const { code, stderr } = await process.output();
    
    if (code !== 0) {
      const errorText = new TextDecoder().decode(stderr);
      console.error('FFmpeg error:', errorText);
      return new Response(JSON.stringify({ 
        error: 'Conversion failed', 
        details: errorText 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('Conversion successful, reading output...');
    
    // Read the output MP4 file
    const mp4Bytes = await Deno.readFile('/tmp/output.mp4');
    
    // Clean up temp files
    try {
      await Deno.remove('/tmp/input.webm');
      await Deno.remove('/tmp/output.mp4');
    } catch (e) {
      console.warn('Cleanup error:', e);
    }

    console.log(`Sending MP4: ${mp4Bytes.length} bytes`);

    // Return the MP4 file
    return new Response(mp4Bytes, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Access-Control-Allow-Origin': '*',
        'Content-Disposition': 'attachment; filename="video.mp4"',
      },
    });

  } catch (error) {
    console.error('Server error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: errorMessage 
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});
