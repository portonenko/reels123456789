import { useState, useRef, useEffect } from "react";
import { Slide } from "@/types";
import { cn } from "@/lib/utils";
import { GripVertical, Edit2, Copy, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SlidesTimelineProps {
  slides: Slide[];
  selectedSlideId: string | null;
  onSlideSelect: (slideId: string) => void;
  onSlideUpdate: (slideId: string, updates: Partial<Slide>) => void;
  onSlideDuplicate: (slideId: string) => void;
  onSlideDelete: (slideId: string) => void;
  onSlideAdd: () => void;
  onSlideEdit: (slideId: string) => void;
  lang?: 'en' | 'ru';
}

export const SlidesTimeline = ({
  slides,
  selectedSlideId,
  onSlideSelect,
  onSlideUpdate,
  onSlideDuplicate,
  onSlideDelete,
  onSlideAdd,
  onSlideEdit,
  lang = 'ru',
}: SlidesTimelineProps) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<{
    slideId: string;
    type: "move" | "resize-end";
    startX: number;
    startTime: number;
    startDuration: number;
  } | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Track scroll position
  useEffect(() => {
    const timelineEl = timelineRef.current;
    if (!timelineEl) return;

    const handleScroll = () => {
      const scrollTop = timelineEl.scrollTop;
      const scrollHeight = timelineEl.scrollHeight - timelineEl.clientHeight;
      const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
      setScrollProgress(progress);
    };

    timelineEl.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial calculation

    return () => timelineEl.removeEventListener('scroll', handleScroll);
  }, [slides.length]);

  const SLIDE_HEIGHT = 80;
  const SLIDE_VERTICAL_GAP = 15;
  const PIXELS_PER_SECOND = 100; // 100px = 1 секунда
  const CONTENT_HEIGHT = slides.length * (SLIDE_HEIGHT + SLIDE_VERTICAL_GAP) + 100; // Height of all slides

  // Calculate total timeline duration
  const totalDuration = slides.reduce((acc, slide) => {
    const slideStart = (slide as any).startTime || 0;
    return Math.max(acc, slideStart + slide.durationSec);
  }, 10); // Minimum 10 seconds

  const timeToPixels = (time: number) => time * PIXELS_PER_SECOND;
  const pixelsToTime = (pixels: number) => pixels / PIXELS_PER_SECOND;

  const handleMouseDown = (
    e: React.MouseEvent,
    slideId: string,
    type: "move" | "resize-end"
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const slide = slides.find((s) => s.id === slideId);
    if (!slide) return;

    setDragState({
      slideId,
      type,
      startX: e.clientX,
      startTime: (slide as any).startTime || 0,
      startDuration: slide.durationSec,
    });
  };

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragState.startX;
      const deltaTime = pixelsToTime(deltaX);

      const slide = slides.find((s) => s.id === dragState.slideId);
      if (!slide) return;

      if (dragState.type === "move") {
        // Move slide
        const newStartTime = Math.max(0, dragState.startTime + deltaTime);
        onSlideUpdate(dragState.slideId, {
          ...(slide as any),
          startTime: Math.round(newStartTime * 10) / 10,
        });
      } else if (dragState.type === "resize-end") {
        // Resize slide duration
        const newDuration = Math.max(0.5, dragState.startDuration + deltaTime);
        onSlideUpdate(dragState.slideId, {
          durationSec: Math.round(newDuration * 10) / 10,
        });
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState, slides, onSlideUpdate]);

  // Generate time markers
  const timeMarkers = [];
  for (let t = 0; t <= Math.ceil(totalDuration); t += 1) {
    timeMarkers.push(t);
  }

  return (
    <div className="w-full h-full space-y-3 p-4 bg-card overflow-hidden flex flex-col">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {lang === 'ru' ? 'Временная шкала слайдов' : 'Slides Timeline'}
        </h3>
        <div className="flex items-center gap-3">
          {/* Scroll indicator */}
          {slides.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg border border-border">
              <span className="text-xs font-medium text-foreground">
                {lang === 'ru' ? 'Прокрутка:' : 'Scroll:'}
              </span>
              <div className="w-32 h-3 bg-background rounded-full overflow-hidden border border-border">
                <div 
                  className="h-full bg-primary transition-all duration-200"
                  style={{ width: `${Math.min(100, scrollProgress + 20)}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-primary min-w-[3ch] text-right">
                {Math.round(scrollProgress)}%
              </span>
            </div>
          )}
          <span className="text-xs text-muted-foreground">
            {lang === 'ru' ? `Всего: ${slides.length} слайдов` : `Total: ${slides.length} slides`}
          </span>
          <Button
            size="sm"
            onClick={onSlideAdd}
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="w-4 h-4 mr-1" />
            {lang === 'ru' ? 'Добавить слайд' : 'Add Slide'}
          </Button>
        </div>
      </div>

      {slides.length === 0 ? (
        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-border rounded-lg">
          <div className="text-center p-8">
            <GripVertical className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground mb-4">
              {lang === 'ru' 
                ? 'Пока нет слайдов. Добавьте первый слайд вручную или создайте из текста.' 
                : 'No slides yet. Add your first slide manually or create from text.'}
            </p>
          </div>
        </div>
      ) : (
        <div
          ref={timelineRef}
          className="flex-1 relative bg-background border-2 border-border rounded-lg overflow-auto"
          style={{ maxHeight: '400px' }}
        >
          <div className="relative" style={{ width: `${timeToPixels(totalDuration + 2)}px`, minHeight: `${CONTENT_HEIGHT}px` }}>
        {/* Time markers */}
        <div className="absolute top-0 left-0 h-8 flex items-center px-2" style={{ width: '100%' }}>
          {timeMarkers.map((time) => (
            <div
              key={time}
              className="absolute text-xs font-medium text-muted-foreground"
              style={{ left: `${timeToPixels(time)}px`, transform: "translateX(-50%)" }}
            >
              {time}s
            </div>
          ))}
        </div>

        {/* Grid lines */}
        <div className="absolute top-8 left-0 bottom-0" style={{ width: `${timeToPixels(totalDuration + 2)}px` }}>
          {timeMarkers.map((time) => (
            <div
              key={time}
              className="absolute top-0 bottom-0 w-px bg-border/30"
              style={{ left: `${timeToPixels(time)}px` }}
            />
          ))}
        </div>

        {/* Slides */}
        <div className="absolute top-10 left-0 right-0 bottom-0 px-2 py-3" style={{ width: `${timeToPixels(totalDuration + 2)}px` }}>
          {slides.map((slide, index) => {
            const startTime = (slide as any).startTime || 0;
            const left = timeToPixels(startTime);
            const width = timeToPixels(slide.durationSec);
            const isSelected = slide.id === selectedSlideId;
            const topPosition = 10 + index * (SLIDE_HEIGHT + SLIDE_VERTICAL_GAP);

            return (
              <div
                key={slide.id}
                className={cn(
                  "absolute rounded-lg cursor-move transition-all group",
                  "border-2 overflow-hidden",
                  isSelected
                    ? "border-primary shadow-xl ring-4 ring-primary/30 z-20"
                    : "border-border hover:border-primary/50 hover:shadow-lg z-10"
                )}
                style={{
                  left: `${left}px`,
                  width: `${Math.max(width, 100)}px`,
                  height: `${SLIDE_HEIGHT}px`,
                  top: `${topPosition}px`,
                  backgroundColor: "hsl(var(--card))",
                }}
                onClick={() => onSlideSelect(slide.id)}
                onMouseDown={(e) => handleMouseDown(e, slide.id, "move")}
              >
                {/* Slide content */}
                <div className="absolute inset-0 p-3 flex flex-col pointer-events-none">
                  <div className="flex items-center gap-2 mb-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs font-mono text-muted-foreground flex-shrink-0">
                      #{index + 1}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary flex-shrink-0">
                      {slide.durationSec}s
                    </span>
                  </div>
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <p className="text-base font-semibold line-clamp-2 mb-1">
                      {slide.title}
                    </p>
                    {slide.body && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {slide.body}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSlideEdit(slide.id);
                    }}
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSlideDuplicate(slide.id);
                    }}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSlideDelete(slide.id);
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>

                {/* Resize handle - end */}
                <div
                  className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-primary/30 transition-colors flex items-center justify-center pointer-events-auto"
                  onMouseDown={(e) => handleMouseDown(e, slide.id, "resize-end")}
                >
                  <div className="w-1 h-8 bg-primary rounded-full" />
                </div>

                {/* Time label */}
                <div className="absolute -bottom-5 left-0 text-[10px] text-muted-foreground">
                  {startTime.toFixed(1)}s
                </div>
              </div>
            );
          })}
        </div>
        </div>
      </div>
      )}

      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 p-3 rounded flex-shrink-0">
        <span className="text-lg">💡</span>
        <div className="space-y-1">
          <p><strong>{lang === 'ru' ? 'Перетаскивайте слайды' : 'Drag slides'}</strong> {lang === 'ru' ? 'влево-вправо для изменения времени появления' : 'left-right to change start time'}</p>
          <p><strong>{lang === 'ru' ? 'Тяните за правый край' : 'Drag right edge'}</strong> {lang === 'ru' ? 'для изменения длительности слайда' : 'to change slide duration'}</p>
          <p><strong>{lang === 'ru' ? 'Каждый слайд на своей дорожке' : 'Each slide on its own track'}</strong> {lang === 'ru' ? 'для удобной работы' : 'for easy editing'}</p>
        </div>
      </div>
    </div>
  );
};