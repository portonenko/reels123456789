import { Slide, Asset } from "@/types";

const renderSlideToCanvas = (
  slide: Slide,
  canvas: HTMLCanvasElement,
  backgroundVideo?: HTMLVideoElement,
  transitionProgress?: number
): void => {
  const ctx = canvas.getContext("2d", { 
    alpha: false,
    desynchronized: false,
    willReadFrequently: false
  });
  if (!ctx) return;

  // Set canvas size to 1080x1920 (9:16 vertical)
  canvas.width = 1080;
  canvas.height = 1920;

  // Enable high-quality rendering
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.textRendering = 'geometricPrecision' as any;

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

  // Calculate wrapped text dimensions first (needed for plate sizing)
  ctx.font = `${slide.style.text.fontWeight} ${slide.style.text.fontSize}px ${slide.style.text.fontFamily}`;
  const titleWords = cleanTitle.split(' ');
  let titleLine = '';
  const titleLines: string[] = [];
  let maxTitleWidth = 0;

  for (const word of titleWords) {
    const testLine = titleLine + word + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > textBoxWidth && titleLine.length > 0) {
      titleLines.push(titleLine.trim());
      maxTitleWidth = Math.max(maxTitleWidth, ctx.measureText(titleLine.trim()).width);
      titleLine = word + ' ';
    } else {
      titleLine = testLine;
    }
  }
  if (titleLine.trim()) {
    titleLines.push(titleLine.trim());
    maxTitleWidth = Math.max(maxTitleWidth, ctx.measureText(titleLine.trim()).width);
  }

  const titleLineHeight = slide.style.text.fontSize * slide.style.text.lineHeight;
  const titleBlockHeight = titleLines.length * titleLineHeight;

  // Calculate body dimensions if exists
  let bodyLines: string[] = [];
  let maxBodyWidth = 0;
  let bodyBlockHeight = 0;
  
  if (cleanBody) {
    ctx.font = `${slide.style.text.bodyFontWeight || slide.style.text.fontWeight - 200} ${slide.style.text.bodyFontSize || slide.style.text.fontSize * 0.5}px ${slide.style.text.fontFamily}`;
    const bodyWords = cleanBody.split(' ');
    let bodyLine = '';

    for (const word of bodyWords) {
      const testLine = bodyLine + word + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > textBoxWidth && bodyLine.length > 0) {
        bodyLines.push(bodyLine.trim());
        maxBodyWidth = Math.max(maxBodyWidth, ctx.measureText(bodyLine.trim()).width);
        bodyLine = word + ' ';
      } else {
        bodyLine = testLine;
      }
    }
    if (bodyLine.trim()) {
      bodyLines.push(bodyLine.trim());
      maxBodyWidth = Math.max(maxBodyWidth, ctx.measureText(bodyLine.trim()).width);
    }
    
    const bodyLineHeight = (slide.style.text.bodyFontSize || slide.style.text.fontSize * 0.5) * slide.style.text.lineHeight * 1.2;
    bodyBlockHeight = bodyLines.length * bodyLineHeight;
  }

  // Draw background plate using wrapped text dimensions
  if (slide.style.plate.enabled) {
    const plateWidth = Math.max(maxTitleWidth, maxBodyWidth) + slide.style.plate.padding * 2;
    const totalContentHeight = titleBlockHeight + (cleanBody ? (30 + bodyBlockHeight) : 0);
    const plateHeight = totalContentHeight + slide.style.plate.padding * 2;

    const bgColor = slide.style.plate.backgroundColor;
    const plateOpacity = slide.style.plate.opacity;
    
    // Convert any color format to rgba with opacity
    let r = 0, g = 0, b = 0;
    
    if (bgColor.startsWith('#')) {
      r = parseInt(bgColor.slice(1, 3), 16);
      g = parseInt(bgColor.slice(3, 5), 16);
      b = parseInt(bgColor.slice(5, 7), 16);
    } else if (bgColor.startsWith('rgb')) {
      const match = bgColor.match(/(\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        r = parseInt(match[1]);
        g = parseInt(match[2]);
        b = parseInt(match[3]);
      }
    }
    
    const plateColor = `rgba(${r}, ${g}, ${b}, ${plateOpacity})`;
    
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = plateColor;
    
    const plateX = textX - plateWidth / 2;
    const plateY = textY - totalContentHeight / 2 - slide.style.plate.padding;
    
    ctx.beginPath();
    if (slide.style.plate.borderRadius > 0) {
      const radius = slide.style.plate.borderRadius;
      ctx.moveTo(plateX + radius, plateY);
      ctx.lineTo(plateX + plateWidth - radius, plateY);
      ctx.quadraticCurveTo(plateX + plateWidth, plateY, plateX + plateWidth, plateY + radius);
      ctx.lineTo(plateX + plateWidth, plateY + plateHeight - radius);
      ctx.quadraticCurveTo(plateX + plateWidth, plateY + plateHeight, plateX + plateWidth - radius, plateY + plateHeight);
      ctx.lineTo(plateX + radius, plateY + plateHeight);
      ctx.quadraticCurveTo(plateX, plateY + plateHeight, plateX, plateY + plateHeight - radius);
      ctx.lineTo(plateX, plateY + radius);
      ctx.quadraticCurveTo(plateX, plateY, plateX + radius, plateY);
      ctx.closePath();
    } else {
      ctx.rect(plateX, plateY, plateWidth, plateHeight);
    }
    ctx.fill();
    
    ctx.restore();
  }

  // Setup shadow configuration - ВСЕГДА включена тень!
  let shadowConfig: { color: string; blur: number; intensity: number } = {
    color: 'rgba(0, 0, 0, 0.9)', // Чёрная тень по умолчанию
    blur: 20,
    intensity: 5
  };
  
  // Попытка распарсить из настроек
  if (slide.style.text.textShadow) {
    const shadowParts = slide.style.text.textShadow.match(/(-?\d+(?:\.\d+)?px)\s+(-?\d+(?:\.\d+)?px)\s+(-?\d+(?:\.\d+)?px)\s+(rgba?\([^)]+\)|#[0-9a-fA-F]+)/);
    if (shadowParts) {
      const blurRadius = parseFloat(shadowParts[3]);
      const shadowColor = shadowParts[4];
      const intensity = slide.style.text.shadowIntensity || 5;
      shadowConfig = { color: shadowColor, blur: blurRadius, intensity };
    }
  }

  // Draw title with text wrapping
  ctx.font = `${slide.style.text.fontWeight} ${slide.style.text.fontSize}px ${slide.style.text.fontFamily}`;
  ctx.fillStyle = slide.style.text.color;

  // Calculate starting Y position
  let currentY;
  
  if (slide.style.plate.enabled) {
    const plateTop = textY - (titleBlockHeight + (cleanBody ? (30 + bodyBlockHeight) : 0)) / 2 - slide.style.plate.padding;
    currentY = plateTop + slide.style.plate.padding + titleLineHeight / 2;
  } else {
    currentY = textY - (titleBlockHeight / 2);
    if (cleanBody) {
      const totalHeight = titleBlockHeight + 30 + bodyBlockHeight;
      currentY = textY - (totalHeight / 2);
    }
  }

  // Draw title lines with MASSIVE SHADOW - ВСЕГДА!
  titleLines.forEach((line) => {
    ctx.save();
    
    // ОГРОМНАЯ тень - фиксированные параметры
    const shadowDistance = 80; // Огромное смещение
    const shadowBlurLayers = 100; // Много слоёв для размытия
    
    ctx.fillStyle = shadowConfig.color;
    
    // Рисуем очень плотную тень
    for (let i = shadowBlurLayers; i >= 0; i--) {
      const offsetX = (shadowDistance / shadowBlurLayers) * i;
      const offsetY = (shadowDistance / shadowBlurLayers) * i;
      ctx.globalAlpha = 0.9; // Очень плотная тень
      ctx.fillText(line, textX + offsetX, currentY + offsetY);
    }
    
    ctx.restore();
    
    // Основной текст поверх тени
    ctx.globalAlpha = 1;
    ctx.fillStyle = slide.style.text.color;
    ctx.fillText(line, textX, currentY);
    
    currentY += titleLineHeight;
  });

  // Draw body if exists
  if (cleanBody) {
    currentY += 30;
    
    const bodyColor = slide.style.text.bodyColor || slide.style.text.color;
    
    ctx.font = `${slide.style.text.bodyFontWeight || slide.style.text.fontWeight - 200} ${slide.style.text.bodyFontSize || slide.style.text.fontSize * 0.5}px ${slide.style.text.bodyFontFamily || slide.style.text.fontFamily}`;

    const bodyLineHeight = (slide.style.text.bodyFontSize || slide.style.text.fontSize * 0.5) * slide.style.text.lineHeight * 1.2;
    bodyLines.forEach((line) => {
      ctx.save();
      
      const shadowDistance = 100; // Ещё больше для body
      const shadowBlurLayers = 100;
      
      ctx.fillStyle = shadowConfig.color;
      
      for (let i = shadowBlurLayers; i >= 0; i--) {
        const offsetX = (shadowDistance / shadowBlurLayers) * i;
        const offsetY = (shadowDistance / shadowBlurLayers) * i;
        ctx.globalAlpha = 0.9;
        ctx.fillText(line, textX + offsetX, currentY + offsetY);
      }
      
      ctx.restore();
      
      // Основной текст body
      ctx.globalAlpha = 1;
      ctx.fillStyle = bodyColor;
      ctx.fillText(line, textX, currentY);
      
      currentY += bodyLineHeight;
    });
  }

  // Reset
  ctx.globalAlpha = 1;

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
    // Don't set crossOrigin for blob URLs as it causes CORS issues
    if (!backgroundAsset.url.startsWith('blob:')) {
      backgroundVideo.crossOrigin = "anonymous";
    }
    await new Promise((resolve, reject) => {
      backgroundVideo!.onloadeddata = resolve;
      backgroundVideo!.onerror = (e) => {
        console.error("Video loading error:", e);
        reject(new Error("Failed to load background video"));
      };
      backgroundVideo!.load();
    });
  }

  // Load background music if available
  if (backgroundMusicUrl) {
    try {
      backgroundAudio = document.createElement("audio");
      backgroundAudio.src = backgroundMusicUrl;
      backgroundAudio.loop = true;
      // Don't set crossOrigin for blob URLs as it causes CORS issues
      if (!backgroundMusicUrl.startsWith('blob:')) {
        backgroundAudio.crossOrigin = "anonymous";
      }
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.warn("Audio loading timeout, continuing without music");
          backgroundAudio = undefined;
          resolve(null);
        }, 5000); // 5 second timeout
        
        backgroundAudio!.onloadeddata = () => {
          clearTimeout(timeout);
          console.log("Background music loaded successfully:", backgroundMusicUrl);
          resolve(null);
        };
        backgroundAudio!.onerror = (e) => {
          clearTimeout(timeout);
          console.error("Audio loading failed:", e, "URL:", backgroundMusicUrl);
          backgroundAudio = undefined; // Clear failed audio
          resolve(null); // Continue without music instead of failing
        };
        backgroundAudio!.load();
      });
    } catch (error) {
      console.warn("Failed to load background music, continuing without it:", error);
      backgroundAudio = undefined;
    }
  }

  onProgress(10, "Starting recording...");

  // Use baseline H.264 for maximum phone compatibility
  let mimeType = 'video/mp4;codecs=avc1.42E01E,mp4a.40.2'; // H.264 Baseline + AAC
  
  // Try standard H.264 if baseline not supported
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/mp4;codecs=h264,aac';
  }
  
  // Fallback to WebM VP8 (widely supported on Android)
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm;codecs=vp8,opus';
  }

  console.log('Using video format:', mimeType);

  // Create MediaRecorder with audio support
  const videoStream = canvas.captureStream(30); // 30 FPS
  const chunks: Blob[] = [];
  
  // Combine video and audio streams if music is available
  let combinedStream: MediaStream;
  let audioContext: AudioContext | undefined;
  
  if (backgroundAudio) {
    try {
      audioContext = new AudioContext();
      const audioSource = audioContext.createMediaElementSource(backgroundAudio);
      const gainNode = audioContext.createGain();
      const audioDestination = audioContext.createMediaStreamDestination();
      
      // Connect: source -> gain -> destination
      audioSource.connect(gainNode);
      gainNode.connect(audioDestination);
      gainNode.gain.value = 0.8; // Set volume
      
      combinedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...audioDestination.stream.getAudioTracks()
      ]);
      
      console.log("Audio stream added:", audioDestination.stream.getAudioTracks().length, "tracks");
    } catch (error) {
      console.error("Failed to setup audio stream:", error);
      combinedStream = videoStream;
      backgroundAudio = undefined;
    }
  } else {
    combinedStream = videoStream;
  }
  
  const mediaRecorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: 8000000, // 8 Mbps - higher quality for better text clarity
    audioBitsPerSecond: 192000, // 192 kbps for audio
  });

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  const recordingPromise = new Promise<Blob>((resolve, reject) => {
    mediaRecorder.onstop = () => {
      // Clean up audio context
      if (audioContext) {
        audioContext.close();
      }
      const blob = new Blob(chunks, { type: mimeType.split(';')[0] });
      resolve(blob);
    };
    mediaRecorder.onerror = reject;
  });

  mediaRecorder.start(100); // Collect data every 100ms for better audio sync

  // Start background video and audio if available
  if (backgroundVideo) {
    backgroundVideo.play();
  }
  if (backgroundAudio) {
    // Don't set volume here as it's controlled by gain node
    await backgroundAudio.play();
    console.log("Background audio playing");
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
  const videoBlob = await recordingPromise;
  
  onProgress(100, "Complete!");
  return videoBlob;
};

