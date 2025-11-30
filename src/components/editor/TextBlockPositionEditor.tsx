import { useState, useRef, useEffect } from "react";
import { Slide } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
  const containerRef = useRef<HTMLDivElement>(null);

  const textBlocks = slide.textBlocks || [{ title: slide.title, body: slide.body }];

  const handleMouseDown = (e: React.MouseEvent, blockIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedBlockIndex(blockIndex);
  };

  useEffect(() => {
    if (draggedBlockIndex === null) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      const clampedX = Math.max(0, Math.min(100, x));
      const clampedY = Math.max(0, Math.min(100, y));

      const updatedBlocks = [...textBlocks];
      updatedBlocks[draggedBlockIndex] = {
        ...updatedBlocks[draggedBlockIndex],
        position: { x: Math.round(clampedX), y: Math.round(clampedY) },
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
  }, [draggedBlockIndex, textBlocks, onUpdateSlide, containerWidth, containerHeight]);

  const handleCenterX = (e: React.MouseEvent, blockIndex: number) => {
    e.stopPropagation();
    const updatedBlocks = [...textBlocks];
    const currentY = updatedBlocks[blockIndex].position?.y || 50;
    updatedBlocks[blockIndex] = {
      ...updatedBlocks[blockIndex],
      position: { x: 50, y: currentY },
    };
    onUpdateSlide({ textBlocks: updatedBlocks });
  };

  const handleCenterY = (e: React.MouseEvent, blockIndex: number) => {
    e.stopPropagation();
    const updatedBlocks = [...textBlocks];
    const currentX = updatedBlocks[blockIndex].position?.x || 50;
    updatedBlocks[blockIndex] = {
      ...updatedBlocks[blockIndex],
      position: { x: currentX, y: 50 },
    };
    onUpdateSlide({ textBlocks: updatedBlocks });
  };

  const handleCenterAll = (e: React.MouseEvent, blockIndex: number) => {
    e.stopPropagation();
    const updatedBlocks = [...textBlocks];
    updatedBlocks[blockIndex] = {
      ...updatedBlocks[blockIndex],
      position: { x: 50, y: 50 },
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
        const position = block.position || { x: 50, y: 50 };
        const left = (position.x / 100) * containerWidth;
        const top = (position.y / 100) * containerHeight;
        const isDragging = draggedBlockIndex === index;

        // Clean text from color tags and formatting
        const cleanTitle = block.title.replace(/^\[.*?\]\s*/, '').replace(/\[#[0-9a-fA-F]{6}\]/g, '').replace(/\[\]/g, '');
        const cleanBody = block.body?.replace(/^\[.*?\]\s*/, '').replace(/\[#[0-9a-fA-F]{6}\]/g, '').replace(/\[\]/g, '');

        return (
          <div
            key={index}
            className="absolute pointer-events-auto"
            style={{
              left: `${left}px`,
              top: `${top}px`,
              transform: "translate(-50%, -50%)",
            }}
          >
            {/* Draggable text preview */}
            <div
              className={cn(
                "bg-primary/90 backdrop-blur-sm text-primary-foreground rounded-lg cursor-move shadow-xl border-2 transition-all",
                "px-4 py-3 min-w-[140px] max-w-[280px]",
                isDragging
                  ? "scale-110 border-accent shadow-2xl"
                  : "border-primary-foreground/30 hover:border-primary-foreground/60 hover:bg-primary"
              )}
              onMouseDown={(e) => handleMouseDown(e, index)}
            >
              <div className="flex flex-col gap-1">
                <span className="text-sm font-bold leading-tight line-clamp-2">
                  {cleanTitle}
                </span>
                {cleanBody && (
                  <span className="text-xs opacity-80 leading-tight line-clamp-1">
                    {cleanBody}
                  </span>
                )}
                <span className="text-[10px] opacity-60 mt-1 font-mono">
                  {Math.round(position.x)}%, {Math.round(position.y)}%
                </span>
              </div>
            </div>

            {/* Center buttons */}
            <div className="flex gap-1 mt-2 justify-center">
              <Button
                size="sm"
                variant="secondary"
                className="h-7 px-2 text-xs"
                onClick={(e) => handleCenterX(e, index)}
              >
                Center X
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="h-7 px-2 text-xs"
                onClick={(e) => handleCenterY(e, index)}
              >
                Center Y
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="h-7 px-2 text-xs"
                onClick={(e) => handleCenterAll(e, index)}
              >
                Center All
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
