import { useState, useRef, useEffect } from "react";
import { TextBlock } from "@/types";
import { cn } from "@/lib/utils";
import { Play, Pause } from "lucide-react";

interface TextBlockTimelineProps {
  blocks: TextBlock[];
  slideDuration: number;
  onChange: (blocks: TextBlock[]) => void;
}

export const TextBlockTimeline = ({ blocks, slideDuration, onChange }: TextBlockTimelineProps) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<{
    blockIndex: number;
    type: "move" | "resize-start" | "resize-end";
    startX: number;
    startDelay: number;
    startDuration: number;
  } | null>(null);

  const TIMELINE_HEIGHT = 100;
  const BLOCK_HEIGHT = 50;
  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

  const getTimelineWidth = () => {
    return timelineRef.current?.offsetWidth || 600;
  };

  const timeToPixels = (time: number) => {
    const width = getTimelineWidth();
    return (time / slideDuration) * width;
  };

  const pixelsToTime = (pixels: number) => {
    const width = getTimelineWidth();
    return (pixels / width) * slideDuration;
  };

  const handleMouseDown = (
    e: React.MouseEvent,
    blockIndex: number,
    type: "move" | "resize-start" | "resize-end"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    
    const block = blocks[blockIndex];
    setDragState({
      blockIndex,
      type,
      startX: e.clientX,
      startDelay: block.delay || 0,
      startDuration: block.duration || slideDuration,
    });
  };

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragState.startX;
      const deltaTime = pixelsToTime(deltaX);
      
      const newBlocks = [...blocks];
      const block = newBlocks[dragState.blockIndex];

      if (dragState.type === "move") {
        let newDelay = Math.max(0, dragState.startDelay + deltaTime);
        const blockDuration = block.duration || slideDuration;
        
        if (blockDuration > 0) {
          newDelay = Math.min(newDelay, slideDuration - blockDuration);
        }
        
        block.delay = Math.round(newDelay * 10) / 10;
      } else if (dragState.type === "resize-end") {
        const newDuration = Math.max(0.1, dragState.startDuration + deltaTime);
        const blockStart = block.delay || 0;
        const maxDuration = slideDuration - blockStart;
        block.duration = Math.round(Math.min(newDuration, maxDuration) * 10) / 10;
      } else if (dragState.type === "resize-start") {
        let newDelay = Math.max(0, dragState.startDelay + deltaTime);
        let newDuration = Math.max(0.1, dragState.startDuration - deltaTime);
        
        if (newDelay + newDuration > slideDuration) {
          newDuration = slideDuration - newDelay;
        }
        
        block.delay = Math.round(newDelay * 10) / 10;
        block.duration = Math.round(newDuration * 10) / 10;
      }

      onChange(newBlocks);
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
  }, [dragState, blocks, slideDuration, onChange]);

  const timeMarkers = [];
  const markerInterval = slideDuration <= 5 ? 0.5 : slideDuration <= 10 ? 1 : 2;
  for (let t = 0; t <= slideDuration; t += markerInterval) {
    timeMarkers.push(t);
  }

  return (
    <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Временная шкала</span>
        <span className="text-sm text-muted-foreground">Длина: {slideDuration}с</span>
      </div>
      
      <div
        ref={timelineRef}
        className="relative bg-background border-2 border-border rounded-lg overflow-visible"
        style={{ height: TIMELINE_HEIGHT + 50 }}
      >
        {/* Time markers */}
        <div className="absolute -top-6 left-0 right-0 h-6 flex items-center px-2">
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
        <div className="absolute top-0 left-0 right-0 bottom-0">
          {timeMarkers.map((time) => (
            <div
              key={time}
              className="absolute top-0 bottom-0 w-px bg-border"
              style={{ left: `${timeToPixels(time)}px` }}
            />
          ))}
        </div>

        {/* Blocks - all on same horizontal line */}
        <div className="absolute top-0 left-0 right-0 bottom-0 px-2 py-3">
          {blocks.map((block, index) => {
            const delay = block.delay || 0;
            const duration = block.duration || slideDuration;
            const endTime = duration > 0 ? delay + duration : slideDuration;
            
            const left = timeToPixels(delay);
            const width = timeToPixels(endTime) - left;
            const color = COLORS[index % COLORS.length];

            return (
              <div
                key={index}
                className={cn(
                  "absolute rounded-md cursor-move transition-all hover:shadow-xl border-2",
                  dragState?.blockIndex === index 
                    ? "shadow-2xl ring-4 ring-primary/50 z-20 scale-105" 
                    : "hover:scale-102 border-white/20"
                )}
                style={{
                  left: `${left}px`,
                  width: `${Math.max(width, 50)}px`,
                  height: `${BLOCK_HEIGHT}px`,
                  backgroundColor: color,
                  top: "20px", // All blocks on same line
                  zIndex: dragState?.blockIndex === index ? 20 : 10 + index,
                }}
                onMouseDown={(e) => handleMouseDown(e, index, "move")}
              >
                {/* Resize handle - start */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/40 transition-colors flex items-center justify-center"
                  onMouseDown={(e) => handleMouseDown(e, index, "resize-start")}
                >
                  <div className="w-1 h-8 bg-white/80 rounded-full" />
                </div>
                
                {/* Block content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center px-4 pointer-events-none">
                  <span className="text-sm font-bold text-white drop-shadow-lg truncate max-w-full">
                    Блок {index + 1}
                  </span>
                  <span className="text-[10px] text-white/90 whitespace-nowrap">
                    {delay.toFixed(1)}s → {endTime.toFixed(1)}s
                  </span>
                </div>

                {/* Resize handle - end */}
                <div
                  className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/40 transition-colors flex items-center justify-center"
                  onMouseDown={(e) => handleMouseDown(e, index, "resize-end")}
                >
                  <div className="w-1 h-8 bg-white/80 rounded-full" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 p-3 rounded">
        <span className="text-lg">💡</span>
        <div className="space-y-1">
          <p><strong>Перетаскивайте блоки</strong> для изменения времени появления</p>
          <p><strong>Тяните за края</strong> (белые полоски) для изменения длительности</p>
          <p><strong>Если длительность = 0</strong>, блок остается до конца слайда</p>
        </div>
      </div>
    </div>
  );
};