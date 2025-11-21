import { Slide, Asset } from "@/types";
import { renderSlideText } from "./canvasTextRenderer";
import JSZip from "jszip";

const renderSlideToCanvas = (
  slide: Slide,
  canvas: HTMLCanvasElement,
  backgroundMedia?: HTMLVideoElement | HTMLImageElement,
  transitionProgress?: number,
  globalOverlay?: number
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

  // Draw background (video or image)
  if (backgroundMedia) {
    ctx.drawImage(backgroundMedia, 0, 0, canvas.width, canvas.height);
  } else {
    // Gradient fallback
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#581c87"); // purple-900
    gradient.addColorStop(0.5, "#1e3a8a"); // blue-900
    gradient.addColorStop(1, "#155e75"); // cyan-900
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
  
  // Use high bitrate for excellent quality
  const recorderOptions: any = {
    mimeType,
    videoBitsPerSecond: 5000000, // 5 Mbps - high quality for 1080p vertical
    audioBitsPerSecond: 128000,  // 128 kbps audio
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
      // Clean up audio context
      if (audioContext) {
        audioContext.close();
      }
      const blob = new Blob(chunks, { type: mimeType.split(';')[0] });
      console.log(`Final video size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Video format: ${mimeType}`);
      console.log(`Total chunks: ${chunks.length}`);
      resolve(blob);
    };
    mediaRecorder.onerror = (e) => {
      console.error('MediaRecorder error:', e);
      reject(e);
    };
  });

  // Request data in larger chunks for better stability (every 1000ms)
  mediaRecorder.start(1000);
  console.log('MediaRecorder started with format:', mimeType);

  // Start background video and audio if available
  if (backgroundVideo) {
    backgroundVideo.play();
  }
  if (backgroundAudio) {
    // Don't set volume here as it's controlled by gain node
    await backgroundAudio.play();
    console.log("Background audio playing");
  }

  // Animate through slides at 30 FPS with precise timing
  const totalDuration = slides.reduce((sum, s) => sum + s.durationSec, 0);
  const startTime = performance.now();
  const fps = 30;
  const frameDuration = 1000 / fps; // ~33.33ms per frame
  let currentSlideIndex = 0;
  let slideStartTime = 0;
  let frameCount = 0;

  const animate = () => {
    const now = performance.now();
    const elapsed = (now - startTime) / 1000; // seconds
    
    // Check if we've reached the end
    if (elapsed >= totalDuration) {
      // Stop recording
      if (backgroundVideo) {
        backgroundVideo.pause();
      }
      if (backgroundAudio) {
        backgroundAudio.pause();
      }
      mediaRecorder.stop();
      console.log('Recording completed at:', elapsed, 'seconds');
      return;
    }
    
    // Calculate expected frame time based on frame count for consistent timing
    const expectedTime = startTime + (frameCount * frameDuration);
    const drift = now - expectedTime;
    
    // Only render if we're at or past the expected frame time
    if (drift >= 0) {
      frameCount++;
      
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
      const slideElapsed = elapsed - slideStartTime;
      const transitionDuration = 0.5; // 0.5 seconds
      const transitionProgress = Math.min(slideElapsed / transitionDuration, 1);
      
      renderSlideToCanvas(
        slides[currentSlideIndex], 
        canvas, 
        backgroundVideo, 
        transitionProgress,
        globalOverlay
      );
    }
    
    // Schedule next frame with precise timing compensation
    const nextFrameTime = expectedTime + frameDuration;
    const delay = Math.max(0, nextFrameTime - performance.now());
    setTimeout(() => requestAnimationFrame(animate), delay);
  };

  animate();

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
    renderSlideToCanvas(slide, canvas, backgroundImage, 1, globalOverlay);

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

