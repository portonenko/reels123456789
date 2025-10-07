import { Slide, Asset } from "@/types";
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const renderSlideToCanvas = (
  slide: Slide,
  canvas: HTMLCanvasElement,
  backgroundVideo?: HTMLVideoElement,
  transitionProgress?: number
): void => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Set canvas size to 1080x1920 (9:16 vertical)
  canvas.width = 1080;
  canvas.height = 1920;

  // Calculate transition effects
  const progress = transitionProgress ?? 1;
  let opacity = 1;
  let offsetX = 0;
  let filterValue = 'none';
  
  if (progress < 1 && slide.transition) {
    switch (slide.transition) {
      case "fade":
        opacity = progress;
        break;
      case "flash":
        if (progress < 0.3) {
          filterValue = `brightness(${1 + (3 - progress / 0.3 * 3)})`;
          opacity = progress / 0.3;
        }
        break;
      case "glow":
        filterValue = `brightness(${1 + (1 - progress)}) contrast(${1 + (0.2 - progress * 0.2)})`;
        opacity = progress;
        break;
      case "sunlight":
        // Sunlight flash: intense white flash at start, then fade in
        if (progress < 0.2) {
          filterValue = `brightness(${1 + (5 - progress / 0.2 * 5)})`;
          opacity = progress / 0.2;
        } else {
          opacity = 0.2 + (progress - 0.2) * 1.25; // fade in after flash
        }
        break;
      case "slide-left":
        offsetX = canvas.width * (1 - progress);
        break;
      case "slide-right":
        offsetX = -canvas.width * (1 - progress);
        break;
    }
  }

  // Save context for transitions
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(offsetX, 0);
  if (filterValue !== 'none') {
    ctx.filter = filterValue;
  }

  // Draw background
  if (backgroundVideo) {
    ctx.drawImage(backgroundVideo, 0, 0, canvas.width, canvas.height);
  } else {
    // Gradient fallback
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#581c87"); // purple-900
    gradient.addColorStop(0.5, "#1e3a8a"); // blue-900
    gradient.addColorStop(1, "#155e75"); // cyan-900
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Apply overlay
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Calculate safe margins
  const safeTop = (slide.style.safeMarginTop / 100) * canvas.height;
  const safeBottom = (slide.style.safeMarginBottom / 100) * canvas.height;
  const contentHeight = canvas.height - safeTop - safeBottom;

  // Extract clean text (remove language tags)
  const cleanTitle = slide.title.replace(/^\[.*?\]\s*/, '');
  const cleanBody = slide.body?.replace(/^\[.*?\]\s*/, '');

  // Set text properties
  ctx.textAlign = slide.style.text.alignment as CanvasTextAlign;
  ctx.textBaseline = "middle";

  const centerX = canvas.width / 2;
  let textY = safeTop + contentHeight / 2;

  // Calculate position for text box if defined
  let textX = centerX;
  let textBoxWidth = canvas.width * 0.70; // Default 70% width
  
  if (slide.style.text.position) {
    textX = (slide.style.text.position.x / 100) * canvas.width + (slide.style.text.position.width / 100 * canvas.width) / 2;
    textBoxWidth = (slide.style.text.position.width / 100) * canvas.width;
    textY = (slide.style.text.position.y / 100) * canvas.height + (slide.style.text.position.height / 100 * canvas.height) / 2;
  }

  // Draw background plate or text effects
  if (slide.style.plate.enabled) {
    // Measure text to create plate
    ctx.font = `${slide.style.text.fontWeight} ${slide.style.text.fontSize}px ${slide.style.text.fontFamily}`;
    const titleMetrics = ctx.measureText(cleanTitle);
    const titleWidth = titleMetrics.width;
    const titleHeight = slide.style.text.fontSize * slide.style.text.lineHeight;

    let plateHeight = titleHeight + slide.style.plate.padding * 2;
    let plateWidth = titleWidth + slide.style.plate.padding * 4;

    if (cleanBody) {
      ctx.font = `${slide.style.text.bodyFontWeight || slide.style.text.fontWeight - 200} ${slide.style.text.bodyFontSize || slide.style.text.fontSize * 0.5}px ${slide.style.text.fontFamily}`;
      const bodyMetrics = ctx.measureText(cleanBody);
      plateWidth = Math.max(plateWidth, bodyMetrics.width + slide.style.plate.padding * 4);
      plateHeight += (slide.style.text.bodyFontSize || slide.style.text.fontSize * 0.5) * slide.style.text.lineHeight * 1.2 + slide.style.plate.padding;
    }

    // Only draw plate if positioned, or draw full-width plate
    if (slide.style.text.position) {
      // Positioned text box - plate fits the text box
      ctx.fillStyle = slide.style.plate.backgroundColor;
      ctx.globalAlpha = slide.style.plate.opacity;
      const plateX = (slide.style.text.position.x / 100) * canvas.width;
      const plateY = (slide.style.text.position.y / 100) * canvas.height;
      const plateW = (slide.style.text.position.width / 100) * canvas.width;
      const plateH = (slide.style.text.position.height / 100) * canvas.height;
      
      if (slide.style.plate.borderRadius > 0) {
        roundRect(ctx, plateX, plateY, plateW, plateH, slide.style.plate.borderRadius);
      } else {
        ctx.fillRect(plateX, plateY, plateW, plateH);
      }
      ctx.globalAlpha = 1;
    } else {
      // Default centered - plate wraps text
      ctx.fillStyle = slide.style.plate.backgroundColor;
      ctx.globalAlpha = slide.style.plate.opacity;
      const plateX = centerX - plateWidth / 2;
      const plateY = textY - plateHeight / 2;
      
      if (slide.style.plate.borderRadius > 0) {
        roundRect(ctx, plateX, plateY, plateWidth, plateHeight, slide.style.plate.borderRadius);
      } else {
        ctx.fillRect(plateX, plateY, plateWidth, plateHeight);
      }
      ctx.globalAlpha = 1;
    }
  }

  // Draw title with text wrapping - use narrower width to avoid blind zones
  ctx.font = `${slide.style.text.fontWeight} ${slide.style.text.fontSize}px ${slide.style.text.fontFamily}`;
  ctx.fillStyle = slide.style.text.color;
  
  if (slide.style.text.textShadow) {
    const shadowParts = slide.style.text.textShadow.match(/(-?\d+(?:\.\d+)?px)\s+(-?\d+(?:\.\d+)?px)\s+(-?\d+(?:\.\d+)?px)\s+(rgba?\([^)]+\)|#[0-9a-fA-F]+)/);
    if (shadowParts) {
      ctx.shadowOffsetX = parseFloat(shadowParts[1]);
      ctx.shadowOffsetY = parseFloat(shadowParts[2]);
      ctx.shadowBlur = parseFloat(shadowParts[3]);
      ctx.shadowColor = shadowParts[4];
    }
  }

  const titleWords = cleanTitle.split(' ');
  let titleLine = '';
  const titleLines: string[] = [];

  for (const word of titleWords) {
    const testLine = titleLine + word + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > textBoxWidth && titleLine.length > 0) {
      titleLines.push(titleLine.trim());
      titleLine = word + ' ';
    } else {
      titleLine = testLine;
    }
  }
  if (titleLine.trim()) {
    titleLines.push(titleLine.trim());
  }

  // Calculate title block height
  const titleLineHeight = slide.style.text.fontSize * slide.style.text.lineHeight;
  const titleBlockHeight = titleLines.length * titleLineHeight;
  
  // Adjust starting Y position to center the entire text block
  let currentY = textY - (titleBlockHeight / 2);
  
  if (cleanBody) {
    // If there's body text, adjust to account for both title and body
    const bodyFontSize = slide.style.text.bodyFontSize || slide.style.text.fontSize * 0.5;
    const bodyLineHeight = bodyFontSize * slide.style.text.lineHeight * 1.2;
    const estimatedBodyHeight = bodyLineHeight * 3; // Rough estimate
    const totalHeight = titleBlockHeight + 30 + estimatedBodyHeight;
    currentY = textY - (totalHeight / 2);
  }

  // Draw title lines
  titleLines.forEach((line) => {
    if (!slide.style.plate.enabled && slide.style.text.stroke) {
      ctx.strokeStyle = slide.style.text.stroke;
      ctx.lineWidth = slide.style.text.strokeWidth || 2;
      ctx.strokeText(line, textX, currentY);
    }
    ctx.fillText(line, textX, currentY);
    currentY += titleLineHeight;
  });

  // Draw body if exists
  if (cleanBody) {
    currentY += 30; // Space between title and body
    ctx.font = `${slide.style.text.bodyFontWeight || slide.style.text.fontWeight - 200} ${slide.style.text.bodyFontSize || slide.style.text.fontSize * 0.5}px ${slide.style.text.bodyFontFamily || slide.style.text.fontFamily}`;
    
    // Wrap body text
    const bodyWords = cleanBody.split(' ');
    let bodyLine = '';
    const bodyLines: string[] = [];

    for (const word of bodyWords) {
      const testLine = bodyLine + word + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > textBoxWidth && bodyLine.length > 0) {
        bodyLines.push(bodyLine.trim());
        bodyLine = word + ' ';
      } else {
        bodyLine = testLine;
      }
    }
    if (bodyLine.trim()) {
      bodyLines.push(bodyLine.trim());
    }

    const bodyLineHeight = (slide.style.text.bodyFontSize || slide.style.text.fontSize * 0.5) * slide.style.text.lineHeight * 1.2;
    bodyLines.forEach((line) => {
      if (!slide.style.plate.enabled && slide.style.text.stroke) {
        ctx.strokeStyle = slide.style.text.stroke;
        ctx.lineWidth = (slide.style.text.strokeWidth || 2) * 0.75;
        ctx.strokeText(line, textX, currentY);
      }
      ctx.fillText(line, textX, currentY);
      currentY += bodyLineHeight;
    });
  }

  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowBlur = 0;

  // Restore context after transitions
  ctx.restore();
};

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
};

export const exportVideo = async (
  slides: Slide[],
  backgroundAsset: Asset | null,
  onProgress: (progress: number, message: string) => void,
  backgroundMusicUrl?: string
): Promise<Blob> => {
  onProgress(5, "Initializing video recorder...");

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;

  let backgroundVideo: HTMLVideoElement | undefined;
  let backgroundAudio: HTMLAudioElement | undefined;
  
  // Load background video if available
  if (backgroundAsset) {
    backgroundVideo = document.createElement("video");
    backgroundVideo.src = backgroundAsset.url;
    backgroundVideo.muted = true;
    backgroundVideo.loop = true;
    await new Promise((resolve, reject) => {
      backgroundVideo!.onloadeddata = resolve;
      backgroundVideo!.onerror = reject;
    });
  }

  // Load background music if available
  if (backgroundMusicUrl) {
    backgroundAudio = document.createElement("audio");
    backgroundAudio.src = backgroundMusicUrl;
    backgroundAudio.loop = true;
    await new Promise((resolve, reject) => {
      backgroundAudio!.onloadeddata = resolve;
      backgroundAudio!.onerror = reject;
    });
  }

  onProgress(10, "Starting recording...");

  // Use VP9 with Opus for better quality and compatibility
  // Most modern mobile browsers support VP9
  let mimeType = 'video/webm;codecs=vp9,opus';
  
  // Fallback to VP8 if VP9 is not supported
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm;codecs=vp8,opus';
  }

  console.log('Using video format:', mimeType);

  // Create MediaRecorder with audio support
  const videoStream = canvas.captureStream(30); // 30 FPS
  const chunks: Blob[] = [];
  
  // Combine video and audio streams if music is available
  let combinedStream: MediaStream;
  if (backgroundAudio) {
    const audioContext = new AudioContext();
    const audioSource = audioContext.createMediaElementSource(backgroundAudio);
    const audioDestination = audioContext.createMediaStreamDestination();
    
    // Connect audio source to destination
    audioSource.connect(audioDestination);
    
    // Also connect to the audio context destination so we can hear it during recording
    audioSource.connect(audioContext.destination);
    
    combinedStream = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...audioDestination.stream.getAudioTracks()
    ]);
  } else {
    combinedStream = videoStream;
  }
  
  const mediaRecorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: 5000000, // 5 Mbps for good quality
  });

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  const recordingPromise = new Promise<Blob>((resolve, reject) => {
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      resolve(blob);
    };
    mediaRecorder.onerror = reject;
  });

  mediaRecorder.start();

  // Start background video and audio if available
  if (backgroundVideo) {
    backgroundVideo.play();
  }
  if (backgroundAudio) {
    backgroundAudio.play();
  }

  // Animate through slides
  const totalDuration = slides.reduce((sum, s) => sum + s.durationSec, 0);
  const startTime = Date.now();
  let currentSlideIndex = 0;
  let slideStartTime = 0;

  const animate = () => {
    const elapsed = (Date.now() - startTime) / 1000; // seconds
    
    // Update progress
    const progressPercent = Math.min((elapsed / totalDuration) * 100, 100);
    onProgress(10 + progressPercent * 0.85, `Recording slide ${currentSlideIndex + 1}/${slides.length}...`);

    // Find current slide based on elapsed time
    let accumulatedTime = 0;
    for (let i = 0; i < slides.length; i++) {
      if (elapsed < accumulatedTime + slides[i].durationSec) {
        currentSlideIndex = i;
        slideStartTime = accumulatedTime;
        break;
      }
      accumulatedTime += slides[i].durationSec;
    }

    // Render current slide with transition
    if (currentSlideIndex < slides.length) {
      const slideElapsed = elapsed - slideStartTime;
      const transitionDuration = 0.5; // 0.5 seconds
      const transitionProgress = Math.min(slideElapsed / transitionDuration, 1);
      
      renderSlideToCanvas(
        slides[currentSlideIndex], 
        canvas, 
        backgroundVideo, 
        transitionProgress
      );
      
      if (elapsed < totalDuration) {
        requestAnimationFrame(animate);
      } else {
        // Stop recording
        if (backgroundVideo) {
          backgroundVideo.pause();
        }
        if (backgroundAudio) {
          backgroundAudio.pause();
        }
        mediaRecorder.stop();
      }
    }
  };

  animate();

  onProgress(95, "Finalizing video...");
  const webmBlob = await recordingPromise;

  // Convert WebM to MP4 using FFmpeg
  let ffmpeg: FFmpeg | null = null;
  try {
    onProgress(96, "Loading MP4 converter...");
    console.log('Starting FFmpeg MP4 conversion...');
    
    ffmpeg = new FFmpeg();
    
    // Add logging
    ffmpeg.on('log', ({ message }) => {
      console.log('FFmpeg:', message);
    });
    
    ffmpeg.on('progress', ({ progress, time }) => {
      console.log(`FFmpeg progress: ${progress * 100}% (time: ${time})`);
      onProgress(96 + progress * 3, `Converting to MP4... ${Math.round(progress * 100)}%`);
    });
    
    // Use unpkg CDN as it's more reliable
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    console.log('Loading FFmpeg from:', baseURL);
    
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    console.log('FFmpeg loaded successfully');

    // Write WebM file
    onProgress(97, "Writing video file...");
    await ffmpeg.writeFile('input.webm', await fetchFile(webmBlob));
    console.log('WebM file written to FFmpeg');

    // Convert to MP4 with timeout
    onProgress(98, "Converting to MP4...");
    const execPromise = ffmpeg.exec([
      '-i', 'input.webm',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '28',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      'output.mp4'
    ]);
    
    await Promise.race([
      execPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('FFmpeg conversion timeout after 3min')), 180000))
    ]);
    
    console.log('FFmpeg conversion complete');

    // Read the output MP4 file
    const mp4Data = await ffmpeg.readFile('output.mp4');
    const mp4Blob = new Blob([new Uint8Array(mp4Data as Uint8Array)], { type: 'video/mp4' });

    // Clean up FFmpeg files
    try {
      await ffmpeg.deleteFile('input.webm');
      await ffmpeg.deleteFile('output.mp4');
    } catch (cleanupError) {
      console.warn('FFmpeg cleanup warning:', cleanupError);
    }

    onProgress(100, "Complete!");
    console.log('MP4 export successful!');
    return mp4Blob;
    
  } catch (error) {
    console.error('MP4 conversion failed:', error);
    onProgress(100, "Export failed - please try again");
    throw error;
  } finally {
    // Terminate FFmpeg to free resources
    if (ffmpeg) {
      try {
        await ffmpeg.terminate();
        console.log('FFmpeg terminated successfully');
      } catch (termError) {
        console.warn('FFmpeg termination warning:', termError);
      }
    }
  }
};

