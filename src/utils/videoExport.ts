import { Slide, Asset } from "@/types";
import { renderSlideText } from "./canvasTextRenderer";
import JSZip from "jszip";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoading: Promise<FFmpeg> | null = null;

const withTimeout = async <T,>(p: Promise<T>, ms: number, label: string): Promise<T> => {
  let t: number | undefined;
  const timeout = new Promise<T>((_, reject) => {
    t = window.setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (t) window.clearTimeout(t);
  }
};

const getFFmpeg = async (): Promise<FFmpeg> => {
  // Already loaded
  if (ffmpegInstance && ffmpegInstance.loaded) {
    console.log("[FFmpeg] Using cached instance");
    return ffmpegInstance;
  }

  // Loading in progress - wait for it
  if (ffmpegLoading) {
    console.log("[FFmpeg] Waiting for loading in progress...");
    return ffmpegLoading;
  }

  console.log("[FFmpeg] Starting fresh load...");

  const loadFFmpeg = async (): Promise<FFmpeg> => {
    const ffmpeg = new FFmpeg();

    // Some networks block certain CDNs; try a small list.
    const baseUrls = [
      "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd",
      "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd",
    ];

    let lastErr: unknown;

    for (const baseURL of baseUrls) {
      console.log("[FFmpeg] Loading from:", baseURL);
      try {
        await withTimeout(
          ffmpeg.load({
            coreURL: `${baseURL}/ffmpeg-core.js`,
            wasmURL: `${baseURL}/ffmpeg-core.wasm`,
          }),
          180_000, // slower networks/devices
          "FFmpeg load"
        );
        console.log("[FFmpeg] Loaded successfully!");
        ffmpegInstance = ffmpeg;
        return ffmpeg;
      } catch (e) {
        console.error("[FFmpeg] Load failed:", e);
        lastErr = e;
      }
    }

    ffmpegInstance = null;
    throw lastErr instanceof Error ? lastErr : new Error("FFmpeg load failed");
  };

  ffmpegLoading = loadFFmpeg();

  try {
    const result = await ffmpegLoading;
    return result;
  } finally {
    ffmpegLoading = null;
  }
};

const convertToMp4 = async (
  webmBlob: Blob,
  onProgress: (progress: number, message: string) => void
): Promise<Blob> => {
  console.log(
    "[FFmpeg] Starting MP4 conversion, WebM size:",
    (webmBlob.size / 1024 / 1024).toFixed(2),
    "MB"
  );
  onProgress(96, "Loading video converter...");

  const ffmpeg = await getFFmpeg();

  onProgress(97, "Converting to MP4...");

  console.log("[FFmpeg] Writing input file...");
  const inputData = await fetchFile(webmBlob);
  await ffmpeg.writeFile("input.webm", inputData);

  console.log("[FFmpeg] Running conversion...");
  // Convert WebM to MP4 with H.264 codec
  await withTimeout(
    ffmpeg.exec([
      "-i",
      "input.webm",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "23",
      "-pix_fmt",
      "yuv420p",
      "-r",
      "30",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      "output.mp4",
    ]),
    180_000,
    "FFmpeg convert"
  );

  onProgress(99, "Finalizing MP4...");

  console.log("[FFmpeg] Reading output file...");
  const data = await ffmpeg.readFile("output.mp4");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mp4Blob = new Blob([data as any], { type: "video/mp4" });

  console.log(
    "[FFmpeg] Conversion complete! MP4 size:",
    (mp4Blob.size / 1024 / 1024).toFixed(2),
    "MB"
  );

  // Clean up
  await ffmpeg.deleteFile("input.webm");
  await ffmpeg.deleteFile("output.mp4");

  return mp4Blob;
};

const normalizeMp4 = async (
  mp4Blob: Blob,
  onProgress: (progress: number, message: string) => void
): Promise<Blob> => {
  console.log(
    "[FFmpeg] Normalizing MP4 (re-encode for stable timestamps), size:",
    (mp4Blob.size / 1024 / 1024).toFixed(2),
    "MB"
  );
  onProgress(96, "Optimizing MP4 playback...");

  const ffmpeg = await getFFmpeg();

  onProgress(97, "Re-encoding MP4...");

  const inputData = await fetchFile(mp4Blob);
  await ffmpeg.writeFile("input.mp4", inputData);

  await withTimeout(
    ffmpeg.exec([
      "-i",
      "input.mp4",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "23",
      "-pix_fmt",
      "yuv420p",
      "-r",
      "30",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      "output.mp4",
    ]),
    240_000,
    "FFmpeg normalize"
  );

  onProgress(99, "Finalizing MP4...");

  const data = await ffmpeg.readFile("output.mp4");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const outBlob = new Blob([data as any], { type: "video/mp4" });

  await ffmpeg.deleteFile("input.mp4");
  await ffmpeg.deleteFile("output.mp4");

  return outBlob;
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

  // Apply overlay
  // Prefer per-slide preset overlay (slide.style.overlay.opacity in range 0..1)
  // Fallback to globalOverlay (0..100, default 30)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const styleOverlay = (slide.style as any)?.overlay?.opacity;
  const overlayOpacity =
    typeof styleOverlay === "number"
      ? Math.min(1, Math.max(0, styleOverlay))
      : Math.min(1, Math.max(0, (globalOverlay ?? 30) / 100));

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

  console.log("exportVideo called with:", {
    slidesCount: slides.length,
    backgroundAsset: backgroundAsset ? { id: backgroundAsset.id, url: backgroundAsset.url?.substring(0, 50) + "...", type: backgroundAsset.type } : null,
    hasMusicUrl: !!backgroundMusicUrl,
    globalOverlay,
  });

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;

  const ctx = prepareCanvasContext(canvas);
  if (!ctx) {
    throw new Error("Failed to initialize canvas context");
  }

  let backgroundVideo: HTMLVideoElement | undefined;
  let backgroundAudio: HTMLAudioElement | undefined;
  
  // Load background video if available
  if (backgroundAsset && backgroundAsset.url) {
    console.log("Loading background video from:", backgroundAsset.url);
    backgroundVideo = document.createElement("video");
    backgroundVideo.src = backgroundAsset.url;
    backgroundVideo.muted = true;
    backgroundVideo.playsInline = true;
    backgroundVideo.preload = "auto";
    backgroundVideo.loop = true;

    // Keep decoder active during capture: attach as hidden element.
    backgroundVideo.style.position = "fixed";
    backgroundVideo.style.left = "-99999px";
    backgroundVideo.style.top = "-99999px";
    backgroundVideo.style.width = "1px";
    backgroundVideo.style.height = "1px";
    backgroundVideo.style.opacity = "0";
    backgroundVideo.style.pointerEvents = "none";
    document.body.appendChild(backgroundVideo);

    if (!backgroundAsset.url.startsWith("blob:")) {
      backgroundVideo.crossOrigin = "anonymous";
    }

    try {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.warn("Video loading timeout after 10s");
          reject(new Error("Video loading timeout"));
        }, 10000);

        backgroundVideo!.onloadeddata = () => {
          clearTimeout(timeout);
          console.log("Background video loaded successfully");
          resolve(null);
        };
        backgroundVideo!.onerror = (e) => {
          clearTimeout(timeout);
          console.error("Video loading error:", e);
          reject(new Error("Failed to load background video"));
        };
        backgroundVideo!.load();
      });
    } catch (videoError) {
      console.error("Failed to load background video, continuing without it:", videoError);
      try {
        backgroundVideo?.remove();
      } catch {
        // ignore
      }
      backgroundVideo = undefined;
    }
  } else {
    console.warn("No background asset provided, will use gradient fallback");
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

  // Calculate total duration early (we also use it to choose the most stable recording mode)
  const totalDuration = slides.reduce((sum, s) => sum + s.durationSec, 0);

  // Native MP4 from MediaRecorder is known to produce broken timestamps on longer recordings
  // in some browsers, which can freeze playback around ~15s. Prefer WebM and convert when possible.
  const preferWebmForStability = totalDuration >= 12;

  // Try to record directly as MP4 (H.264) only for short clips
  // Otherwise prefer WebM (more stable), then convert to MP4 when converter is available.
  const mp4MimeTypes = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2", // H.264 Baseline + AAC
    "video/mp4;codecs=avc1.4D401E,mp4a.40.2", // H.264 Main + AAC
    "video/mp4;codecs=avc1.64001E,mp4a.40.2", // H.264 High + AAC
    "video/mp4", // Generic MP4
  ];

  let mimeType = "";
  let recordingAsMp4 = false;

  if (!preferWebmForStability) {
    for (const mt of mp4MimeTypes) {
      if (MediaRecorder.isTypeSupported(mt)) {
        mimeType = mt;
        recordingAsMp4 = true;
        console.log("Browser supports native MP4 recording:", mt);
        break;
      }
    }
  } else {
    console.log("Preferring WebM for stability (duration:", totalDuration, "s)");
  }

  // Fallback to WebM if MP4 not selected/supported
  if (!mimeType) {
    if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")) {
      mimeType = "video/webm;codecs=vp8,opus";
    } else if (MediaRecorder.isTypeSupported("video/webm")) {
      mimeType = "video/webm";
    } else {
      throw new Error("No supported video format found");
    }
    console.log("Using WebM format:", mimeType);
  }

  console.log("Using video format:", mimeType, "| Native MP4:", recordingAsMp4);

  // Create MediaRecorder with optimized settings for high quality
  const videoStream = canvas.captureStream(30); // 30 FPS for smooth, high-quality video
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
  // totalDuration is calculated earlier (used for stability + adaptive settings)
  // Adaptive bitrate based on video duration
  const videoBitrate = totalDuration > 30 ? 4000000 : totalDuration > 15 ? 6000000 : 8000000;

  const recorderOptions: any = {
    mimeType,
    videoBitsPerSecond: videoBitrate,
    audioBitsPerSecond: 128000,
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
  if (backgroundVideo) {
    backgroundVideo.currentTime = 0;
    await backgroundVideo.play();
    // Wait for video to actually start playing
    await new Promise((resolve) => setTimeout(resolve, 100));
    console.log("Background video playing at:", backgroundVideo.currentTime);
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

  const fps = 30;
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

      // Keep background video looping without stutter in the recording.
      // IMPORTANT: Avoid seeking every frame (that causes immediate stutter).
      // We only pre-emptively wrap very close to the end where browsers often freeze the last frame.
      if (backgroundVideo && Number.isFinite(backgroundVideo.duration) && backgroundVideo.duration > 0) {
        const d = backgroundVideo.duration;
        const nearEnd = backgroundVideo.currentTime >= d - 0.15;

        if (backgroundVideo.ended || nearEnd) {
          try {
            backgroundVideo.currentTime = 0;
            void backgroundVideo.play();
          } catch {
            // ignore
          }
        } else if (backgroundVideo.paused) {
          try {
            void backgroundVideo.play();
          } catch {
            // ignore
          }
        }
      }

      renderSlideToCanvas(ctx, slides[currentSlideIndex], canvas, backgroundVideo, transitionProgress, globalOverlay);
    }

    if (backgroundVideo) {
      backgroundVideo.pause();
      try {
        backgroundVideo.remove();
      } catch {
        // ignore
      }
    }
    if (backgroundAudio) backgroundAudio.pause();

    // Give the recorder a tiny moment to flush the last painted frame
    await new Promise((r) => setTimeout(r, 150));
    mediaRecorder.stop();

    console.log("Recording completed at:", (totalFrames / fps).toFixed(2), "seconds");
  };

  // Start render loop
  void runFixedFpsRenderLoop();

  onProgress(95, "Finalizing recording...");
  const recordedBlob = await recordingPromise;

  // If we recorded as MP4, normalize it for stable playback (fixes stutter on some players)
  if (recordingAsMp4) {
    console.log(`Recorded native MP4: ${(recordedBlob.size / 1024 / 1024).toFixed(2)} MB`);
    try {
      const normalized = await normalizeMp4(recordedBlob, onProgress);
      onProgress(100, "Complete!");
      return normalized;
    } catch (err) {
      console.warn("MP4 normalization failed, returning original MP4:", err);
      onProgress(100, "Complete!");
      return recordedBlob;
    }
  }

  // Otherwise we have WebM and need to convert to MP4
  try {
    console.log("Converting WebM to MP4...");
    const mp4Blob = await convertToMp4(recordedBlob, onProgress);
    console.log(`Converted to MP4: ${(mp4Blob.size / 1024 / 1024).toFixed(2)} MB`);
    onProgress(100, "Complete!");
    return mp4Blob;
  } catch (err) {
    console.error("MP4 conversion failed, falling back to WebM:", err);
    onProgress(100, "Complete (WebM fallback)!");
    return recordedBlob;
  }
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

