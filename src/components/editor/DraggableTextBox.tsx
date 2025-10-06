import { useState, useRef, useEffect } from "react";
import { Slide } from "@/types";

interface DraggableTextBoxProps {
  slide: Slide;
  containerWidth: number;
  containerHeight: number;
  onUpdate: (position: { x: number; y: number; width: number; height: number }) => void;
}

export const DraggableTextBox = ({
  slide,
  containerWidth,
  containerHeight,
  onUpdate,
}: DraggableTextBoxProps) => {
  const boxRef = useRef<HTMLDivElement>(null);
  
  // Default position if not set: center of screen
  const defaultPos = {
    x: 10, // 10% from left
    y: 30, // 30% from top
    width: 80, // 80% width
    height: 40, // 40% height
  };
  
  const position = slide.style.text.position || defaultPos;
  
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState(position);

  useEffect(() => {
    setCurrentPos(position);
  }, [position]);

  const handleMouseDown = (e: React.MouseEvent, isResize: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isResize) {
      setIsResizing(true);
    } else {
      setIsDragging(true);
    }
    
    setStartPos({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging && !isResizing) return;

      const deltaX = ((e.clientX - startPos.x) / containerWidth) * 100;
      const deltaY = ((e.clientY - startPos.y) / containerHeight) * 100;

      if (isDragging) {
        setCurrentPos((prev) => ({
          ...prev,
          x: Math.max(0, Math.min(100 - prev.width, prev.x + deltaX)),
          y: Math.max(0, Math.min(100 - prev.height, prev.y + deltaY)),
        }));
      } else if (isResizing) {
        setCurrentPos((prev) => ({
          ...prev,
          width: Math.max(20, Math.min(100 - prev.x, prev.width + deltaX)),
          height: Math.max(10, Math.min(100 - prev.y, prev.height + deltaY)),
        }));
      }

      setStartPos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
      if (isDragging || isResizing) {
        onUpdate(currentPos);
        setIsDragging(false);
        setIsResizing(false);
      }
    };

    if (isDragging || isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isResizing, startPos, currentPos, containerWidth, containerHeight, onUpdate]);

  return (
    <div
      ref={boxRef}
      className="absolute border-2 border-primary bg-primary/10 cursor-move"
      style={{
        left: `${currentPos.x}%`,
        top: `${currentPos.y}%`,
        width: `${currentPos.width}%`,
        height: `${currentPos.height}%`,
      }}
      onMouseDown={(e) => handleMouseDown(e, false)}
    >
      {/* Corner resize handle */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 bg-primary cursor-se-resize"
        onMouseDown={(e) => handleMouseDown(e, true)}
      />
      
      {/* Label */}
      <div className="absolute -top-6 left-0 text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
        Text Box - Drag to move, corner to resize
      </div>
    </div>
  );
};
