import { Slide, Asset } from "@/types";
import { renderSlideText } from "./canvasTextRenderer";
import JSZip from "jszip";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let ffmpegInstance: FFmpeg | null = null;

const FFMPEG_CORE_VERSION = "0.12.6";
const BASE_URL = `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`;

type GetFFmpegOptions = {
  onProgress?: (msg: string) => void;
};

const withTimeout = async <T,>(p: Promise<T>, ms: number, label: string): Promise<T> => {
  let t: number | undefined;
  const timeout = new Promise<T>((_, reject) => {
    t = window.setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (t) window.clearTimeout(t);
  }
};

const getFFmpeg = async (opts: GetFFmpegOptions = {}): Promise<FFmpeg> => {
  if (ffmpegInstance && ffmpegInstance.loaded) {
    return ffmpegInstance;
  }

  const ffmpeg = new FFmpeg();

  ffmpeg.on("log", ({ message }) => {
    console.log("[FFmpeg]", message);
  });

  ffmpeg.on("progress", ({ progress }) => {
    if (opts.onProgress) opts.onProgress(`Converting: ${Math.round(progress * 100)}%`);
  });

  try {
    console.log("FFmpeg env", { crossOriginIsolated });

    // toBlobURL fetches the resources and converts to blob: URLs (avoids CORS headaches)
    const coreURL = await withTimeout(
      toBlobURL(`${BASE_URL}/ffmpeg-core.js`, "text/javascript"),
      15000,
      "FFmpeg core"
    );
    const wasmURL = await withTimeout(
      toBlobURL(`${BASE_URL}/ffmpeg-core.wasm`, "application/wasm"),
      15000,
      "FFmpeg wasm"
    );
    // In 0.12.x a separate worker file is required; without it you can get "failed to import ffmpeg-core.js"
    const workerURL = await withTimeout(
      toBlobURL(`${BASE_URL}/ffmpeg-core.worker.js`, "text/javascript"),
      15000,
      "FFmpeg worker"
    );

    await withTimeout(ffmpeg.load({ coreURL, wasmURL, workerURL }), 30000, "FFmpeg load");
  } catch (e) {
    console.error("FFmpeg load failed", { error: e, baseUrl: BASE_URL });
    const raw = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Конвертер MP4 не загрузился: ${raw}. Часто причина — блокировщик, корпоративный прокси или CSP.`
    );
  }

  ffmpegInstance = ffmpeg;
  return ffmpeg;
};

const prepareCanvasContext = (canvas: HTMLCanvasElement): CanvasRenderingContext2D | null => {
  const ctx = canvas.getContext("2d", {
    alpha: false,
    // Hint to browser this canvas is used for realtime capture
    desynchronized: true,
    willReadFrequently: false,
  });
  if (!ctx) return null;

  // Enable high-quality rendering once
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  (ctx as any).textRendering = "geometricPrecision";

  return ctx;
};

const renderSlideToCanvas = (
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  canvas: HTMLCanvasElement,
  backgroundMedia?: HTMLVideoElement | HTMLImageElement,
  transitionProgress?: number,
  globalOverlay?: number
): void => {
  // Calculate transition effects
  const progress = transitionProgress ?? 1;
  let opacity = 1;
  let offsetX = 0;
  let filterValue = "none";

  if (progress < 1 && slide.transition) {
    switch (slide.transition) {
      case "fade":
        opacity = progress;
        break;
      case "flash":
        if (progress < 0.3) {
          filterValue = `brightness(${1 + (3 - (progress / 0.3) * 3)})`;
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
          filterValue = `brightness(${1 + (5 - (progress / 0.2) * 5)})`;
          opacity = progress / 0.2;
        } else {
          opacity = 0.2 + (progress - 0.2) * 1.25;
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

  // Clear once per frame
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Save context for transitions
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(offsetX, 0);
  ctx.filter = filterValue;

  // Draw background (video or image)
  if (backgroundMedia) {
    ctx.drawImage(backgroundMedia, 0, 0, canvas.width, canvas.height);
  } else {
    // Gradient fallback
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#581c87");
    gradient.addColorStop(0.5, "#1e3a8a");
    gradient.addColorStop(1, "#155e75");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Apply overlay with globalOverlay value
  const overlayOpacity = (globalOverlay ?? 30) / 100;
  ctx.fillStyle = `rgba(0, 0, 0, ${overlayOpacity})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Use unified text rendering
  renderSlideText(ctx, slide, canvas);

  // Restore context after transitions
  ctx.restore();
};

export const exportVideo = async (
  slides: Slide[],
  backgroundAsset: Asset | null,
  onProgress: (progress: number, message: string) => void,
  backgroundMusicUrl?: string,
  globalOverlay?: number
): Promise<Blob> => {
  onProgress(5, "Initializing video recorder...");

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;

  const ctx = prepareCanvasContext(canvas);
  if (!ctx) {
    throw new Error("Failed to initialize canvas context");
  }

  let backgroundVideo: HTMLVideoElement | undefined;
  let backgroundVideoAlt: HTMLVideoElement | undefined;
  let backgroundAudio: HTMLAudioElement | undefined;
  
  // Load background video if available
  if (backgroundAsset) {
    backgroundVideo = document.createElement("video");
    backgroundVideo.src = backgroundAsset.url;
    backgroundVideo.muted = true;
    backgroundVideo.loop = false; // we'll handle looping ourselves to avoid playback hiccups
    backgroundVideo.playsInline = true;

    // Don't set crossOrigin for blob URLs as it causes CORS issues
    if (!backgroundAsset.url.startsWith('blob:')) {
      backgroundVideo.crossOrigin = "anonymous";
    }

    // Preload a second instance for seamless looping during export
    backgroundVideoAlt = document.createElement("video");
    backgroundVideoAlt.src = backgroundAsset.url;
    backgroundVideoAlt.muted = true;
    backgroundVideoAlt.loop = false;
    backgroundVideoAlt.playsInline = true;
    if (!backgroundAsset.url.startsWith('blob:')) {
      backgroundVideoAlt.crossOrigin = "anonymous";
    }

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        backgroundVideo!.onloadeddata = () => resolve();
        backgroundVideo!.onerror = (e) => {
          console.error("Video loading error:", e);
          reject(new Error("Failed to load background video"));
        };
        backgroundVideo!.load();
      }),
      new Promise<void>((resolve, reject) => {
        backgroundVideoAlt!.onloadeddata = () => resolve();
        backgroundVideoAlt!.onerror = (e) => {
          console.error("Video loading error (alt):", e);
          // If alt fails, continue with single video
          backgroundVideoAlt = undefined;
          resolve();
        };
        backgroundVideoAlt!.load();
      }),
    ]);
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

  // MP4 only (H.264 + AAC) as requested.
  const mimeType = "video/mp4;codecs=avc1.42E01E,mp4a.40.2";
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    throw new Error(
      "Ваш браузер не поддерживает запись MP4 (H.264) через MediaRecorder. Попробуйте Chrome/Edge или включите аппаратное ускорение."
    );
  }

  console.log("Using video format:", mimeType);

  // Create MediaRecorder with optimized settings for high quality
  // Use 30 FPS to match preview smoothness.
  const exportFps = 30;
  const videoStream = canvas.captureStream(exportFps);
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
  
  // Calculate total duration for adaptive settings
  const totalDuration = slides.reduce((sum, s) => sum + s.durationSec, 0);

  // Keep bitrate high and constant to match preview sharpness and reduce motion artifacts.
  const videoBitrate = 12000000; // 12 Mbps

  const recorderOptions: any = {
    mimeType,
    videoBitsPerSecond: videoBitrate,
    audioBitsPerSecond: 192000,
  };
  
  const mediaRecorder = new MediaRecorder(combinedStream, recorderOptions);
  console.log('MediaRecorder configured:', recorderOptions);

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      chunks.push(e.data);
      console.log(`Recording chunk: ${(e.data.size / 1024 / 1024).toFixed(2)} MB, Total chunks: ${chunks.length}`);
    }
  };

  const recordingPromise = new Promise<Blob>((resolve, reject) => {
    mediaRecorder.onstop = () => {
      try {
        // Stop any remaining media tracks to avoid leaking resources between exports
        combinedStream.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }

      // Clean up audio context
      if (audioContext) {
        audioContext.close();
      }

      const blob = new Blob(chunks, { type: mimeType });
      console.log(`Final video size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Video format: ${mimeType}`);
      console.log(`Total chunks: ${chunks.length}`);
      resolve(blob);
    };
    mediaRecorder.onerror = (e) => {
      console.error("MediaRecorder error:", e);
      reject(e);
    };
  });

  // Start background video and audio FIRST - before recording
  // For videos that need to loop within the export duration, we use two elements and swap,
  // which avoids a hard seek on the same element right at the loop boundary (often causes a visible hitch).
  const bgDuration =
    backgroundVideo?.duration && isFinite(backgroundVideo.duration) ? backgroundVideo.duration : undefined;

  const needsLoop = !!bgDuration && slides.some((s) => s.durationSec > bgDuration);

  if (backgroundVideo) {
    backgroundVideo.currentTime = 0;
    await backgroundVideo.play();
    await new Promise((resolve) => setTimeout(resolve, 100));
    console.log("Background video playing at:", backgroundVideo.currentTime, "duration:", bgDuration);

    // Only use the dual-video seamless loop strategy when we actually need to loop.
    if (needsLoop && backgroundVideoAlt && bgDuration) {
      backgroundVideoAlt.currentTime = 0;
      // Start alt playing too so decoder is warm; we'll choose which one to draw per frame.
      await backgroundVideoAlt.play();
      await new Promise((resolve) => setTimeout(resolve, 100));
      console.log("Background video (alt) playing at:", backgroundVideoAlt.currentTime);
    } else {
      backgroundVideoAlt = undefined;
    }
  }

  if (backgroundAudio) {
    backgroundAudio.currentTime = 0;
    await backgroundAudio.play();
    await new Promise((resolve) => setTimeout(resolve, 100));
    console.log("Background audio playing at:", backgroundAudio.currentTime);
  }

  // Now start recording after media is playing
  // IMPORTANT: do not use timeslice/chunking here — some players stutter on fragmented recordings.
  mediaRecorder.start();
  console.log("MediaRecorder started with format:", mimeType, "bitrate:", videoBitrate);

  const startTime = performance.now();
  let currentSlideIndex = 0;
  let slideStartTime = 0;

  const fps = exportFps;
  const frameMs = 1000 / fps;
  const totalFrames = Math.max(1, Math.round(totalDuration * fps));

  // Render loop:
  // Drive rendering by frame index (not performance.now-derived elapsed) so timing is deterministic
  // and the captured stream is closer to constant-frame-rate.
  const runFixedFpsRenderLoop = async () => {
    for (let frame = 0; frame < totalFrames; frame++) {
      const targetAt = startTime + frame * frameMs;
      const waitMs = Math.max(0, targetAt - performance.now());
      if (waitMs > 0) {
        await new Promise((r) => setTimeout(r, waitMs));
      } else {
        // If we're behind, yield to avoid blocking the main thread.
        await new Promise((r) => setTimeout(r, 0));
      }

      const elapsed = frame / fps;

      // Update progress (throttle a bit)
      if (frame % Math.max(1, Math.floor(fps / 2)) === 0) {
        const progressPercent = (elapsed / totalDuration) * 100;
        onProgress(10 + progressPercent * 0.85, `Recording slide ${currentSlideIndex + 1}/${slides.length}...`);
      }

      // Find current slide
      let accumulatedTime = 0;
      for (let i = 0; i < slides.length; i++) {
        if (elapsed < accumulatedTime + slides[i].durationSec) {
          currentSlideIndex = i;
          slideStartTime = accumulatedTime;
          break;
        }
        accumulatedTime += slides[i].durationSec;
      }

      // Render slide with transition
      const slideElapsed = elapsed - slideStartTime;
      const transitionDuration = 0.5;
      const transitionProgress = Math.min(slideElapsed / transitionDuration, 1);

      // Pick which background video element to draw (only if looping is needed)
      let activeBackgroundVideo: HTMLVideoElement | undefined = backgroundVideo;
      if (needsLoop && backgroundVideo && backgroundVideoAlt && bgDuration && bgDuration > 0.1) {
        const segmentIndex = Math.floor(elapsed / bgDuration);
        const inSegmentTime = elapsed - segmentIndex * bgDuration;
        activeBackgroundVideo = segmentIndex % 2 === 0 ? backgroundVideo : backgroundVideoAlt;

        // If we just entered a new segment, reset the next video slightly ahead of time
        // so we don't seek on the currently-drawn element at the exact boundary.
        if (inSegmentTime < frameMs / 1000 + 0.01) {
          const nextVideo = segmentIndex % 2 === 0 ? backgroundVideoAlt : backgroundVideo;
          try {
            // Ensure the next one is at the beginning and playing.
            if (Math.abs(nextVideo.currentTime - 0) > 0.05) nextVideo.currentTime = 0;
            if (nextVideo.paused) void nextVideo.play();
          } catch {
            // ignore
          }
        }
      }

      renderSlideToCanvas(
        ctx,
        slides[currentSlideIndex],
        canvas,
        activeBackgroundVideo,
        transitionProgress,
        globalOverlay
      );
    }

    if (backgroundVideo) backgroundVideo.pause();
    if (backgroundVideoAlt) backgroundVideoAlt.pause();
    if (backgroundAudio) backgroundAudio.pause();

    // Give the recorder a tiny moment to flush the last painted frame
    await new Promise((r) => setTimeout(r, 150));
    mediaRecorder.stop();

    console.log("Recording completed at:", (totalFrames / fps).toFixed(2), "seconds");
  };

  // Start render loop
  void runFixedFpsRenderLoop();

  onProgress(90, "Finishing recording...");
  const rawBlob = await recordingPromise;

  onProgress(92, "Loading video converter...");
  const ffmpeg = await getFFmpeg({
    onProgress: (msg) => onProgress(93, msg),
  });

  const inputName = "input.mp4";
  const outputName = "output.mp4";

  await ffmpeg.writeFile(inputName, await fetchFile(rawBlob));

  onProgress(94, "Converting to MP4...");
  await ffmpeg.exec([
    "-i",
    inputName,

    // Video
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",

    // Force CFR 30fps
    "-r",
    "30",
    "-fps_mode",
    "cfr",

    // Keep output sharp and avoid excessive bitrate spikes
    "-maxrate",
    "15000k",
    "-bufsize",
    "30000k",

    // Audio
    "-c:a",
    "aac",
    "-b:a",
    "192k",

    // Close file cleanly at the end of the shortest stream (prevents end-hang)
    "-shortest",

    "-movflags",
    "+faststart",
    outputName,
  ]);

  const data = await ffmpeg.readFile(outputName);
  const mp4Blob = new Blob([data as unknown as BlobPart], { type: "video/mp4" });

  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);

  console.log(`Final MP4 size: ${(mp4Blob.size / 1024 / 1024).toFixed(2)} MB`);

  onProgress(100, "Complete!");
  return mp4Blob;
};

export const exportPhotos = async (
  slides: Slide[],
  backgroundAsset: Asset | null,
  onProgress: (progress: number, message: string) => void,
  globalOverlay?: number
): Promise<Blob> => {
  onProgress(5, "Preparing photo export...");

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;

  const ctx = prepareCanvasContext(canvas);
  if (!ctx) {
    throw new Error("Failed to initialize canvas context");
  }

  let backgroundImage: HTMLImageElement | undefined;
  
  // Load background image if available
  if (backgroundAsset && backgroundAsset.type === 'image') {
    onProgress(10, "Loading background image...");
    backgroundImage = document.createElement("img");
    backgroundImage.src = backgroundAsset.url;
    if (!backgroundAsset.url.startsWith('blob:')) {
      backgroundImage.crossOrigin = "anonymous";
    }
    await new Promise((resolve, reject) => {
      backgroundImage!.onload = resolve;
      backgroundImage!.onerror = (e) => {
        console.error("Image loading error:", e);
        reject(new Error("Failed to load background image"));
      };
    });
  }

  onProgress(20, "Rendering slides...");

  const zip = new JSZip();
  const totalSlides = slides.length;

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const progressPercent = 20 + ((i / totalSlides) * 70);
    onProgress(progressPercent, `Rendering slide ${i + 1}/${totalSlides}...`);

    // Render slide to canvas
    renderSlideToCanvas(ctx, slide, canvas, backgroundImage, 1, globalOverlay);

    // Convert canvas to blob
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error("Failed to create image blob"));
        },
        'image/png',
        1.0
      );
    });

    // Add to ZIP with slide number
    const fileName = `slide_${String(i + 1).padStart(3, '0')}.png`;
    zip.file(fileName, blob);
  }

  onProgress(90, "Creating ZIP archive...");
  const zipBlob = await zip.generateAsync({ 
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 }
  });

  onProgress(100, "Complete!");
  return zipBlob;
};

