import { useState, useRef, useEffect } from "react";
import { Slide, TextBlock } from "@/types";
import { cn } from "@/lib/utils";
import { Move, X } from "lucide-react";

interface TextBlockPositionEditorProps {
  slide: Slide;
  onUpdateSlide: (updates: Partial<Slide>) => void;
  containerWidth: number;
  containerHeight: number;
}

export const TextBlockPositionEditor = ({
  slide,
  onUpdateSlide,
  containerWidth,
  containerHeight,
}: TextBlockPositionEditorProps) => {
  const [draggedBlockIndex, setDraggedBlockIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const textBlocks = slide.textBlocks || [{ title: slide.title, body: slide.body }];

  const handleMouseDown = (e: React.MouseEvent, blockIndex: number) => {
    e.preventDefault();
    const block = textBlocks[blockIndex];
    const blockX = ((block.position?.x || 50) / 100) * containerWidth;
    const blockY = ((block.position?.y || 50) / 100) * containerHeight;
    
    setDragOffset({
      x: e.clientX - blockX,
      y: e.clientY - blockY,
    });
    setDraggedBlockIndex(blockIndex);
  };

  useEffect(() => {
    if (draggedBlockIndex === null) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - dragOffset.x;
      const y = e.clientY - rect.top - dragOffset.y;
      
      // Convert to percentage
      const xPercent = Math.max(0, Math.min(100, (x / containerWidth) * 100));
      const yPercent = Math.max(0, Math.min(100, (y / containerHeight) * 100));
      
      // Update block position
      const updatedBlocks = [...textBlocks];
      updatedBlocks[draggedBlockIndex] = {
        ...updatedBlocks[draggedBlockIndex],
        position: { x: Math.round(xPercent), y: Math.round(yPercent) },
      };
      
      onUpdateSlide({ textBlocks: updatedBlocks });
    };

    const handleMouseUp = () => {
      setDraggedBlockIndex(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggedBlockIndex, dragOffset, containerWidth, containerHeight, textBlocks, onUpdateSlide]);

  const resetPosition = (blockIndex: number) => {
    const updatedBlocks = [...textBlocks];
    updatedBlocks[blockIndex] = {
      ...updatedBlocks[blockIndex],
      position: undefined,
    };
    onUpdateSlide({ textBlocks: updatedBlocks });
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none"
      style={{ width: containerWidth, height: containerHeight }}
    >
      {textBlocks.map((block, index) => {
        const x = ((block.position?.x || 50) / 100) * containerWidth;
        const y = ((block.position?.y || 50) / 100) * containerHeight;
        const isDragging = draggedBlockIndex === index;

        return (
          <div
            key={index}
            className={cn(
              "absolute pointer-events-auto cursor-move transition-all",
              isDragging && "scale-110 z-50"
            )}
            style={{
              left: `${x}px`,
              top: `${y}px`,
              transform: "translate(-50%, -50%)",
            }}
            onMouseDown={(e) => handleMouseDown(e, index)}
          >
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border-2",
                "bg-primary/90 text-primary-foreground backdrop-blur-sm",
                isDragging ? "border-primary-foreground shadow-2xl" : "border-primary-foreground/50 hover:border-primary-foreground"
              )}
            >
              <Move className="w-4 h-4 flex-shrink-0" />
              <div className="text-xs font-semibold max-w-[200px] truncate">
                {block.title || `Блок ${index + 1}`}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  resetPosition(index);
                }}
                className="ml-1 p-1 hover:bg-primary-foreground/20 rounded transition-colors"
                title="Сбросить позицию"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-mono text-primary-foreground/60 pointer-events-none mt-8">
              {block.position?.x || 50}%, {block.position?.y || 50}%
            </div>
          </div>
        );
      })}
    </div>
  );
};
