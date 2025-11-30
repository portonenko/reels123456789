import { useState, useRef, useEffect } from "react";
import { TextBlock } from "@/types";
import { cn } from "@/lib/utils";

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

  const TIMELINE_HEIGHT = 60;
  const BLOCK_HEIGHT = 40;
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
        // Move the block (change delay)
        let newDelay = Math.max(0, dragState.startDelay + deltaTime);
        const blockDuration = block.duration || slideDuration;
        
        // Don't allow moving beyond slide duration
        if (blockDuration > 0) {
          newDelay = Math.min(newDelay, slideDuration - blockDuration);
        }
        
        block.delay = Math.round(newDelay * 10) / 10;
      } else if (dragState.type === "resize-end") {
        // Resize from the end (change duration)
        const newDuration = Math.max(0.1, dragState.startDuration + deltaTime);
        const blockStart = block.delay || 0;
        
        // Don't allow resizing beyond slide duration
        const maxDuration = slideDuration - blockStart;
        block.duration = Math.round(Math.min(newDuration, maxDuration) * 10) / 10;
      } else if (dragState.type === "resize-start") {
        // Resize from the start (change both delay and duration)
        let newDelay = Math.max(0, dragState.startDelay + deltaTime);
        let newDuration = Math.max(0.1, dragState.startDuration - deltaTime);
        
        // Don't allow resizing beyond slide duration
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

  // Generate time markers
  const timeMarkers = [];
  const markerInterval = slideDuration <= 5 ? 0.5 : slideDuration <= 10 ? 1 : 2;
  for (let t = 0; t <= slideDuration; t += markerInterval) {
    timeMarkers.push(t);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground px-2">
        <span>Временная шкала</span>
        <span>{slideDuration}с</span>
      </div>
      
      <div
        ref={timelineRef}
        className="relative bg-background border border-border rounded-lg overflow-hidden"
        style={{ height: TIMELINE_HEIGHT + 30 }}
      >
        {/* Time markers */}
        <div className="absolute top-0 left-0 right-0 h-6 border-b border-border/50 flex items-end">
          {timeMarkers.map((time) => (
            <div
              key={time}
              className="absolute text-[10px] text-muted-foreground"
              style={{ left: `${timeToPixels(time)}px`, transform: "translateX(-50%)" }}
            >
              {time}s
            </div>
          ))}
        </div>

        {/* Grid lines */}
        <div className="absolute top-6 left-0 right-0 bottom-0">
          {timeMarkers.map((time) => (
            <div
              key={time}
              className="absolute top-0 bottom-0 w-px bg-border/30"
              style={{ left: `${timeToPixels(time)}px` }}
            />
          ))}
        </div>

        {/* Blocks */}
        <div className="absolute top-6 left-0 right-0 bottom-0 px-1 py-2">
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
                  "absolute rounded cursor-move transition-shadow hover:shadow-lg",
                  dragState?.blockIndex === index && "shadow-xl ring-2 ring-primary"
                )}
                style={{
                  left: `${left}px`,
                  width: `${width}px`,
                  height: `${BLOCK_HEIGHT}px`,
                  backgroundColor: color,
                  opacity: 0.8,
                }}
                onMouseDown={(e) => handleMouseDown(e, index, "move")}
              >
                {/* Resize handle - start */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 transition-colors"
                  onMouseDown={(e) => handleMouseDown(e, index, "resize-start")}
                />
                
                {/* Block content */}
                <div className="absolute inset-0 flex items-center justify-center px-2 pointer-events-none">
                  <span className="text-[10px] font-medium text-white truncate">
                    Блок {index + 1}
                  </span>
                </div>

                {/* Resize handle - end */}
                <div
                  className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 transition-colors"
                  onMouseDown={(e) => handleMouseDown(e, index, "resize-end")}
                />

                {/* Time labels */}
                <div className="absolute -bottom-5 left-0 text-[9px] text-muted-foreground">
                  {delay.toFixed(1)}s
                </div>
                {duration > 0 && (
                  <div className="absolute -bottom-5 right-0 text-[9px] text-muted-foreground">
                    {endTime.toFixed(1)}s
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-xs text-muted-foreground px-2">
        💡 Перетаскивайте блоки для изменения времени появления, тяните за края для изменения длительности
      </div>
    </div>
  );
};