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

// Try multiple CDNs to fetch FFmpeg core files
const fetchToBlobURL = async (urls: string[], mimeType: string): Promise<string> => {
  let lastError: Error | null = null;

  for (const url of urls) {
    try {
      console.log(`[FFmpeg] Trying: ${url}`);

      const controller = new AbortController();
      // Some CDNs are slow for large .wasm files; keep this generous.
      const t = window.setTimeout(() => controller.abort(), 120_000);

      const response = await fetch(url, { signal: controller.signal });
      window.clearTimeout(t);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      console.log(`[FFmpeg] Success: ${url}`);
      return URL.createObjectURL(new Blob([blob], { type: mimeType }));
    } catch (e) {
      console.warn(`[FFmpeg] Failed ${url}:`, e);
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw lastError || new Error("All CDN sources failed");
};

const getFFmpeg = async (): Promise<FFmpeg> => {
  // Already loaded
  if (ffmpegInstance && ffmpegInstance.loaded) {
    console.log("[FFmpeg] Using cached instance");
    return ffmpegInstance;
  }

  // Loading in progress - wait for it (but don't allow an infinite hang)
  if (ffmpegLoading) {
    console.log("[FFmpeg] Waiting for loading in progress...");
    try {
      return await withTimeout(ffmpegLoading, 180_000, "FFmpeg shared load");
    } catch (e) {
      // If the shared load got stuck, allow a clean retry.
      console.warn("[FFmpeg] Shared load timed out/failed; resetting loader state", e);
      ffmpegLoading = null;
      ffmpegInstance = null;
      throw e instanceof Error ? e : new Error(String(e));
    }
  }

  console.log("[FFmpeg] Starting fresh load...");

  const loadFFmpeg = async (): Promise<FFmpeg> => {
    const ffmpeg = new FFmpeg();

    const coreVersion = "0.12.10";
    const coreSources = [
      `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${coreVersion}/dist/esm/ffmpeg-core.js`,
      `https://unpkg.com/@ffmpeg/core@${coreVersion}/dist/esm/ffmpeg-core.js`,
      `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${coreVersion}/dist/umd/ffmpeg-core.js`,
      `https://unpkg.com/@ffmpeg/core@${coreVersion}/dist/umd/ffmpeg-core.js`,
    ];
    const wasmSources = [
      `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${coreVersion}/dist/esm/ffmpeg-core.wasm`,
      `https://unpkg.com/@ffmpeg/core@${coreVersion}/dist/esm/ffmpeg-core.wasm`,
      `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${coreVersion}/dist/umd/ffmpeg-core.wasm`,
      `https://unpkg.com/@ffmpeg/core@${coreVersion}/dist/umd/ffmpeg-core.wasm`,
    ];
    console.log("[FFmpeg] Preparing core config...");

    const directConfig = {
      coreURL: coreSources[0],
      wasmURL: wasmSources[0],
    };

    try {
      console.log("[FFmpeg] Loading FFmpeg core (direct URLs)...", directConfig);
      await withTimeout(ffmpeg.load(directConfig), 600_000, "FFmpeg load");
      console.log("[FFmpeg] Loaded successfully (direct URLs)!");
      ffmpegInstance = ffmpeg;
      return ffmpeg;
    } catch (e) {
      console.warn("[FFmpeg] Direct URL load failed, falling back to blob URLs:", e);
    }

    console.log("[FFmpeg] Fetching core files (blob fallback)...");
    const [coreURL, wasmURL] = await Promise.all([
      fetchToBlobURL(coreSources, "text/javascript"),
      fetchToBlobURL(wasmSources, "application/wasm"),
    ]);

    try {
      console.log("[FFmpeg] Loading FFmpeg core (blob URLs)...", { coreURL, wasmURL });
      await withTimeout(ffmpeg.load({ coreURL, wasmURL }), 600_000, "FFmpeg load");
      console.log("[FFmpeg] Loaded successfully (blob URLs)!");
      ffmpegInstance = ffmpeg;
      return ffmpeg;
    } catch (e) {
      console.error("[FFmpeg] Load failed:", e);
      ffmpegInstance = null;
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`FFmpeg load failed: ${msg}`);
    }
  };

  ffmpegLoading = loadFFmpeg();

  try {
    return await ffmpegLoading;
  } finally {
    ffmpegLoading = null;
  }
};

// -----------------------
// Helpers: stable media loading (Promise.all)
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

  // Keep decoder active during capture: attach as hidden element.
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

const isLowMemoryDevice = (): boolean => {
  const dm = (navigator as any).deviceMemory as number | undefined;
  if (typeof dm === "number" && dm > 0 && dm <= 4) return true;
  return false;
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
// FFmpeg encoding: stable 30fps CFR, hard trim 15.0s, scale/crop, timestamp reset
// -----------------------

type EncodeOptions = {
  useFaststart: boolean;
  profile: "main" | "high";
  preset: "superfast" | "veryfast" | "fast" | "medium";
  crf: number;
  durationSec: number;
};

const buildEncodeArgs = (inputName: string, opts: EncodeOptions): string[] => {
  const vf =
    "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30";

  const args = [
    // Input frame rate hint (helps when PTS are messy)
    "-r",
    "30",
    "-i",
    inputName,

    // Reset/generate sane timestamps
    "-fflags",
    "+genpts",
    "-avoid_negative_ts",
    "make_zero",

    // Hard trim BOTH streams
    "-t",
    opts.durationSec.toFixed(1),

    // Video
    "-vf",
    vf,
    "-c:v",
    "libx264",
    "-preset",
    opts.preset,
    "-profile:v",
    opts.profile,
    "-pix_fmt",
    "yuv420p",
    "-vsync",
    "cfr",
    "-r",
    "30",
    "-fpsmax",
    "30",

    // Quality / size
    "-crf",
    String(opts.crf),

    // Audio (keep it light but stable)
    "-map",
    "0:v:0",
    "-map",
    "0:a?",
    "-c:a",
    "aac",
    "-ar",
    "48000",
    "-b:a",
    "160k",
    "-af",
    `atrim=0:${opts.durationSec.toFixed(1)},asetpts=PTS-STARTPTS`,

    // Safer muxing
    "-max_muxing_queue_size",
    "4096",
  ];

  if (opts.useFaststart) {
    args.push("-movflags", "+faststart");
  }

  // Keep output EXACTLY 15.0s even if one stream drifts
  args.push("-shortest");

  return args;
};

const encodeToMp4 = async (
  inputBlob: Blob,
  onProgress: (progress: number, message: string) => void,
  opts: EncodeOptions,
  inputExtHint: "webm" | "mp4" = "webm"
): Promise<Blob> => {
  onProgress(96, "Encoding MP4...");
  const ffmpeg = await getFFmpeg();

  const inputName = `input.${inputExtHint}`;
  await ffmpeg.writeFile(inputName, await fetchFile(inputBlob));

  try {
    onProgress(97, "Re-encoding H.264 (30fps, trim 15.0s)...");
    await withTimeout(
      ffmpeg.exec([...buildEncodeArgs(inputName, opts), "output.mp4"]),
      420_000,
      "FFmpeg encode"
    );

    onProgress(99, "Finalizing...");
    const data = await ffmpeg.readFile("output.mp4");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Blob([data as any], { type: "video/mp4" });
  } finally {
    // Best-effort cleanup
    try {
      await ffmpeg.deleteFile(inputName);
    } catch {
      // ignore
    }
    try {
      await ffmpeg.deleteFile("output.mp4");
    } catch {
      // ignore
    }
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
    // Keep existing fallback (not part of current request to redesign)
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#581c87");
    gradient.addColorStop(0.5, "#1e3a8a");
    gradient.addColorStop(1, "#155e75");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export const exportVideo = async (
  slidesInput: Slide[],
  backgroundAsset: Asset | null,
  onProgress: (progress: number, message: string) => void,
  backgroundMusicUrl?: string,
  globalOverlay?: number
): Promise<Blob> => {
  onProgress(5, "Initializing video recorder...");

  const slides = applyEnergiaRuleToSlides(slidesInput);

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;

  const ctx = prepareCanvasContext(canvas);
  if (!ctx) throw new Error("Failed to initialize canvas context");

  // Preload all assets BEFORE starting render (Promise.all)
  onProgress(8, "Loading assets...");

  const needBackgroundVideo = !!(backgroundAsset?.url && backgroundAsset?.type !== "image");

  const backgroundVideoPromise = needBackgroundVideo
    ? fetchAsBlob(backgroundAsset!.url, "Background video")
    : Promise.resolve<LoadedBlob | null>(null);

  const backgroundMusicPromise = backgroundMusicUrl
    ? fetchAsBlob(backgroundMusicUrl, "Background audio")
    : Promise.resolve<LoadedBlob | null>(null);

  const [bgVideoBlob, bgAudioBlob] = await Promise.all([backgroundVideoPromise, backgroundMusicPromise]);

  let backgroundVideo: HTMLVideoElement | undefined;
  let backgroundAudio: HTMLAudioElement | undefined;

  try {
    if (bgVideoBlob) {
      backgroundVideo = createHiddenVideo(bgVideoBlob.objectUrl);
      await waitForEvent(backgroundVideo, "loadeddata", 20_000, "Background video load");
    }
  } catch (e) {
    // Per instruction: if background video isn't loaded, DO NOT start rendering
    if (needBackgroundVideo) {
      throw e instanceof Error ? e : new Error(String(e));
    }
  }

  try {
    if (bgAudioBlob) {
      backgroundAudio = createAudio(bgAudioBlob.objectUrl);
      await waitForEvent(backgroundAudio as any, "loadeddata", 20_000, "Background audio load");
    }
  } catch {
    // Audio is optional; continue without it.
    backgroundAudio = undefined;
  }

  onProgress(10, "Starting recording...");

  // Always render EXACT 15.0s (hard cut)
  const TARGET_DURATION_SEC = 15.0;
  const fps = 30;
  const frameMs = 1000 / fps;
  const totalFrames = Math.round(TARGET_DURATION_SEC * fps);

  // Preload FFmpeg in background (best effort)
  void getFFmpeg().catch((e) => console.warn("[FFmpeg] Preload failed (will retry later):", e));

  const mp4MimeTypes = [
    "video/mp4;codecs=avc1.64001E,mp4a.40.2",
    "video/mp4;codecs=avc1.4D401E,mp4a.40.2",
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
  ];

  let mimeType = "";
  let recordingAsMp4 = false;

  for (const mt of mp4MimeTypes) {
    if (MediaRecorder.isTypeSupported(mt)) {
      mimeType = mt;
      recordingAsMp4 = true;
      break;
    }
  }

  if (!mimeType) {
    // Intermediate only
    if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) mimeType = "video/webm;codecs=vp9,opus";
    else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")) mimeType = "video/webm;codecs=vp8,opus";
    else if (MediaRecorder.isTypeSupported("video/webm")) mimeType = "video/webm";
    else throw new Error("No supported video format found");
  }

  const videoStream = canvas.captureStream(30);
  const chunks: Blob[] = [];

  let combinedStream: MediaStream = videoStream;
  let audioContext: AudioContext | undefined;

  if (backgroundAudio) {
    try {
      audioContext = new AudioContext({ sampleRate: 48000 });
      const audioSource = audioContext.createMediaElementSource(backgroundAudio);
      const gainNode = audioContext.createGain();
      const audioDestination = audioContext.createMediaStreamDestination();
      audioSource.connect(gainNode);
      gainNode.connect(audioDestination);
      gainNode.gain.value = 0.8;

      combinedStream = new MediaStream([...videoStream.getVideoTracks(), ...audioDestination.stream.getAudioTracks()]);
    } catch (error) {
      console.warn("Failed to setup audio stream, continuing without audio:", error);
      combinedStream = videoStream;
      backgroundAudio = undefined;
    }
  }

  const recorderOptions: any = {
    mimeType,
    // Keep intermediate moderate to reduce RAM spikes; final output quality is via FFmpeg CRF
    videoBitsPerSecond: 8_000_000,
    audioBitsPerSecond: 160_000,
  };

  const mediaRecorder = new MediaRecorder(combinedStream, recorderOptions);

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const recordingPromise = new Promise<Blob>((resolve, reject) => {
    mediaRecorder.onstop = () => {
      try {
        combinedStream.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
      if (audioContext) void audioContext.close();

      resolve(new Blob(chunks, { type: mimeType }));
    };
    mediaRecorder.onerror = (e) => reject(e);
  });

  // Start media first (reduces frozen-first-frame issues)
  if (backgroundVideo) {
    backgroundVideo.currentTime = 0;
    try {
      await backgroundVideo.play();
    } catch {
      // Some browsers block play() without gesture; we can still draw frames if loaded.
    }
  }
  if (backgroundAudio) {
    backgroundAudio.currentTime = 0;
    try {
      await backgroundAudio.play();
    } catch {
      // ignore
    }
  }

  mediaRecorder.start();

  const slidesTotalDuration = slides.reduce((sum, s) => sum + s.durationSec, 0);
  const getSlideAtTime = (tSec: number) => {
    // If slides are shorter than 15s, hold the last slide.
    const t = slidesTotalDuration > 0 ? Math.min(tSec, Math.max(0, slidesTotalDuration - 1e-6)) : 0;
    let acc = 0;
    for (let i = 0; i < slides.length; i++) {
      const d = slides[i].durationSec;
      if (t < acc + d) return { index: i, start: acc };
      acc += d;
    }
    return { index: Math.max(0, slides.length - 1), start: Math.max(0, slidesTotalDuration - 1e-6) };
  };

  const startTime = performance.now();

  const runFixedFpsRenderLoop = async () => {
    for (let frame = 0; frame < totalFrames; frame++) {
      const targetAt = startTime + frame * frameMs;
      const waitMs = Math.max(0, targetAt - performance.now());
      if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
      else await new Promise((r) => setTimeout(r, 0));

      const elapsed = frame / fps;

      if (frame % 15 === 0) {
        const percent = (elapsed / TARGET_DURATION_SEC) * 100;
        onProgress(10 + percent * 0.85, `Recording... ${percent.toFixed(0)}%`);
      }

      const { index: currentSlideIndex, start: slideStartTime } = getSlideAtTime(elapsed);
      const slideElapsed = elapsed - slideStartTime;
      const transitionDuration = 0.5;
      const transitionProgress = Math.min(slideElapsed / transitionDuration, 1);

      // Keep background video from freezing at end
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
      try {
        backgroundVideo.pause();
      } catch {
        // ignore
      }
      try {
        backgroundVideo.remove();
      } catch {
        // ignore
      }
    }

    if (backgroundAudio) {
      try {
        backgroundAudio.pause();
      } catch {
        // ignore
      }
    }

    // Flush last frame
    await new Promise((r) => setTimeout(r, 150));
    mediaRecorder.stop();
  };

  void runFixedFpsRenderLoop();

  onProgress(95, "Finalizing recording...");
  const recordedBlob = await recordingPromise;

  const lowMem = isLowMemoryDevice() || recordedBlob.size > 140 * 1024 * 1024;

  const baseOpts: EncodeOptions = {
    useFaststart: !lowMem,
    profile: lowMem ? "main" : "high",
    preset: "superfast",
    crf: 22,
    durationSec: TARGET_DURATION_SEC,
  };

  try {
    const mp4Blob = await encodeToMp4(
      recordedBlob,
      onProgress,
      baseOpts,
      recordingAsMp4 ? "mp4" : "webm"
    );
    onProgress(100, "Complete!");
    return mp4Blob;
  } catch (err) {
    console.warn("FFmpeg encode failed, retrying with safer settings (no faststart + main profile)...", err);
    ffmpegInstance = null;
    ffmpegLoading = null;

    const retryOpts: EncodeOptions = {
      ...baseOpts,
      useFaststart: false,
      profile: "main",
      preset: "superfast",
      crf: 22,
    };

    const mp4Blob = await encodeToMp4(
      recordedBlob,
      onProgress,
      retryOpts,
      recordingAsMp4 ? "mp4" : "webm"
    );
    onProgress(100, "Complete!");
    return mp4Blob;
  } finally {
    // Release object URLs to avoid leaks between exports
    try {
      if (bgVideoBlob?.objectUrl) URL.revokeObjectURL(bgVideoBlob.objectUrl);
    } catch {
      // ignore
    }
    try {
      if (bgAudioBlob?.objectUrl) URL.revokeObjectURL(bgAudioBlob.objectUrl);
    } catch {
      // ignore
    }
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
