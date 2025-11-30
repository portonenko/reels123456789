import { useState, useEffect, useRef } from 'react';

interface ColorToolbarProps {
  targetRef: HTMLInputElement | HTMLTextAreaElement | null;
  onColorApply: (color: string) => void;
}

export const ColorToolbar = ({ targetRef, onColorApply }: ColorToolbarProps) => {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const colors = [
    { name: 'Красный', color: '#FF0000' },
    { name: 'Оранжевый', color: '#FF8800' },
    { name: 'Желтый', color: '#FFFF00' },
    { name: 'Зеленый', color: '#00FF00' },
    { name: 'Голубой', color: '#00FFFF' },
    { name: 'Синий', color: '#0000FF' },
    { name: 'Фиолетовый', color: '#FF00FF' },
    { name: 'Розовый', color: '#FF69B4' },
    { name: 'Белый', color: '#FFFFFF' },
  ];

  useEffect(() => {
    if (!targetRef) return;

    const checkSelection = () => {
      const start = targetRef.selectionStart || 0;
      const end = targetRef.selectionEnd || 0;
      const hasSelection = end > start;

      if (hasSelection && document.activeElement === targetRef) {
        const rect = targetRef.getBoundingClientRect();
        // Position toolbar above the input
        setPosition({
          top: rect.top + window.scrollY - 45,
          left: rect.left + window.scrollX + rect.width / 2,
        });
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    const handleMouseUp = () => {
      setTimeout(checkSelection, 10);
    };

    const handleKeyUp = () => {
      setTimeout(checkSelection, 10);
    };

    targetRef.addEventListener('mouseup', handleMouseUp);
    targetRef.addEventListener('keyup', handleKeyUp);
    targetRef.addEventListener('select', checkSelection);

    return () => {
      targetRef.removeEventListener('mouseup', handleMouseUp);
      targetRef.removeEventListener('keyup', handleKeyUp);
      targetRef.removeEventListener('select', checkSelection);
    };
  }, [targetRef]);

  if (!isVisible || !position) return null;

  return (
    <div
      ref={toolbarRef}
      className="fixed z-[9999] flex gap-1 p-1.5 bg-popover border border-border rounded-lg shadow-xl"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translateX(-50%)',
      }}
      onMouseDown={(e) => e.preventDefault()} // Prevent losing focus
    >
      {colors.map((c) => (
        <button
          key={c.color}
          onMouseDown={(e) => {
            e.preventDefault();
            onColorApply(c.color);
          }}
          className="w-7 h-7 rounded border-2 border-border hover:scale-110 hover:border-foreground transition-all"
          style={{ backgroundColor: c.color }}
          title={c.name}
        />
      ))}
    </div>
  );
};
