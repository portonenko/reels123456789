import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { Slide, Asset } from "@/types";

let ffmpegInstance: FFmpeg | null = null;

export const initFFmpeg = async () => {
  if (ffmpegInstance) return ffmpegInstance;

  const ffmpeg = new FFmpeg();
  
  // Add logging to help debug
  ffmpeg.on("log", ({ message }) => {
    console.log("FFmpeg:", message);
  });

  ffmpeg.on("progress", ({ progress }) => {
    console.log("FFmpeg progress:", Math.round(progress * 100), "%");
  });
  
  try {
    // Use jsdelivr CDN which has better CORS support
    const baseURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });
    
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  } catch (error) {
    console.error("FFmpeg load error:", error);
    throw new Error("Failed to load video encoder. Please try again or check your internet connection.");
  }
};

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

  // Draw title
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

  // Text stroke if plate is disabled
  if (!slide.style.plate.enabled && slide.style.text.stroke) {
    ctx.strokeStyle = slide.style.text.stroke;
    ctx.lineWidth = (slide.style.text.strokeWidth || 2) * 2;
    ctx.strokeText(cleanTitle, centerX, textY);
  }

  ctx.fillText(cleanTitle, centerX, textY);

  // Draw body if exists
  if (cleanBody) {
    textY += (slide.style.text.fontSize * 2 * slide.style.text.lineHeight) / 2 + 30;
    ctx.font = `${slide.style.text.bodyFontWeight || slide.style.text.fontWeight - 200} ${(slide.style.text.bodyFontSize || slide.style.text.fontSize) * 1.2}px ${slide.style.text.fontFamily}`;
    
    // Wrap text
    const maxWidth = canvas.width * 0.85;
    const words = cleanBody.split(' ');
    let line = '';
    const lines: string[] = [];

    for (const word of words) {
      const testLine = line + word + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && line.length > 0) {
        lines.push(line);
        line = word + ' ';
      } else {
        line = testLine;
      }
    }
    lines.push(line);

    const lineHeight = (slide.style.text.bodyFontSize || slide.style.text.fontSize) * 1.2 * slide.style.text.lineHeight * 1.2;
    lines.forEach((line, i) => {
      const y = textY + i * lineHeight;
      if (!slide.style.plate.enabled && slide.style.text.stroke) {
        ctx.strokeStyle = slide.style.text.stroke;
        ctx.lineWidth = ((slide.style.text.strokeWidth || 2) * 0.75) * 2;
        ctx.strokeText(line, centerX, y);
      }
      ctx.fillText(line, centerX, y);
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
  const ffmpeg = await initFFmpeg();
  
  onProgress(5, "Initializing video renderer...");

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;

  let backgroundVideo: HTMLVideoElement | undefined;
  
  // Load background video if available
  if (backgroundAsset) {
    backgroundVideo = document.createElement("video");
    backgroundVideo.src = backgroundAsset.url;
    backgroundVideo.muted = true;
    await new Promise((resolve) => {
      backgroundVideo!.onloadeddata = resolve;
    });
  }

  onProgress(10, "Rendering slides...");

  // Render each slide as images
  const frameRate = 30;
  let currentTime = 0;

  for (let slideIndex = 0; slideIndex < slides.length; slideIndex++) {
    const slide = slides[slideIndex];
    const slideDuration = slide.durationSec;
    const totalFrames = Math.floor(slideDuration * frameRate);

    for (let frame = 0; frame < totalFrames; frame++) {
      if (backgroundVideo) {
        const videoTime = (currentTime + frame / frameRate) % backgroundVideo.duration;
        backgroundVideo.currentTime = videoTime;
        await new Promise((resolve) => {
          backgroundVideo!.onseeked = resolve;
        });
      }

      renderSlideToCanvas(slide, canvas, backgroundVideo);

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.95);
      });

      const frameNumber = String(Math.floor(currentTime * frameRate) + frame).padStart(6, "0");
      await ffmpeg.writeFile(`frame${frameNumber}.jpg`, await fetchFile(blob));
    }

    currentTime += slideDuration;
    onProgress(10 + (slideIndex + 1) / slides.length * 70, `Rendered slide ${slideIndex + 1}/${slides.length}`);
  }

  onProgress(85, "Encoding video...");

  // Encode video
  await ffmpeg.exec([
    "-framerate", String(frameRate),
    "-pattern_type", "glob",
    "-i", "*.jpg",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-preset", "medium",
    "-crf", "23",
    "-s", "1080x1920",
    "output.mp4"
  ]);

  onProgress(95, "Finalizing...");

  const data = await ffmpeg.readFile("output.mp4");
  const videoBlob = new Blob([data], { type: "video/mp4" });

  // Cleanup
  const files = await ffmpeg.listDir("/");
  for (const file of files) {
    if (file.name.endsWith(".jpg") || file.name === "output.mp4") {
      await ffmpeg.deleteFile(file.name);
    }
  }

  onProgress(100, "Complete!");
  return videoBlob;
};
