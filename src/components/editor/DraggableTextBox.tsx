import { useState, useRef, useEffect, useMemo } from "react";
import { Slide } from "@/types";
import { Button } from "@/components/ui/button";
import { AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter, Maximize2 } from "lucide-react";

// Default position constant to avoid recreating on each render
const DEFAULT_POSITION = {
  x: 10, // 10% from left
  y: 30, // 30% from top
  width: 80, // 80% width
  height: 40, // 40% height
};

interface DraggableTextBoxProps {
  slide: Slide;
  containerWidth: number;
  containerHeight: number;
  onUpdate: (position: { x: number; y: number; width: number; height: number }) => void;
  lang?: 'en' | 'ru';
}

export const DraggableTextBox = ({
  slide,
  containerWidth,
  containerHeight,
  onUpdate,
  lang = 'en',
}: DraggableTextBoxProps) => {
  const boxRef = useRef<HTMLDivElement>(null);
  
  // Memoize position to avoid unnecessary rerenders
  const position = useMemo(() => 
    slide.style.text.position || DEFAULT_POSITION,
    [slide.style.text.position]
  );
  
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

  const centerHorizontally = () => {
    const newPos = {
      ...currentPos,
      x: (100 - currentPos.width) / 2,
    };
    setCurrentPos(newPos);
    onUpdate(newPos);
  };

  const centerVertically = () => {
    const newPos = {
      ...currentPos,
      y: (100 - currentPos.height) / 2,
    };
    setCurrentPos(newPos);
    onUpdate(newPos);
  };

  const centerBoth = () => {
    const newPos = {
      ...currentPos,
      x: (100 - currentPos.width) / 2,
      y: (100 - currentPos.height) / 2,
    };
    setCurrentPos(newPos);
    onUpdate(newPos);
  };

  return (
    <>
      {/* Centering controls toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/80 p-2 rounded-lg z-20">
        <Button
          size="sm"
          variant="secondary"
          onClick={centerHorizontally}
          className="text-xs"
        >
          <AlignHorizontalJustifyCenter className="w-3 h-3 mr-1" />
          {lang === 'ru' ? 'Центр X' : 'Center X'}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={centerVertically}
          className="text-xs"
        >
          <AlignVerticalJustifyCenter className="w-3 h-3 mr-1" />
          {lang === 'ru' ? 'Центр Y' : 'Center Y'}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={centerBoth}
          className="text-xs"
        >
          <Maximize2 className="w-3 h-3 mr-1" />
          {lang === 'ru' ? 'По центру' : 'Center All'}
        </Button>
      </div>

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
        {lang === 'ru' 
          ? 'Текстовый блок - перетащите для перемещения, угол для изменения размера' 
          : 'Text Box - Drag to move, corner to resize'
        }
      </div>
    </div>
    </>
  );
};
