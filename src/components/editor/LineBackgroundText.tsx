import React from "react";

interface LineBackgroundTextProps {
  text: string;
  style: React.CSSProperties;
  className?: string;
  lineBackground: {
    color: string;
    opacity: number;
    paddingX: number;
    paddingY: number;
  };
  alignment: "left" | "center" | "right";
}

export const LineBackgroundText: React.FC<LineBackgroundTextProps> = ({
  text,
  style,
  className,
  lineBackground,
  alignment,
}) => {
  const lines = text.split('\n').filter(line => line.trim());
  
  const hexToRgba = (hex: string, opacity: number) => {
    if (hex.startsWith('#')) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    return hex;
  };

  const containerAlignment = 
    alignment === 'left' ? 'flex-start' : 
    alignment === 'right' ? 'flex-end' : 
    'center';

  return (
    <div 
      className={className}
      style={{
        ...style,
        display: 'flex',
        flexDirection: 'column',
        alignItems: containerAlignment,
        gap: `${lineBackground.paddingY}px`,
      }}
    >
      {lines.map((line, index) => (
        <span
          key={index}
          style={{
            display: 'inline-block',
            backgroundColor: hexToRgba(lineBackground.color, lineBackground.opacity),
            paddingLeft: `${lineBackground.paddingX}px`,
            paddingRight: `${lineBackground.paddingX}px`,
            paddingTop: `${lineBackground.paddingY}px`,
            paddingBottom: `${lineBackground.paddingY}px`,
            lineHeight: 'inherit',
          }}
        >
          {line}
        </span>
      ))}
    </div>
  );
};
