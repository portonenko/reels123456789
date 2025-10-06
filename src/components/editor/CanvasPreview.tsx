import { useEffect, useState, useRef } from "react";
import { Slide } from "@/types";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/store/useEditorStore";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw } from "lucide-react";

interface CanvasPreviewProps {
  slide: Slide | null;
  globalOverlay: number;
}

export const CanvasPreview = ({ slide, globalOverlay }: CanvasPreviewProps) => {
  const { assets, slides, setSelectedSlideId } = useEditorStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

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

  useEffect(() => {
    if (isPlaying && slides.length > 0) {
      const currentSlideDuration = slides[currentSlideIndex]?.durationSec || 2;
      
      timerRef.current = setTimeout(() => {
        if (currentSlideIndex < slides.length - 1) {
          setCurrentSlideIndex(currentSlideIndex + 1);
        } else {
          setIsPlaying(false);
          setCurrentSlideIndex(0);
          // Stop video at the end
          if (videoRef.current) {
            videoRef.current.pause();
          }
        }
      }, currentSlideDuration * 1000);
      
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
  }, [isPlaying, currentSlideIndex, slides]);

  const handlePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (videoRef.current) {
        videoRef.current.pause();
      }
    } else {
      setIsPlaying(true);
      // Start video from current position or beginning
      if (videoRef.current) {
        if (currentSlideIndex === 0) {
          videoRef.current.currentTime = 0;
        }
        videoRef.current.play();
      }
    }
  };

  const handleRestart = () => {
    setCurrentSlideIndex(0);
    setIsPlaying(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.pause();
    }
  };
  
  if (!currentSlide) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-canvas rounded-lg">
        <p className="text-muted-foreground">Select a slide to preview</p>
      </div>
    );
  }

  const overlayOpacity = globalOverlay / 100;
  const backgroundAsset = assets.find((a) => a.id === currentSlide.assetId);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-canvas rounded-lg p-8">
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

      {/* 9:16 aspect ratio container */}
      <div className="relative bg-black rounded-lg overflow-hidden shadow-2xl" style={{ width: "360px", height: "640px" }}>
        {/* Background video - plays continuously */}
        {backgroundAsset ? (
          <video
            ref={videoRef}
            src={backgroundAsset.url}
            className="absolute inset-0 w-full h-full object-cover"
            loop
            muted
            playsInline
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-cyan-900" />
        )}
        
        {/* Overlay */}
        <div
          className="absolute inset-0 bg-black"
          style={{ opacity: overlayOpacity }}
        />

        {/* Text content */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center p-6"
            style={{
              paddingTop: `${currentSlide.style.safeMarginTop}%`,
              paddingBottom: `${currentSlide.style.safeMarginBottom}%`,
            }}
          >
            <div
              className="rounded-lg"
              style={{
                padding: `${currentSlide.style.plate.padding}px`,
                borderRadius: `${currentSlide.style.plate.borderRadius}px`,
                backgroundColor: currentSlide.style.plate.backgroundColor,
                opacity: currentSlide.style.plate.opacity,
              }}
            >
              <h1
                className={cn("font-bold")}
                style={{
                  fontFamily: currentSlide.style.text.fontFamily,
                  fontSize: `${currentSlide.style.text.fontSize}px`,
                  fontWeight: currentSlide.style.text.fontWeight,
                  lineHeight: currentSlide.style.text.lineHeight,
                  letterSpacing: `${currentSlide.style.text.letterSpacing}em`,
                  color: currentSlide.style.text.color,
                  textShadow: currentSlide.style.text.textShadow,
                  textAlign: currentSlide.style.text.alignment,
                }}
              >
                {currentSlide.title}
              </h1>
              {currentSlide.body && (
                <p
                  className="mt-3"
                  style={{
                    fontFamily: currentSlide.style.text.fontFamily,
                    fontSize: `${currentSlide.style.text.fontSize * 0.5}px`,
                    fontWeight: currentSlide.style.text.fontWeight - 200,
                    lineHeight: currentSlide.style.text.lineHeight * 1.2,
                    color: currentSlide.style.text.color,
                    textShadow: currentSlide.style.text.textShadow,
                    textAlign: currentSlide.style.text.alignment,
                  }}
                >
                  {currentSlide.body}
                </p>
              )}
            </div>
          </div>

          {/* Duration indicator */}
          <div className="absolute bottom-4 left-4 bg-black/70 text-white text-xs px-2 py-1 rounded">
            {currentSlide.durationSec}s
        </div>
      </div>
    </div>
  );
};
