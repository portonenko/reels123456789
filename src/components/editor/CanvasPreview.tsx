import { useEffect, useState, useRef } from "react";
import { Slide } from "@/types";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/store/useEditorStore";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Move } from "lucide-react";
import { DraggableTextBox } from "./DraggableTextBox";

interface CanvasPreviewProps {
  slide: Slide | null;
  globalOverlay: number;
  showTextBoxControls?: boolean;
  lang?: 'en' | 'ru';
}

export const CanvasPreview = ({ slide, globalOverlay, showTextBoxControls = false, lang = 'en' }: CanvasPreviewProps) => {
  const { assets, slides, updateSlide } = useEditorStore();
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
        {currentSlide.style.text.position ? (
          // Positioned text box mode
          <div
            className="absolute"
            style={{
              left: `${currentSlide.style.text.position.x}%`,
              top: `${currentSlide.style.text.position.y}%`,
              width: `${currentSlide.style.text.position.width}%`,
              height: `${currentSlide.style.text.position.height}%`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: currentSlide.style.text.alignment === 'left' ? 'flex-start' : 
                         currentSlide.style.text.alignment === 'right' ? 'flex-end' : 'center',
              justifyContent: 'center',
            }}
          >
            {currentSlide.style.plate.enabled ? (
              <div
                className="rounded-lg w-full"
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
                    fontSize: `${currentSlide.style.text.fontSize / 3}px`,
                    fontWeight: currentSlide.style.text.fontWeight,
                    lineHeight: currentSlide.style.text.lineHeight,
                    letterSpacing: `${currentSlide.style.text.letterSpacing}em`,
                    color: currentSlide.style.text.color,
                    textShadow: currentSlide.style.text.textShadow,
                    textAlign: currentSlide.style.text.alignment,
                    wordWrap: "break-word",
                  }}
                >
                  {currentSlide.title.replace(/^\[.*?\]\s*/, '')}
                </h1>
                {currentSlide.body && (
                  <p
                    className="mt-3"
                    style={{
                      fontFamily: currentSlide.style.text.bodyFontFamily || currentSlide.style.text.fontFamily,
                      fontSize: `${(currentSlide.style.text.bodyFontSize || currentSlide.style.text.fontSize * 0.5) / 3}px`,
                      fontWeight: currentSlide.style.text.bodyFontWeight || currentSlide.style.text.fontWeight - 200,
                      lineHeight: currentSlide.style.text.lineHeight * 1.2,
                      color: currentSlide.style.text.color,
                      textShadow: currentSlide.style.text.textShadow,
                      textAlign: currentSlide.style.text.alignment,
                      wordWrap: "break-word",
                    }}
                  >
                    {currentSlide.body.replace(/^\[.*?\]\s*/, '')}
                  </p>
                )}
              </div>
            ) : (
              <div className="w-full">
                <h1
                  className={cn("font-bold")}
                  style={{
                    fontFamily: currentSlide.style.text.fontFamily,
                    fontSize: `${currentSlide.style.text.fontSize / 3}px`,
                    fontWeight: currentSlide.style.text.fontWeight,
                    lineHeight: currentSlide.style.text.lineHeight,
                    letterSpacing: `${currentSlide.style.text.letterSpacing}em`,
                    color: currentSlide.style.text.color,
                    textShadow: currentSlide.style.text.textShadow,
                    textAlign: currentSlide.style.text.alignment,
                    WebkitTextStroke: `${(currentSlide.style.text.strokeWidth || 2) / 3}px ${currentSlide.style.text.stroke || "#000000"}`,
                    paintOrder: "stroke fill",
                    filter: `drop-shadow(0 0 ${(currentSlide.style.text.fontSize || 48) * 0.2 / 3}px ${currentSlide.style.text.glow || "rgba(255,255,255,0.8)"})`,
                    wordWrap: "break-word",
                  }}
                >
                  {currentSlide.title.replace(/^\[.*?\]\s*/, '')}
                </h1>
                {currentSlide.body && (
                  <p
                    className="mt-3"
                    style={{
                      fontFamily: currentSlide.style.text.bodyFontFamily || currentSlide.style.text.fontFamily,
                      fontSize: `${(currentSlide.style.text.bodyFontSize || currentSlide.style.text.fontSize * 0.5) / 3}px`,
                      fontWeight: currentSlide.style.text.bodyFontWeight || currentSlide.style.text.fontWeight - 200,
                      lineHeight: currentSlide.style.text.lineHeight * 1.2,
                      color: currentSlide.style.text.color,
                      textShadow: currentSlide.style.text.textShadow,
                      textAlign: currentSlide.style.text.alignment,
                      WebkitTextStroke: `${(currentSlide.style.text.strokeWidth || 2) * 0.75 / 3}px ${currentSlide.style.text.stroke || "#000000"}`,
                      paintOrder: "stroke fill",
                      wordWrap: "break-word",
                    }}
                  >
                    {currentSlide.body.replace(/^\[.*?\]\s*/, '')}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          // Default centered text mode
          <div
            className="absolute inset-0 flex flex-col items-center justify-center p-6"
            style={{
              paddingTop: `${currentSlide.style.safeMarginTop}%`,
              paddingBottom: `${currentSlide.style.safeMarginBottom}%`,
            }}
          >
            {currentSlide.style.plate.enabled ? (
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
                    fontSize: `${currentSlide.style.text.fontSize / 3}px`,
                    fontWeight: currentSlide.style.text.fontWeight,
                    lineHeight: currentSlide.style.text.lineHeight,
                    letterSpacing: `${currentSlide.style.text.letterSpacing}em`,
                    color: currentSlide.style.text.color,
                    textShadow: currentSlide.style.text.textShadow,
                    textAlign: currentSlide.style.text.alignment,
                    wordWrap: "break-word",
                    maxWidth: "80%",
                  }}
                >
                  {currentSlide.title.replace(/^\[.*?\]\s*/, '')}
                </h1>
                {currentSlide.body && (
                  <p
                    className="mt-3"
                    style={{
                      fontFamily: currentSlide.style.text.bodyFontFamily || currentSlide.style.text.fontFamily,
                      fontSize: `${(currentSlide.style.text.bodyFontSize || currentSlide.style.text.fontSize * 0.5) / 3}px`,
                      fontWeight: currentSlide.style.text.bodyFontWeight || currentSlide.style.text.fontWeight - 200,
                      lineHeight: currentSlide.style.text.lineHeight * 1.2,
                      color: currentSlide.style.text.color,
                      textShadow: currentSlide.style.text.textShadow,
                      textAlign: currentSlide.style.text.alignment,
                      wordWrap: "break-word",
                      maxWidth: "80%",
                    }}
                  >
                    {currentSlide.body.replace(/^\[.*?\]\s*/, '')}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <h1
                  className={cn("font-bold")}
                  style={{
                    fontFamily: currentSlide.style.text.fontFamily,
                    fontSize: `${currentSlide.style.text.fontSize / 3}px`,
                    fontWeight: currentSlide.style.text.fontWeight,
                    lineHeight: currentSlide.style.text.lineHeight,
                    letterSpacing: `${currentSlide.style.text.letterSpacing}em`,
                    color: currentSlide.style.text.color,
                    textShadow: currentSlide.style.text.textShadow,
                    textAlign: currentSlide.style.text.alignment,
                    WebkitTextStroke: `${(currentSlide.style.text.strokeWidth || 2) / 3}px ${currentSlide.style.text.stroke || "#000000"}`,
                    paintOrder: "stroke fill",
                    filter: `drop-shadow(0 0 ${(currentSlide.style.text.fontSize || 48) * 0.2 / 3}px ${currentSlide.style.text.glow || "rgba(255,255,255,0.8)"})`,
                    wordWrap: "break-word",
                    maxWidth: "80%",
                  }}
                >
                  {currentSlide.title.replace(/^\[.*?\]\s*/, '')}
                </h1>
                {currentSlide.body && (
                  <p
                    className="mt-3"
                    style={{
                      fontFamily: currentSlide.style.text.bodyFontFamily || currentSlide.style.text.fontFamily,
                      fontSize: `${(currentSlide.style.text.bodyFontSize || currentSlide.style.text.fontSize * 0.5) / 3}px`,
                      fontWeight: currentSlide.style.text.bodyFontWeight || currentSlide.style.text.fontWeight - 200,
                      lineHeight: currentSlide.style.text.lineHeight * 1.2,
                      color: currentSlide.style.text.color,
                      textShadow: currentSlide.style.text.textShadow,
                      textAlign: currentSlide.style.text.alignment,
                      WebkitTextStroke: `${(currentSlide.style.text.strokeWidth || 2) * 0.75 / 3}px ${currentSlide.style.text.stroke || "#000000"}`,
                      paintOrder: "stroke fill",
                      wordWrap: "break-word",
                      maxWidth: "80%",
                    }}
                  >
                    {currentSlide.body.replace(/^\[.*?\]\s*/, '')}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

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
