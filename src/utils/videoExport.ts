import { Slide, Asset } from "@/types";
import { renderSlideText } from "./canvasTextRenderer";
import JSZip from "jszip";

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

  // Use H.264 for maximum compatibility - works on all devices
  let mimeType = 'video/mp4;codecs=avc1.42E01E,mp4a.40.2'; // H.264 Baseline + AAC
  
  // Fallback to WebM VP8 if H.264 not supported
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm;codecs=vp8,opus'; // VP8 - widely supported
  }
  
  // Final fallback
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm'; // Let browser choose codecs
  }

  console.log('Using video format:', mimeType);

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
  
  // Calculate total duration for adaptive settings
  const totalDuration = slides.reduce((sum, s) => sum + s.durationSec, 0);

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

  // Render loop:
  // Use a fixed-timestep scheduler (instead of requestAnimationFrame) to produce
  // more uniform frame timestamps in the captured stream. Some players show
  // micro-stutter when the recording ends up variable-frame-rate.
  const runFixedFpsRenderLoop = async () => {
    let nextFrameAt = performance.now();

    while (true) {
      const now = performance.now();
      const elapsed = (now - startTime) / 1000;

      if (elapsed >= totalDuration) {
        break;
      }

      // Update progress
      const progressPercent = (elapsed / totalDuration) * 100;
      onProgress(10 + progressPercent * 0.85, `Recording slide ${currentSlideIndex + 1}/${slides.length}...`);

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

      renderSlideToCanvas(ctx, slides[currentSlideIndex], canvas, backgroundVideo, transitionProgress, globalOverlay);

      // Schedule next frame
      nextFrameAt += frameMs;
      const waitMs = Math.max(0, nextFrameAt - performance.now());
      if (waitMs > 0) {
        await new Promise((r) => setTimeout(r, waitMs));
      } else {
        // If we're behind, yield to avoid blocking the main thread.
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    if (backgroundVideo) backgroundVideo.pause();
    if (backgroundAudio) backgroundAudio.pause();

    // Give the recorder a tiny moment to flush the last painted frame
    await new Promise((r) => setTimeout(r, 100));
    mediaRecorder.stop();

    console.log("Recording completed at:", ((performance.now() - startTime) / 1000).toFixed(2), "seconds");
  };

  // Start render loop
  void runFixedFpsRenderLoop();

  onProgress(95, "Finalizing video...");
  const videoBlob = await recordingPromise;
  
  onProgress(100, "Complete!");
  return videoBlob;
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

