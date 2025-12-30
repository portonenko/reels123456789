import { Slide, Asset } from "@/types";
import { renderSlideText } from "./canvasTextRenderer";
import JSZip from "jszip";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

// ============================================================
// EXPORT SETTINGS (STRICT)
// ============================================================
const FIXED_DURATION_SEC = 15.0;
const FPS = 30;
const WIDTH = 1080;
const HEIGHT = 1920;
const VIDEO_BITRATE = "12M"; // 12 Mbps - High Quality
const AUDIO_BITRATE = "192k";
const AUDIO_SAMPLE_RATE = 48000;

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

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;

const getFFmpeg = async (): Promise<FFmpeg> => {
  if (ffmpegInstance && ffmpegInstance.loaded) {
    console.log("[FFmpeg] Using cached instance");
    return ffmpegInstance;
  }

  if (ffmpegLoadPromise) {
    console.log("[FFmpeg] Waiting for existing load...");
    return ffmpegLoadPromise;
  }

  console.log("[FFmpeg] Starting fresh load...");

  ffmpegLoadPromise = (async (): Promise<FFmpeg> => {
    const sources = [
      {
        name: "jsdelivr",
        coreURL: "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.js",
        wasmURL: "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.wasm",
      },
      {
        name: "unpkg",
        coreURL: "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.js",
        wasmURL: "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.wasm",
      },
    ] as const;

    let lastErr: unknown = null;

    for (const src of sources) {
      const ffmpeg = new FFmpeg();
      console.log(`[FFmpeg] Loading core from ${src.name}...`);

      try {
        await withTimeout(ffmpeg.load({ coreURL: src.coreURL, wasmURL: src.wasmURL }), 120_000, "FFmpeg shared load");
        console.log("[FFmpeg] Loaded successfully!");
        ffmpegInstance = ffmpeg;
        return ffmpeg;
      } catch (e) {
        lastErr = e;
        console.warn(`[FFmpeg] Load from ${src.name} failed:`, e);
      }
    }

    ffmpegInstance = null;
    throw new Error(`FFmpeg load failed: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
  })();

  try {
    return await ffmpegLoadPromise;
  } catch (e) {
    ffmpegLoadPromise = null;
    throw e;
  }
};

// -----------------------
// Helpers: stable media loading
// -----------------------

type LoadedBlob = { blob: Blob; objectUrl: string };

const fetchAsBlob = async (url: string, label: string): Promise<LoadedBlob> => {
  const controller = new AbortController();
  const t = window.setTimeout(() => controller.abort(), 60_000);

  try {
    const res = await fetch(url, { signal: controller.signal, cache: "force-cache" });
    if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    return { blob, objectUrl };
  } finally {
    window.clearTimeout(t);
  }
};

const waitForEvent = (el: HTMLElement, eventName: string, timeoutMs: number, label: string) =>
  withTimeout(
    new Promise<void>((resolve, reject) => {
      const onOk = () => {
        cleanup();
        resolve();
      };
      const onErr = () => {
        cleanup();
        reject(new Error(`${label}: failed (${eventName})`));
      };
      const cleanup = () => {
        el.removeEventListener(eventName, onOk as any);
        el.removeEventListener("error", onErr as any);
      };
      el.addEventListener(eventName, onOk as any, { once: true });
      el.addEventListener("error", onErr as any, { once: true });
    }),
    timeoutMs,
    label
  );

const createHiddenVideo = (src: string): HTMLVideoElement => {
  const v = document.createElement("video");
  v.src = src;
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.loop = true;

  v.style.position = "fixed";
  v.style.left = "-99999px";
  v.style.top = "-99999px";
  v.style.width = "1px";
  v.style.height = "1px";
  v.style.opacity = "0";
  v.style.pointerEvents = "none";
  document.body.appendChild(v);

  return v;
};

const createAudio = (src: string): HTMLAudioElement => {
  const a = document.createElement("audio");
  a.src = src;
  a.preload = "auto";
  a.loop = true;
  return a;
};

// -----------------------
// Localization guard (ENERGIA)
// -----------------------

const energiaReplacementForLang = (lang?: string): string | null => {
  switch ((lang || "").toLowerCase()) {
    case "en":
      return "energy";
    case "de":
      return "energie";
    case "pl":
      return "Energia";
    default:
      return null;
  }
};

const applyEnergiaRuleToSlides = (slides: Slide[]): Slide[] => {
  const replacement = energiaReplacementForLang(slides?.[0]?.language);
  if (!replacement) return slides;
  return slides.map((s) => ({
    ...s,
    title: (s.title || "").replace(/ENERGIA/gi, replacement),
    body: s.body ? s.body.replace(/ENERGIA/gi, replacement) : s.body,
  }));
};

// -----------------------
// FFmpeg encoding: H.264 MP4 @ 12Mbps, 30fps CFR, FIXED 15 seconds
// -----------------------

const buildEncodeArgs = (): string[] => {
  // Force all layers to exactly 15 seconds with proper CFR timing
  const vf =
    `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,` +
    `crop=${WIDTH}:${HEIGHT},` +
    "setsar=1," +
    `fps=${FPS},` +
    `setpts=N/${FPS}/TB`;

  return [
    // Input
    "-i", "input.webm",

    // Hard trim to EXACTLY 15 seconds
    "-t", FIXED_DURATION_SEC.toFixed(1),
    "-ss", "0",

    // Video: H.264, 12 Mbps, CFR 30fps
    "-vf", vf,
    "-c:v", "libx264",
    "-preset", "medium", // Better quality than ultrafast
    "-profile:v", "high",
    "-level", "4.1",
    "-pix_fmt", "yuv420p",
    "-r", String(FPS),
    "-vsync", "cfr",
    "-g", String(FPS), // keyframe interval = 1 second
    "-bf", "2", // B-frames for better compression
    "-b:v", VIDEO_BITRATE,
    "-maxrate", VIDEO_BITRATE,
    "-bufsize", "24M", // 2x bitrate for buffer

    // Audio: AAC 192kbps, 48kHz
    "-map", "0:v:0",
    "-map", "0:a?",
    "-c:a", "aac",
    "-ar", String(AUDIO_SAMPLE_RATE),
    "-b:a", AUDIO_BITRATE,
    "-t", FIXED_DURATION_SEC.toFixed(1), // Trim audio too

    // MP4 container optimizations for looping
    "-movflags", "+faststart+frag_keyframe",
    "-brand", "mp42",

    // Output
    "output.mp4",
  ];
};

const encodeToMp4 = async (
  inputBlob: Blob,
  onProgress: (progress: number, message: string) => void
): Promise<Blob> => {
  onProgress(92, "Загрузка FFmpeg...");
  const ffmpeg = await getFFmpeg();

  onProgress(94, "Подготовка к конвертации...");
  await ffmpeg.writeFile("input.webm", await fetchFile(inputBlob));

  try {
    onProgress(95, `Кодирование H.264 @ ${VIDEO_BITRATE}...`);
    console.log("[FFmpeg] Encoding with args:", buildEncodeArgs().join(" "));
    
    await withTimeout(
      ffmpeg.exec(buildEncodeArgs()),
      600_000, // 10 minutes max for high quality encoding
      "FFmpeg encode"
    );

    onProgress(99, "Финализация MP4...");
    const data = await ffmpeg.readFile("output.mp4");
    const mp4Blob = new Blob([data as any], { type: "video/mp4" });
    
    console.log(`[FFmpeg] Output size: ${(mp4Blob.size / 1024 / 1024).toFixed(2)} MB`);
    return mp4Blob;
  } finally {
    try { await ffmpeg.deleteFile("input.webm"); } catch { /* ignore */ }
    try { await ffmpeg.deleteFile("output.mp4"); } catch { /* ignore */ }
  }
};

const prepareCanvasContext = (canvas: HTMLCanvasElement): CanvasRenderingContext2D | null => {
  const ctx = canvas.getContext("2d", {
    alpha: false,
    desynchronized: true,
    willReadFrequently: false,
  });
  if (!ctx) return null;

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

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(offsetX, 0);
  ctx.filter = filterValue;

  if (backgroundMedia) {
    ctx.drawImage(backgroundMedia, 0, 0, canvas.width, canvas.height);
  } else {
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#581c87");
    gradient.addColorStop(0.5, "#1e3a8a");
    gradient.addColorStop(1, "#155e75");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const styleOverlay = (slide.style as any)?.overlay?.opacity;
  const overlayOpacity =
    typeof styleOverlay === "number"
      ? Math.min(1, Math.max(0, styleOverlay))
      : Math.min(1, Math.max(0, (globalOverlay ?? 30) / 100));

  ctx.fillStyle = `rgba(0, 0, 0, ${overlayOpacity})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  renderSlideText(ctx, slide, canvas);

  ctx.restore();
};

// Calculate slide timing for FIXED 15 second duration
const calculateSlideTiming = (slides: Slide[]): { start: number; end: number }[] => {
  const totalOriginal = slides.reduce((sum, s) => sum + s.durationSec, 0);
  const scale = totalOriginal > 0 ? FIXED_DURATION_SEC / totalOriginal : 1;
  
  let acc = 0;
  return slides.map((s) => {
    const start = acc;
    const duration = s.durationSec * scale;
    acc += duration;
    return { start, end: Math.min(acc, FIXED_DURATION_SEC) };
  });
};

export const exportVideo = async (
  slidesInput: Slide[],
  backgroundAsset: Asset | null,
  onProgress: (progress: number, message: string) => void,
  backgroundMusicUrl?: string,
  globalOverlay?: number
): Promise<Blob> => {
  console.log(`[Export] Starting: ${WIDTH}x${HEIGHT} @ ${FPS}fps, ${FIXED_DURATION_SEC}s, ${VIDEO_BITRATE} bitrate`);
  onProgress(2, "Инициализация экспорта...");

  const slides = applyEnergiaRuleToSlides(slidesInput);
  const slideTiming = calculateSlideTiming(slides);

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const ctx = prepareCanvasContext(canvas);
  if (!ctx) throw new Error("Failed to initialize canvas context");

  onProgress(5, "Загрузка ассетов...");

  const totalFrames = FIXED_DURATION_SEC * FPS;
  const frameMs = 1000 / FPS;

  console.log(`[Export] Total frames: ${totalFrames} (${FIXED_DURATION_SEC}s @ ${FPS}fps)`);

  const needBackgroundVideo = !!(backgroundAsset?.url && backgroundAsset?.type !== "image");

  let bgVideoBlob: LoadedBlob | null = null;
  let bgAudioBlob: LoadedBlob | null = null;
  let backgroundVideo: HTMLVideoElement | undefined;
  let backgroundAudio: HTMLAudioElement | undefined;

  try {
    // Load background video
    if (needBackgroundVideo) {
      const url = backgroundAsset!.url;
      bgVideoBlob = await withTimeout(fetchAsBlob(url, "Background video"), 30_000, "Background video load");
      backgroundVideo = createHiddenVideo(bgVideoBlob.objectUrl);
      backgroundVideo.loop = true;
      await waitForEvent(backgroundVideo, "canplaythrough", 10_000, "Background video ready");
    }

    // Load background audio
    if (backgroundMusicUrl) {
      try {
        bgAudioBlob = await withTimeout(fetchAsBlob(backgroundMusicUrl, "Background audio"), 30_000, "Background audio load");
        backgroundAudio = createAudio(bgAudioBlob.objectUrl);
        backgroundAudio.loop = true;
        await waitForEvent(backgroundAudio as any, "canplaythrough", 10_000, "Audio ready");
      } catch (e) {
        console.warn("[Export] Audio load failed, continuing without audio:", e);
        bgAudioBlob = null;
        backgroundAudio = undefined;
      }
    }

    if (needBackgroundVideo && (!backgroundVideo || backgroundVideo.readyState < 4)) {
      throw new Error("Видео еще загружается");
    }

    onProgress(10, "Подготовка записи...");

    // Wait for fonts
    try {
      const fonts = (document as any).fonts as FontFaceSet | undefined;
      if (fonts?.ready) {
        await withTimeout(Promise.resolve(fonts.ready as any), 5_000, "Fonts ready");
      }
    } catch { /* ignore */ }

    // Preload FFmpeg
    void getFFmpeg().catch((e) => console.warn("[FFmpeg] Preload failed:", e));

    // Use WebM for recording (better timestamp stability)
    const mimeTypes = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];

    let mimeType = "";
    for (const mt of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mt)) {
        mimeType = mt;
        break;
      }
    }
    if (!mimeType) throw new Error("No supported WebM format found");

    console.log(`[Export] Recording format: ${mimeType}`);

    const videoStream = canvas.captureStream(FPS);
    const chunks: Blob[] = [];

    let combinedStream: MediaStream = videoStream;
    let audioContext: AudioContext | undefined;

    if (backgroundAudio) {
      try {
        audioContext = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE });
        const audioSource = audioContext.createMediaElementSource(backgroundAudio);
        const gainNode = audioContext.createGain();
        const audioDestination = audioContext.createMediaStreamDestination();
        audioSource.connect(gainNode);
        gainNode.connect(audioDestination);
        gainNode.gain.value = 0.9;

        combinedStream = new MediaStream([
          ...videoStream.getVideoTracks(),
          ...audioDestination.stream.getAudioTracks(),
        ]);
      } catch (error) {
        console.warn("[Export] Audio setup failed:", error);
        combinedStream = videoStream;
        backgroundAudio = undefined;
      }
    }

    // High bitrate for intermediate recording
    const recorderOptions: any = {
      mimeType,
      videoBitsPerSecond: 15_000_000, // 15 Mbps intermediate
      audioBitsPerSecond: 256_000,
    };

    const mediaRecorder = new MediaRecorder(combinedStream, recorderOptions);

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const recordingPromise = new Promise<Blob>((resolve, reject) => {
      mediaRecorder.onstop = () => {
        try { combinedStream.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
        if (audioContext) void audioContext.close();
        resolve(new Blob(chunks, { type: mimeType }));
      };
      mediaRecorder.onerror = (e) => reject(e);
    });

    // Ensure looping
    if (backgroundVideo) backgroundVideo.loop = true;
    if (backgroundAudio) backgroundAudio.loop = true;

    // Start media playback
    if (backgroundVideo) {
      backgroundVideo.currentTime = 0;
      try { await backgroundVideo.play(); } catch { /* ignore */ }
    }
    if (backgroundAudio) {
      backgroundAudio.currentTime = 0;
      try { await backgroundAudio.play(); } catch { /* ignore */ }
    }

    // Start recording with larger timeslice
    mediaRecorder.start(2000);

    const videoTrack = videoStream.getVideoTracks()[0];

    // Sequential frame rendering for stability
    const renderAllFrames = (): Promise<void> => {
      return new Promise((resolve, reject) => {
        let frame = 0;
        const startedAt = performance.now();

        const renderFrame = () => {
          try {
            // STOP EXACTLY at 15 seconds (450 frames @ 30fps)
            if (frame >= totalFrames) {
              console.log(`[Export] Rendering complete: ${frame} frames`);
              
              if (backgroundVideo) {
                try { backgroundVideo.pause(); } catch { /* ignore */ }
                try { backgroundVideo.remove(); } catch { /* ignore */ }
              }
              if (backgroundAudio) {
                try { backgroundAudio.pause(); } catch { /* ignore */ }
              }

              // Small delay before stopping recorder
              setTimeout(() => {
                mediaRecorder.stop();
                resolve();
              }, 100);
              return;
            }

            const elapsed = frame / FPS;

            // Progress update every ~30 frames
            if (frame % 30 === 0) {
              const percent = (frame / totalFrames) * 100;
              onProgress(
                10 + percent * 0.8,
                `Запись... ${percent.toFixed(0)}% (${elapsed.toFixed(1)}s / ${FIXED_DURATION_SEC}s)`
              );
            }

            // Keep media playing
            if (frame % 60 === 0) {
              if (backgroundVideo && backgroundVideo.paused) {
                try { void backgroundVideo.play(); } catch { /* ignore */ }
              }
              if (backgroundAudio && backgroundAudio.paused) {
                try { void backgroundAudio.play(); } catch { /* ignore */ }
              }
            }

            // Find current slide based on scaled timing
            let currentSlideIndex = 0;
            let slideStartTime = 0;
            for (let i = 0; i < slideTiming.length; i++) {
              if (elapsed >= slideTiming[i].start && elapsed < slideTiming[i].end) {
                currentSlideIndex = i;
                slideStartTime = slideTiming[i].start;
                break;
              }
              if (i === slideTiming.length - 1) {
                currentSlideIndex = i;
                slideStartTime = slideTiming[i].start;
              }
            }

            const slideElapsed = elapsed - slideStartTime;
            const transitionDuration = 0.5;
            const transitionProgress = Math.min(slideElapsed / transitionDuration, 1);

            renderSlideToCanvas(ctx, slides[currentSlideIndex], canvas, backgroundVideo, transitionProgress, globalOverlay);

            // Force frame capture
            try { (videoTrack as any)?.requestFrame?.(); } catch { /* ignore */ }

            frame++;

            // Schedule next frame at exact timing
            const nextAt = startedAt + frame * frameMs;
            const delay = Math.max(0, nextAt - performance.now());
            window.setTimeout(renderFrame, delay);
          } catch (err) {
            reject(err);
          }
        };

        renderFrame();
      });
    };

    await renderAllFrames();

    onProgress(90, "Финализация записи...");
    const recordedBlob = await recordingPromise;
    
    console.log(`[Export] Raw recording: ${(recordedBlob.size / 1024 / 1024).toFixed(2)} MB`);

    // Always re-encode to MP4 with strict settings
    const mp4Blob = await encodeToMp4(recordedBlob, onProgress);
    
    onProgress(100, "Готово!");
    console.log(`[Export] Final MP4: ${(mp4Blob.size / 1024 / 1024).toFixed(2)} MB`);
    
    return mp4Blob;
  } finally {
    try { if (bgVideoBlob?.objectUrl) URL.revokeObjectURL(bgVideoBlob.objectUrl); } catch { /* ignore */ }
    try { if (bgAudioBlob?.objectUrl) URL.revokeObjectURL(bgAudioBlob.objectUrl); } catch { /* ignore */ }
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
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const ctx = prepareCanvasContext(canvas);
  if (!ctx) {
    throw new Error("Failed to initialize canvas context");
  }

  let backgroundImage: HTMLImageElement | undefined;

  if (backgroundAsset && backgroundAsset.type === "image") {
    onProgress(10, "Loading background image...");
    backgroundImage = document.createElement("img");
    backgroundImage.src = backgroundAsset.url;
    if (!backgroundAsset.url.startsWith("blob:")) {
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
    const progressPercent = 20 + (i / totalSlides) * 70;
    onProgress(progressPercent, `Rendering slide ${i + 1}/${totalSlides}...`);

    renderSlideToCanvas(ctx, slide, canvas, backgroundImage, 1, globalOverlay);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error("Failed to create image blob"));
        },
        "image/png",
        1.0
      );
    });

    const fileName = `slide_${String(i + 1).padStart(3, "0")}.png`;
    zip.file(fileName, blob);
  }

  onProgress(90, "Creating ZIP archive...");
  const zipBlob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  onProgress(100, "Complete!");
  return zipBlob;
};
