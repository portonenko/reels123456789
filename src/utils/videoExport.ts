import { Slide, Asset } from "@/types";

const renderSlideToCanvas = (
  slide: Slide,
  canvas: HTMLCanvasElement,
  backgroundVideo?: HTMLVideoElement
): void => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Set canvas size to 1080x1920 (9:16 vertical)
  canvas.width = 1080;
  canvas.height = 1920;

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

  // Draw background plate or text effects
  if (slide.style.plate.enabled) {
    // Measure text to create plate
    ctx.font = `${slide.style.text.fontWeight} ${slide.style.text.fontSize * 2}px ${slide.style.text.fontFamily}`;
    const titleMetrics = ctx.measureText(cleanTitle);
    const titleWidth = titleMetrics.width;
    const titleHeight = slide.style.text.fontSize * 2 * slide.style.text.lineHeight;

    let plateHeight = titleHeight + slide.style.plate.padding * 2;
    let plateWidth = titleWidth + slide.style.plate.padding * 4;

    if (cleanBody) {
      ctx.font = `${slide.style.text.bodyFontWeight || slide.style.text.fontWeight - 200} ${(slide.style.text.bodyFontSize || slide.style.text.fontSize) * 1.2}px ${slide.style.text.fontFamily}`;
      const bodyMetrics = ctx.measureText(cleanBody);
      plateWidth = Math.max(plateWidth, bodyMetrics.width + slide.style.plate.padding * 4);
      plateHeight += (slide.style.text.bodyFontSize || slide.style.text.fontSize) * 1.2 * slide.style.text.lineHeight * 1.2 + slide.style.plate.padding;
    }

    // Draw plate
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

  // Draw title with text wrapping
  ctx.font = `${slide.style.text.fontWeight} ${slide.style.text.fontSize * 2}px ${slide.style.text.fontFamily}`;
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

  // Wrap title text
  const maxWidth = canvas.width * 0.85;
  const titleWords = cleanTitle.split(' ');
  let titleLine = '';
  const titleLines: string[] = [];

  for (const word of titleWords) {
    const testLine = titleLine + word + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && titleLine.length > 0) {
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
  const titleLineHeight = slide.style.text.fontSize * 2 * slide.style.text.lineHeight;
  const titleBlockHeight = titleLines.length * titleLineHeight;
  
  // Adjust starting Y position to center the entire text block
  let currentY = textY - (titleBlockHeight / 2);
  
  if (cleanBody) {
    // If there's body text, adjust to account for both title and body
    const bodyFontSize = (slide.style.text.bodyFontSize || slide.style.text.fontSize) * 1.2;
    const bodyLineHeight = bodyFontSize * slide.style.text.lineHeight * 1.2;
    const estimatedBodyHeight = bodyLineHeight * 3; // Rough estimate
    const totalHeight = titleBlockHeight + 30 + estimatedBodyHeight;
    currentY = textY - (totalHeight / 2);
  }

  // Draw title lines
  titleLines.forEach((line) => {
    if (!slide.style.plate.enabled && slide.style.text.stroke) {
      ctx.strokeStyle = slide.style.text.stroke;
      ctx.lineWidth = (slide.style.text.strokeWidth || 2) * 2;
      ctx.strokeText(line, centerX, currentY);
    }
    ctx.fillText(line, centerX, currentY);
    currentY += titleLineHeight;
  });

  // Draw body if exists
  if (cleanBody) {
    currentY += 30; // Space between title and body
    ctx.font = `${slide.style.text.bodyFontWeight || slide.style.text.fontWeight - 200} ${(slide.style.text.bodyFontSize || slide.style.text.fontSize) * 1.2}px ${slide.style.text.fontFamily}`;
    
    // Wrap body text
    const bodyWords = cleanBody.split(' ');
    let bodyLine = '';
    const bodyLines: string[] = [];

    for (const word of bodyWords) {
      const testLine = bodyLine + word + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && bodyLine.length > 0) {
        bodyLines.push(bodyLine.trim());
        bodyLine = word + ' ';
      } else {
        bodyLine = testLine;
      }
    }
    if (bodyLine.trim()) {
      bodyLines.push(bodyLine.trim());
    }

    const bodyLineHeight = (slide.style.text.bodyFontSize || slide.style.text.fontSize) * 1.2 * slide.style.text.lineHeight * 1.2;
    bodyLines.forEach((line) => {
      if (!slide.style.plate.enabled && slide.style.text.stroke) {
        ctx.strokeStyle = slide.style.text.stroke;
        ctx.lineWidth = ((slide.style.text.strokeWidth || 2) * 0.75) * 2;
        ctx.strokeText(line, centerX, currentY);
      }
      ctx.fillText(line, centerX, currentY);
      currentY += bodyLineHeight;
    });
  }

  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowBlur = 0;
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
  onProgress: (progress: number, message: string) => void
): Promise<Blob> => {
  onProgress(5, "Initializing video recorder...");

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;

  let backgroundVideo: HTMLVideoElement | undefined;
  
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

  onProgress(10, "Starting recording...");

  // Create MediaRecorder
  const stream = canvas.captureStream(30); // 30 FPS
  const chunks: Blob[] = [];
  
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp9',
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

  // Start background video if available
  if (backgroundVideo) {
    backgroundVideo.play();
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

    // Render current slide
    if (currentSlideIndex < slides.length) {
      renderSlideToCanvas(slides[currentSlideIndex], canvas, backgroundVideo);
      
      if (elapsed < totalDuration) {
        requestAnimationFrame(animate);
      } else {
        // Stop recording
        if (backgroundVideo) {
          backgroundVideo.pause();
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

