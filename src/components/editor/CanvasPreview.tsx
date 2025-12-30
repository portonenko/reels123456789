import { useEffect, useState, useRef, memo } from "react";
import { Slide } from "@/types";
import { useEditorStore } from "@/store/useEditorStore";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw } from "lucide-react";
import { DraggableTextBox } from "./DraggableTextBox";
import { renderSlideText } from "@/utils/canvasTextRenderer";

interface CanvasPreviewProps {
  slide: Slide | null;
  globalOverlay: number;
  showTextBoxControls?: boolean;
  lang?: "en" | "ru";
}

export const CanvasPreview = memo(
  ({ slide, globalOverlay, showTextBoxControls = false, lang = "en" }: CanvasPreviewProps) => {
    const { assets, slides, updateSlide, backgroundMusicUrl } = useEditorStore();
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    const [slideTime, setSlideTime] = useState(0);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const animationRef = useRef<number | null>(null);

    const [videoError, setVideoError] = useState<string | null>(null);

    const currentSlide = isPlaying ? slides[currentSlideIndex] : slide;

    useEffect(() => {
      if (slide) {
        const index = slides.findIndex((s) => s.id === slide.id);
        if (index !== -1 && !isPlaying) {
          setCurrentSlideIndex(index);
        }
      }
    }, [slide, slides, isPlaying]);

    // Reset video error when slide/asset changes
    useEffect(() => {
      setVideoError(null);
    }, [currentSlide?.assetId]);

    // Animate slide time (30fps cap)
    useEffect(() => {
      if (isPlaying && slides.length > 0) {
        const currentSlideDuration = slides[currentSlideIndex]?.durationSec || 2;
        const startTime = Date.now();
        let lastUpdateTime = startTime;
        const UPDATE_INTERVAL = 1000 / 30;

        const animate = () => {
          const now = Date.now();
          const elapsed = (now - startTime) / 1000;

          if (now - lastUpdateTime >= UPDATE_INTERVAL) {
            setSlideTime(elapsed);
            lastUpdateTime = now;
          }

          if (elapsed < currentSlideDuration) {
            animationRef.current = requestAnimationFrame(animate);
          } else {
            if (currentSlideIndex < slides.length - 1) {
              setCurrentSlideIndex(currentSlideIndex + 1);
              setSlideTime(0);
            } else {
              setIsPlaying(false);
              setCurrentSlideIndex(0);
              setSlideTime(0);
              videoRef.current?.pause();
              audioRef.current?.pause();
            }
          }
        };

        animationRef.current = requestAnimationFrame(animate);

        return () => {
          if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
      }
    }, [isPlaying, currentSlideIndex, slides]);

    // Render canvas text overlay
    useEffect(() => {
      if (!canvasRef.current || !currentSlide) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d", {
        alpha: true,
        willReadFrequently: false,
      });
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const transitionDuration = 0.5;
      const transitionProgress = Math.min(slideTime / transitionDuration, 1);

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
              ctx.filter = `brightness(${1 + (3 - (transitionProgress / 0.3) * 3)})`;
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

      renderSlideText(ctx, currentSlide, canvas, { isPreview: true });

      ctx.restore();
    }, [currentSlide, slideTime, isPlaying]);

    const handlePlayPause = () => {
      if (isPlaying) {
        setIsPlaying(false);
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        videoRef.current?.pause();
        audioRef.current?.pause();
        return;
      }

      setIsPlaying(true);
      setSlideTime(0);

      // Keep preview video running if present
      videoRef.current
        ?.play()
        .catch((error) => console.warn("Preview video play failed:", error));

      if (audioRef.current && backgroundMusicUrl) {
        audioRef.current.play().catch((error) => {
          console.error("Audio playback failed:", error);
        });
      }
    };

    const handleRestart = () => {
      setCurrentSlideIndex(0);
      setSlideTime(0);
      setIsPlaying(false);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.pause();
      }
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.pause();
      }
    };

    if (!currentSlide) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-canvas rounded-lg">
          <p className="text-muted-foreground">Select a slide to preview</p>
        </div>
      );
    }

    const overlayOpacity = Math.max(0, Math.min(0.7, globalOverlay / 100));
    const backgroundAsset = assets.find((a) => a.id === currentSlide.assetId);

    const isImageAsset = backgroundAsset
      ? backgroundAsset.type === "image" || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(backgroundAsset.url || "")
      : false;

    const hasBackground = Boolean(backgroundAsset && backgroundAsset.url);

    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-canvas rounded-lg p-8">
        {backgroundMusicUrl && (
          <audio ref={audioRef} src={backgroundMusicUrl} loop preload="auto" />
        )}

        <div className="mb-4 flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePlayPause} disabled={slides.length === 0}>
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
          <Button variant="outline" size="sm" onClick={handleRestart} disabled={slides.length === 0}>
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

        {/* 9:16 preview frame */}
        <div
          className="relative bg-background rounded-lg overflow-hidden shadow-2xl"
          style={{ width: "360px", height: "640px" }}
        >
          {/* Layer 0: Video/Image OR placeholder */}
          {hasBackground && !videoError ? (
            isImageAsset ? (
              <img
                src={backgroundAsset!.url}
                className="absolute inset-0 w-full h-full object-cover"
                style={{ zIndex: 0 }}
                alt="Background"
                loading="lazy"
              />
            ) : (
              <video
                key={backgroundAsset!.id}
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                style={{ zIndex: 0 }}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                crossOrigin="anonymous"
                onCanPlay={() => {
                  // Ensure autoplay kicks in after source swap
                  const el = videoRef.current;
                  if (!el) return;
                  void el.play().catch((e) => {
                    console.warn("Preview video autoplay blocked:", e);
                  });
                }}
                onError={() => {
                  setVideoError(
                    "Видео не поддерживается или ссылка недоступна. Пере-загрузите файл в Галерею (Storage)."
                  );
                }}
              >
                {/* Helps Safari with some sources */}
                <source src={backgroundAsset!.url} type="video/mp4" />
              </video>
            )
          ) : (
            <div
              className="absolute inset-0 bg-gradient-to-br from-muted via-background to-muted"
              style={{ zIndex: 0 }}
            />
          )}

          {/* Layer 1: Global overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 1,
              backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})`,
            }}
          />

          {/* Layer 2: Text canvas */}
          <canvas
            ref={canvasRef}
            width={1080}
            height={1920}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 2 }}
          />

          {/* Optional inline error hint */}
          {videoError && (
            <div
              className="absolute inset-0 flex items-center justify-center p-6 text-center"
              style={{ zIndex: 3 }}
            >
              <div className="bg-card/80 backdrop-blur-sm border border-border rounded-lg p-4 max-w-[320px]">
                <p className="text-sm text-foreground">{videoError}</p>
              </div>
            </div>
          )}

          {/* Duration indicator */}
          <div
            className="absolute bottom-4 left-4 bg-black/70 text-white text-xs px-2 py-1 rounded"
            style={{ zIndex: 4 }}
          >
            {currentSlide.durationSec}s
          </div>

          {/* Draggable box controls */}
          {showTextBoxControls && slide && !isPlaying && (
            <DraggableTextBox
              slide={slide}
              containerWidth={360}
              containerHeight={640}
              onUpdate={(position) => {
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
              }}
              lang={lang}
            />
          )}
        </div>
      </div>
    );
  }
);

