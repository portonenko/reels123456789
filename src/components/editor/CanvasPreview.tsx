import { useEffect, useState, useRef } from "react";
import { Slide } from "@/types";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/store/useEditorStore";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw } from "lucide-react";
import { DraggableTextBox } from "./DraggableTextBox";
import { renderSlideText } from "@/utils/canvasTextRenderer";

interface CanvasPreviewProps {
  slide: Slide | null;
  globalOverlay: number;
  showTextBoxControls?: boolean;
  lang?: 'en' | 'ru';
}

export const CanvasPreview = ({ slide, globalOverlay, showTextBoxControls = false, lang = 'en' }: CanvasPreviewProps) => {
  const { assets, slides, updateSlide, backgroundMusicUrl } = useEditorStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [slideTime, setSlideTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const animationRef = useRef<number | null>(null);

  // Playback refs to avoid stale closures during rAF
  const slideIndexRef = useRef(0);
  const slideStartTsRef = useRef<number>(0);
  const lastUiUpdateTsRef = useRef<number>(0);

  const currentSlide = isPlaying ? slides[currentSlideIndex] : slide;

  // Calculate total timeline duration
  const totalDuration = slides.reduce((sum, s) => sum + s.durationSec, 0);

  useEffect(() => {
    if (slide) {
      const index = slides.findIndex((s) => s.id === slide.id);
      if (index !== -1 && !isPlaying) {
        setCurrentSlideIndex(index);
      }
    }
  }, [slide, slides, isPlaying]);

  // Timeline playback (robust even if background video ends)
  useEffect(() => {
    if (!isPlaying || slides.length === 0) return;

    slideIndexRef.current = Math.min(currentSlideIndex, Math.max(slides.length - 1, 0));
    slideStartTsRef.current = performance.now();
    lastUiUpdateTsRef.current = 0;

    const UPDATE_INTERVAL_MS = 1000 / 30; // 30 FPS UI cap

    const tick = (now: number) => {
      const idx = slideIndexRef.current;
      const duration = slides[idx]?.durationSec ?? 2;
      const elapsed = Math.max(0, (now - slideStartTsRef.current) / 1000);

      // Keep background video looping during preview playback (some browsers stop even with loop)
      const v = videoRef.current;
      if (v && v.ended) {
        try {
          v.currentTime = 0;
          void v.play();
        } catch {
          // ignore
        }
      }

      if (now - lastUiUpdateTsRef.current >= UPDATE_INTERVAL_MS) {
        setSlideTime(elapsed);
        lastUiUpdateTsRef.current = now;
      }

      if (elapsed < duration) {
        animationRef.current = requestAnimationFrame(tick);
        return;
      }

      // advance slide
      if (idx < slides.length - 1) {
        slideIndexRef.current = idx + 1;
        slideStartTsRef.current = now;
        setCurrentSlideIndex(idx + 1);
        setSlideTime(0);
        animationRef.current = requestAnimationFrame(tick);
        return;
      }

      // end timeline
      setIsPlaying(false);
      setCurrentSlideIndex(0);
      setSlideTime(0);
      if (videoRef.current) videoRef.current.pause();
      if (audioRef.current) audioRef.current.pause();
    };

    animationRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
    // Intentionally NOT depending on currentSlideIndex: controlled via refs during playback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, slides]);
  // Render canvas text overlay - optimized
  useEffect(() => {
    if (!canvasRef.current || !currentSlide) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { 
      alpha: true,
      willReadFrequently: false // Performance optimization
    });
    if (!ctx) return;

    // Clear canvas efficiently
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate transition progress
    const transitionDuration = 0.5;
    const transitionProgress = Math.min(slideTime / transitionDuration, 1);

    // Apply transition effects to canvas
    ctx.save();
    
    if (isPlaying && slideTime < transitionDuration && currentSlide.transition) {
      let opacity = 1;
      let offsetX = 0;
      
      switch (currentSlide.transition) {
        case "fade":
          opacity = transitionProgress;
          break;
        case "flash":
          if (transitionProgress < 0.3) {
            ctx.filter = `brightness(${1 + (3 - transitionProgress / 0.3 * 3)})`;
            opacity = transitionProgress / 0.3;
          }
          break;
        case "glow":
          ctx.filter = `brightness(${1 + (1 - transitionProgress)}) contrast(${1 + (0.2 - transitionProgress * 0.2)})`;
          opacity = transitionProgress;
          break;
        case "slide-left":
          offsetX = canvas.width * (1 - transitionProgress);
          break;
        case "slide-right":
          offsetX = -canvas.width * (1 - transitionProgress);
          break;
      }
      
      ctx.globalAlpha = opacity;
      ctx.translate(offsetX, 0);
    }

    // Render text using unified function
    renderSlideText(ctx, currentSlide, canvas, { isPreview: true });
    
    ctx.restore();
  }, [currentSlide, slideTime, isPlaying]);

  const handlePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (videoRef.current) {
        videoRef.current.pause();
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    } else {
      setIsPlaying(true);
      setSlideTime(0);
      if (videoRef.current) {
        if (currentSlideIndex === 0) {
          videoRef.current.currentTime = 0;
        }
        videoRef.current.play();
      }
      if (audioRef.current && backgroundMusicUrl) {
        if (currentSlideIndex === 0) {
          audioRef.current.currentTime = 0;
        }
        audioRef.current.play().catch((error) => {
          console.error("Audio playback failed:", error);
        });
      }
    }
  };

  const handleRestart = () => {
    setCurrentSlideIndex(0);
    setSlideTime(0);
    setIsPlaying(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.pause();
    }
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.pause();
    }
  };
  
  const overlayOpacity = globalOverlay / 100;
  const backgroundAsset = currentSlide
    ? assets.find((a) => a.id === currentSlide.assetId)
    : undefined;

  // Ensure background video keeps looping smoothly during preview playback
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !isPlaying) return;

    const restart = () => {
      try {
        if (!Number.isFinite(v.duration) || v.duration <= 0) return;
        v.currentTime = 0;
        void v.play();
      } catch {
        // ignore
      }
    };

    const ensureRunning = () => {
      try {
        if (!Number.isFinite(v.duration) || v.duration <= 0) return;

        // If we reached the end (or very close), restart
        if (v.ended || v.currentTime >= v.duration - 0.05) {
          restart();
          return;
        }

        // If something paused/stalled playback, try to resume
        if (v.paused) {
          void v.play();
        }
      } catch {
        // ignore
      }
    };

    v.loop = false;

    v.addEventListener("ended", restart);
    v.addEventListener("stalled", ensureRunning);
    v.addEventListener("waiting", ensureRunning);
    v.addEventListener("pause", ensureRunning);

    const interval = window.setInterval(ensureRunning, 250);

    return () => {
      window.clearInterval(interval);
      v.removeEventListener("ended", restart);
      v.removeEventListener("stalled", ensureRunning);
      v.removeEventListener("waiting", ensureRunning);
      v.removeEventListener("pause", ensureRunning);
    };
  }, [isPlaying, backgroundAsset?.url]);

  if (!currentSlide) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-canvas rounded-lg">
        <p className="text-muted-foreground">Select a slide to preview</p>
      </div>
    );
  }
  // Ensure background video keeps looping smoothly during preview playback
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !isPlaying) return;

    const restart = () => {
      try {
        if (!Number.isFinite(v.duration) || v.duration <= 0) return;
        v.currentTime = 0;
        void v.play();
      } catch {
        // ignore
      }
    };

    const ensureRunning = () => {
      try {
        if (!Number.isFinite(v.duration) || v.duration <= 0) return;

        // If we reached the end (or very close), restart
        if (v.ended || v.currentTime >= v.duration - 0.05) {
          restart();
          return;
        }

        // If something paused/stalled playback, try to resume
        if (v.paused) {
          void v.play();
        }
      } catch {
        // ignore
      }
    };

    v.loop = false;

    v.addEventListener("ended", restart);
    v.addEventListener("stalled", ensureRunning);
    v.addEventListener("waiting", ensureRunning);
    v.addEventListener("pause", ensureRunning);

    const interval = window.setInterval(ensureRunning, 250);

    return () => {
      window.clearInterval(interval);
      v.removeEventListener("ended", restart);
      v.removeEventListener("stalled", ensureRunning);
      v.removeEventListener("waiting", ensureRunning);
      v.removeEventListener("pause", ensureRunning);
    };
  }, [isPlaying, backgroundAsset?.url]);
  // Calculate transition effects
  const transitionDuration = 0.5; // 0.5 seconds
  const transitionProgress = Math.min(slideTime / transitionDuration, 1);
  
  let transitionStyle: React.CSSProperties = {};
  
  if (isPlaying && slideTime < transitionDuration && currentSlide.transition) {
    switch (currentSlide.transition) {
      case "fade":
        transitionStyle = { opacity: transitionProgress };
        break;
      case "flash":
        if (transitionProgress < 0.3) {
          transitionStyle = { 
            filter: `brightness(${1 + (3 - transitionProgress / 0.3 * 3)})`,
            opacity: transitionProgress / 0.3
          };
        } else {
          transitionStyle = { opacity: 1 };
        }
        break;
      case "glow":
        transitionStyle = {
          filter: `brightness(${1 + (1 - transitionProgress)}) contrast(${1 + (0.2 - transitionProgress * 0.2)})`,
          opacity: transitionProgress
        };
        break;
      case "slide-left":
        transitionStyle = { transform: `translateX(${100 - transitionProgress * 100}%)` };
        break;
      case "slide-right":
        transitionStyle = { transform: `translateX(${-100 + transitionProgress * 100}%)` };
        break;
    }
  }

  const handleTextBoxUpdate = (position: { x: number; y: number; width: number; height: number }) => {
    if (!slide) return;
    updateSlide(slide.id, {
      style: {
        ...slide.style,
        text: {
          ...slide.style.text,
          position,
        },
      },
    });
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-canvas rounded-lg p-8">
      {/* Background music audio element */}
      {backgroundMusicUrl && (
        <audio 
          ref={audioRef} 
          src={backgroundMusicUrl} 
          loop 
          preload="auto"
        />
      )}
      
      {/* Playback controls */}
      <div className="mb-4 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePlayPause}
          disabled={slides.length === 0}
        >
          {isPlaying ? (
            <>
              <Pause className="w-4 h-4 mr-2" />
              Pause
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Play Timeline
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRestart}
          disabled={slides.length === 0}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Restart
        </Button>
        {isPlaying && (
          <div className="flex items-center gap-2 px-3 py-1 bg-card rounded-md border border-border">
            <span className="text-sm text-muted-foreground">
              Slide {currentSlideIndex + 1} of {slides.length}
            </span>
          </div>
        )}
      </div>

      {/* 9:16 aspect ratio container - scaled down 3x from export (1080x1920) */}
      <div className="relative bg-black rounded-lg overflow-hidden shadow-2xl" style={{ width: "360px", height: "640px" }}>
        {/* Background video - plays continuously */}
        {backgroundAsset ? (
          backgroundAsset.type === 'image' ? (
            <img
              src={backgroundAsset.url}
              className="absolute inset-0 w-full h-full object-cover"
              alt="Background"
            />
          ) : (
            <video
              ref={videoRef}
              src={backgroundAsset.url}
              className="absolute inset-0 w-full h-full object-cover"
              muted
              playsInline
              preload="auto"
            />
          )
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-cyan-900" />
        )}
        
        {/* Overlay */}
        <div
          className="absolute inset-0 bg-black"
          style={{ opacity: overlayOpacity }}
        />

        {/* Canvas overlay for text rendering */}
        <canvas
          ref={canvasRef}
          width={1080}
          height={1920}
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: 'none' }}
        />

          {/* Duration indicator */}
          <div className="absolute bottom-4 left-4 bg-black/70 text-white text-xs px-2 py-1 rounded">
            {currentSlide.durationSec}s
          </div>

          {/* Draggable text box overlay (only for selected slide, not during playback) */}
          {showTextBoxControls && slide && !isPlaying && (
            <DraggableTextBox
              slide={slide}
              containerWidth={360}
              containerHeight={640}
              onUpdate={handleTextBoxUpdate}
              lang={lang}
            />
          )}
      </div>
    </div>
  );
};
