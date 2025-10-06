import { Slide } from "@/types";
import { cn } from "@/lib/utils";

interface CanvasPreviewProps {
  slide: Slide | null;
  globalOverlay: number;
}

export const CanvasPreview = ({ slide, globalOverlay }: CanvasPreviewProps) => {
  if (!slide) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-canvas rounded-lg">
        <p className="text-muted-foreground">Select a slide to preview</p>
      </div>
    );
  }

  const overlayOpacity = globalOverlay / 100;

  return (
    <div className="w-full h-full flex items-center justify-center bg-canvas rounded-lg p-8">
      {/* 9:16 aspect ratio container */}
      <div className="relative bg-black rounded-lg overflow-hidden shadow-2xl" style={{ width: "360px", height: "640px" }}>
        {/* Background video placeholder */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-cyan-900" />
        
        {/* Overlay */}
        <div
          className="absolute inset-0 bg-black"
          style={{ opacity: overlayOpacity }}
        />

        {/* Text content */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center p-6"
          style={{
            paddingTop: `${slide.style.safeMarginTop}%`,
            paddingBottom: `${slide.style.safeMarginBottom}%`,
          }}
        >
          <div
            className="rounded-lg"
            style={{
              padding: `${slide.style.plate.padding}px`,
              borderRadius: `${slide.style.plate.borderRadius}px`,
              backgroundColor: slide.style.plate.backgroundColor,
              opacity: slide.style.plate.opacity,
            }}
          >
            <h1
              className={cn("font-bold")}
              style={{
                fontFamily: slide.style.text.fontFamily,
                fontSize: `${slide.style.text.fontSize}px`,
                fontWeight: slide.style.text.fontWeight,
                lineHeight: slide.style.text.lineHeight,
                letterSpacing: `${slide.style.text.letterSpacing}em`,
                color: slide.style.text.color,
                textShadow: slide.style.text.textShadow,
                textAlign: slide.style.text.alignment,
              }}
            >
              {slide.title}
            </h1>
            {slide.body && (
              <p
                className="mt-3"
                style={{
                  fontFamily: slide.style.text.fontFamily,
                  fontSize: `${slide.style.text.fontSize * 0.5}px`,
                  fontWeight: slide.style.text.fontWeight - 200,
                  lineHeight: slide.style.text.lineHeight * 1.2,
                  color: slide.style.text.color,
                  textShadow: slide.style.text.textShadow,
                  textAlign: slide.style.text.alignment,
                }}
              >
                {slide.body}
              </p>
            )}
          </div>
        </div>

        {/* Duration indicator */}
        <div className="absolute bottom-4 left-4 bg-black/70 text-white text-xs px-2 py-1 rounded">
          {slide.durationSec}s
        </div>
      </div>
    </div>
  );
};
