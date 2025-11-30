import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';

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

    const handleSelectionChange = () => {
      const selection = window.getSelection();
      const selectedText = selection?.toString() || '';

      if (selectedText.length > 0 && document.activeElement === targetRef) {
        const range = selection?.getRangeAt(0);
        if (range) {
          const rect = range.getBoundingClientRect();
          setPosition({
            top: rect.top - 50,
            left: rect.left + rect.width / 2,
          });
          setIsVisible(true);
        }
      } else {
        setIsVisible(false);
      }
    };

    const handleMouseUp = () => {
      setTimeout(handleSelectionChange, 10);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    targetRef.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      targetRef.removeEventListener('mouseup', handleMouseUp);
    };
  }, [targetRef]);

  if (!isVisible || !position) return null;

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 flex gap-1 p-2 bg-popover border border-border rounded-lg shadow-lg"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translateX(-50%)',
      }}
    >
      {colors.map((c) => (
        <button
          key={c.color}
          onClick={() => {
            onColorApply(c.color);
            setIsVisible(false);
          }}
          className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
          style={{ backgroundColor: c.color }}
          title={c.name}
        />
      ))}
    </div>
  );
};
