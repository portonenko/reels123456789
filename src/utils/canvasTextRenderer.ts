import { Slide } from "@/types";

export interface TextRenderConfig {
  canvas: HTMLCanvasElement;
  slide: Slide;
  globalOverlay: number;
  backgroundVideo?: HTMLVideoElement;
  transitionProgress?: number;
}

interface TextSegment {
  text: string;
  color: string;
}

/**
 * Parse text with inline color tags [#HEXCOLOR]text[]
 * Returns array of segments with their colors
 */
const parseColoredText = (text: string, defaultColor: string): TextSegment[] => {
  const segments: TextSegment[] = [];
  const regex = /\[#([0-9a-fA-F]{6})\](.*?)\[\]/g;
  let lastIndex = 0;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    // Add text before colored segment
    if (match.index > lastIndex) {
      segments.push({
        text: text.substring(lastIndex, match.index),
        color: defaultColor
      });
    }
    // Add colored segment
    segments.push({
      text: match[2],
      color: `#${match[1]}`
    });
    lastIndex = regex.lastIndex;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      text: text.substring(lastIndex),
      color: defaultColor
    });
  }
  
  // If no segments, return default
  if (segments.length === 0) {
    segments.push({ text, color: defaultColor });
  }
  
  return segments;
};

/**
 * Unified text rendering function used by both preview and export
 * Ensures identical visual output
 */
export const renderSlideText = (
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  canvas: { width: number; height: number },
  options: {
    transitionProgress?: number;
    isPreview?: boolean; // If true, render at 1/3 scale
  } = {}
) => {
  const scale = options.isPreview ? 3 : 1;
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  // Calculate safe margins
  const safeTop = (slide.style.safeMarginTop / 100) * canvasHeight;
  const safeBottom = (slide.style.safeMarginBottom / 100) * canvasHeight;
  const contentHeight = canvasHeight - safeTop - safeBottom;

  // Use text blocks if available, otherwise fall back to single title/body
  const textBlocks = slide.textBlocks && slide.textBlocks.length > 0 
    ? slide.textBlocks 
    : [{ title: slide.title, body: slide.body }];

  // Extract clean text
  const cleanTitle = slide.title.replace(/^\[.*?\]\s*/, '');
  const cleanBody = slide.body?.replace(/^\[.*?\]\s*/, '');

  // Set text properties
  ctx.textAlign = slide.style.text.alignment as CanvasTextAlign;
  ctx.textBaseline = "middle";

  const centerX = canvasWidth / 2;
  let textY = safeTop + contentHeight / 2;

  // Calculate position and width
  let textX = centerX;
  let textBoxWidth = canvasWidth * 0.80; // Default 80% width
  
  if (slide.style.text.position) {
    textX = (slide.style.text.position.x / 100) * canvasWidth + (slide.style.text.position.width / 100 * canvasWidth) / 2;
    textBoxWidth = (slide.style.text.position.width / 100) * canvasWidth;
    textY = (slide.style.text.position.y / 100) * canvasHeight + (slide.style.text.position.height / 100 * canvasHeight) / 2;
  }

  // Helper to measure segment width with letter spacing
  const measureSegment = (text: string, fontSize: number, letterSpacing: number) => {
    const baseWidth = ctx.measureText(text).width;
    const spacingPx = letterSpacing * fontSize;
    return baseWidth + (text.length - 1) * spacingPx;
  };

  // Helper to wrap text segments into lines
  const wrapSegments = (segments: TextSegment[], fontSize: number, letterSpacing: number, maxWidth: number) => {
    const lines: TextSegment[][] = [];
    let currentLine: TextSegment[] = [];
    let currentWidth = 0;
    
    segments.forEach(segment => {
      const words = segment.text.split(' ');
      
      words.forEach((word, wordIndex) => {
        const wordWithSpace = wordIndex < words.length - 1 ? word + ' ' : word;
        const wordWidth = measureSegment(wordWithSpace, fontSize, letterSpacing);
        
        if (currentWidth + wordWidth > maxWidth && currentLine.length > 0) {
          // Start new line
          lines.push(currentLine);
          currentLine = [{ text: wordWithSpace, color: segment.color }];
          currentWidth = wordWidth;
        } else {
          // Add to current line
          if (currentLine.length > 0 && currentLine[currentLine.length - 1].color === segment.color) {
            // Merge with previous segment if same color
            currentLine[currentLine.length - 1].text += wordWithSpace;
          } else {
            currentLine.push({ text: wordWithSpace, color: segment.color });
          }
          currentWidth += wordWidth;
        }
      });
    });
    
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
    
    return lines;
  };

  // Helper to measure line width
  const measureLine = (segments: TextSegment[], fontSize: number, letterSpacing: number) => {
    return segments.reduce((total, seg) => total + measureSegment(seg.text, fontSize, letterSpacing), 0);
  };

  // Process all text blocks
  const processedBlocks = textBlocks.map(block => {
    const cleanBlockTitle = block.title.replace(/^\[.*?\]\s*/, '');
    const cleanBlockBody = block.body?.replace(/^\[.*?\]\s*/, '');

    // Parse and wrap title text with colors
    ctx.font = `${slide.style.text.fontWeight} ${slide.style.text.fontSize}px ${slide.style.text.fontFamily}`;
    const titleSegments = parseColoredText(cleanBlockTitle, slide.style.text.color);
    const titleLines = wrapSegments(titleSegments, slide.style.text.fontSize, slide.style.text.letterSpacing, textBoxWidth);
    
    const maxTitleWidth = Math.max(...titleLines.map(line => measureLine(line, slide.style.text.fontSize, slide.style.text.letterSpacing)));
    const titleLineHeight = slide.style.text.fontSize * slide.style.text.lineHeight;
    const titleBlockHeight = titleLines.length * titleLineHeight;

    // Parse and wrap body text with colors
    let bodyLines: TextSegment[][] = [];
    let maxBodyWidth = 0;
    let bodyBlockHeight = 0;
    
    if (cleanBlockBody) {
      const bodyFontSize = slide.style.text.bodyFontSize || slide.style.text.fontSize * 0.5;
      const bodyColor = slide.style.text.bodyColor || slide.style.text.color;
      ctx.font = `${slide.style.text.bodyFontWeight || slide.style.text.fontWeight - 200} ${bodyFontSize}px ${slide.style.text.bodyFontFamily || slide.style.text.fontFamily}`;
      const bodySegments = parseColoredText(cleanBlockBody, bodyColor);
      bodyLines = wrapSegments(bodySegments, bodyFontSize, slide.style.text.letterSpacing, textBoxWidth);
      
      maxBodyWidth = Math.max(...bodyLines.map(line => measureLine(line, bodyFontSize, slide.style.text.letterSpacing)));
      const bodyLineHeight = bodyFontSize * slide.style.text.lineHeight * 1.2;
      bodyBlockHeight = bodyLines.length * bodyLineHeight;
    }

    return {
      titleLines,
      bodyLines,
      maxTitleWidth,
      maxBodyWidth,
      titleBlockHeight,
      bodyBlockHeight,
      titleLineHeight,
      bodyLineHeight: cleanBlockBody ? (slide.style.text.bodyFontSize || slide.style.text.fontSize * 0.5) * slide.style.text.lineHeight * 1.2 : 0,
    };
  });

  // Calculate total dimensions
  const blockSpacing = 40; // Space between blocks
  let maxWidth = 0;
  let totalHeight = 0;
  
  processedBlocks.forEach((block, index) => {
    maxWidth = Math.max(maxWidth, block.maxTitleWidth, block.maxBodyWidth);
    totalHeight += block.titleBlockHeight;
    if (block.bodyBlockHeight > 0) {
      totalHeight += 30 + block.bodyBlockHeight; // Space between title and body
    }
    if (index < processedBlocks.length - 1) {
      totalHeight += blockSpacing; // Space between blocks
    }
  });

  // Draw background plate if enabled
  if (slide.style.plate.enabled) {
    const plateWidth = maxWidth + slide.style.plate.padding * 2;
    const plateHeight = totalHeight + slide.style.plate.padding * 2;

    const bgColor = slide.style.plate.backgroundColor;
    const plateOpacity = slide.style.plate.opacity;
    
    let r = 0, g = 0, b = 0;
    if (bgColor.startsWith('#')) {
      r = parseInt(bgColor.slice(1, 3), 16);
      g = parseInt(bgColor.slice(3, 5), 16);
      b = parseInt(bgColor.slice(5, 7), 16);
    } else if (bgColor.startsWith('rgb')) {
      const match = bgColor.match(/(\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        r = parseInt(match[1]);
        g = parseInt(match[2]);
        b = parseInt(match[3]);
      }
    }
    
    ctx.save();
    
    const plateX = textX - plateWidth / 2;
    const plateY = textY - totalHeight / 2 - slide.style.plate.padding;
    const blurSize = slide.style.plate.blurSize || 30;
    
    // Main plate
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${plateOpacity})`;
    ctx.beginPath();
    if (slide.style.plate.borderRadius > 0) {
      const radius = slide.style.plate.borderRadius;
      ctx.moveTo(plateX + radius, plateY);
      ctx.lineTo(plateX + plateWidth - radius, plateY);
      ctx.quadraticCurveTo(plateX + plateWidth, plateY, plateX + plateWidth, plateY + radius);
      ctx.lineTo(plateX + plateWidth, plateY + plateHeight - radius);
      ctx.quadraticCurveTo(plateX + plateWidth, plateY + plateHeight, plateX + plateWidth - radius, plateY + plateHeight);
      ctx.lineTo(plateX + radius, plateY + plateHeight);
      ctx.quadraticCurveTo(plateX, plateY + plateHeight, plateX, plateY + plateHeight - radius);
      ctx.lineTo(plateX, plateY + radius);
      ctx.quadraticCurveTo(plateX, plateY, plateX + radius, plateY);
      ctx.closePath();
    } else {
      ctx.rect(plateX, plateY, plateWidth, plateHeight);
    }
    ctx.fill();
    
    // Blur layers
    const layers = 15;
    for (let i = 0; i < layers; i++) {
      const offset = (i / layers) * blurSize;
      const alpha = plateOpacity * (1 - i / layers) * 0.3;
      
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.beginPath();
      
      if (slide.style.plate.borderRadius > 0) {
        const radius = slide.style.plate.borderRadius + offset;
        const x = plateX - offset;
        const y = plateY - offset;
        const w = plateWidth + offset * 2;
        const h = plateHeight + offset * 2;
        
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
      } else {
        ctx.rect(plateX - offset, plateY - offset, plateWidth + offset * 2, plateHeight + offset * 2);
      }
      ctx.fill();
    }
    
    ctx.restore();
  }

  // Calculate starting Y position
  let currentY;
  if (slide.style.plate.enabled) {
    const plateTop = textY - totalHeight / 2 - slide.style.plate.padding;
    currentY = plateTop + slide.style.plate.padding + processedBlocks[0].titleLineHeight / 2;
  } else {
    currentY = textY - (totalHeight / 2);
  }

  // Draw text shadow for all blocks
  const shadowIntensity = slide.style.text.shadowIntensity || 10;
  const shadowRadius = slide.style.text.shadowRadius || 20;
  
  if (shadowIntensity > 0 && shadowRadius > 0) {
    const shadowLayers = 8;
    for (let i = 0; i < shadowLayers; i++) {
      const layerOpacity = (shadowIntensity / 10) * (1 - i / shadowLayers) / shadowLayers;
      const layerOffset = (shadowRadius * 0.5) * (1 + i / shadowLayers);
      const layerBlur = (shadowRadius * 3) / shadowLayers;
      
      ctx.save();
      ctx.shadowColor = `rgba(0, 0, 0, ${layerOpacity})`;
      ctx.shadowBlur = layerBlur;
      ctx.shadowOffsetX = layerOffset;
      ctx.shadowOffsetY = layerOffset;
      ctx.globalAlpha = 0.3;
      
      let shadowY = currentY;
      
      processedBlocks.forEach((block, blockIndex) => {
        // Title shadow
        ctx.font = `${slide.style.text.fontWeight} ${slide.style.text.fontSize}px ${slide.style.text.fontFamily}`;
        block.titleLines.forEach((lineSegments) => {
          // Calculate line width for proper alignment
          const lineWidth = measureLine(lineSegments, slide.style.text.fontSize, slide.style.text.letterSpacing);
          let segmentX = textX;
          
          if (ctx.textAlign === 'center') {
            segmentX = textX - lineWidth / 2;
          } else if (ctx.textAlign === 'right') {
            segmentX = textX - lineWidth;
          }
          
          const savedAlign = ctx.textAlign;
          ctx.textAlign = 'left';
          
          lineSegments.forEach(segment => {
            let displayText = segment.text;
            if (slide.style.text.textTransform === 'uppercase') {
              displayText = segment.text.toUpperCase();
            } else if (slide.style.text.textTransform === 'lowercase') {
              displayText = segment.text.toLowerCase();
            } else if (slide.style.text.textTransform === 'capitalize') {
              displayText = segment.text.replace(/\b\w/g, l => l.toUpperCase());
            }
            ctx.fillStyle = segment.color;
            ctx.fillText(displayText, segmentX, shadowY);
            segmentX += measureSegment(displayText, slide.style.text.fontSize, slide.style.text.letterSpacing);
          });
          
          ctx.textAlign = savedAlign;
          shadowY += block.titleLineHeight;
        });
        
        // Body shadow
        if (block.bodyLines.length > 0) {
          shadowY += 30;
          const bodyFontSize = slide.style.text.bodyFontSize || slide.style.text.fontSize * 0.5;
          ctx.font = `${slide.style.text.bodyFontWeight || slide.style.text.fontWeight - 200} ${bodyFontSize}px ${slide.style.text.bodyFontFamily || slide.style.text.fontFamily}`;
          
          block.bodyLines.forEach((lineSegments) => {
            // Calculate line width for proper alignment
            const lineWidth = measureLine(lineSegments, bodyFontSize, slide.style.text.letterSpacing);
            let segmentX = textX;
            
            if (ctx.textAlign === 'center') {
              segmentX = textX - lineWidth / 2;
            } else if (ctx.textAlign === 'right') {
              segmentX = textX - lineWidth;
            }
            
            const savedAlign = ctx.textAlign;
            ctx.textAlign = 'left';
            
            lineSegments.forEach(segment => {
              let displayText = segment.text;
              if (slide.style.text.textTransform === 'uppercase') {
                displayText = segment.text.toUpperCase();
              } else if (slide.style.text.textTransform === 'lowercase') {
                displayText = segment.text.toLowerCase();
              } else if (slide.style.text.textTransform === 'capitalize') {
                displayText = segment.text.replace(/\b\w/g, l => l.toUpperCase());
              }
              ctx.fillStyle = segment.color;
              ctx.fillText(displayText, segmentX, shadowY);
              segmentX += measureSegment(displayText, bodyFontSize, slide.style.text.letterSpacing);
            });
            
            ctx.textAlign = savedAlign;
            shadowY += block.bodyLineHeight;
          });
        }
        
        // Block spacing
        if (blockIndex < processedBlocks.length - 1) {
          shadowY += blockSpacing;
        }
      });
      
      ctx.restore();
    }
  }
  
  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Draw all text blocks
  processedBlocks.forEach((block, blockIndex) => {
    // Draw title
    ctx.font = `${slide.style.text.fontWeight} ${slide.style.text.fontSize}px ${slide.style.text.fontFamily}`;
    
    block.titleLines.forEach((lineSegments) => {
      let lineX = textX;
      
      // Calculate total line width for alignment
      const lineWidth = measureLine(lineSegments, slide.style.text.fontSize, slide.style.text.letterSpacing);
      
      if (ctx.textAlign === 'center') {
        lineX = textX - lineWidth / 2;
      } else if (ctx.textAlign === 'right') {
        lineX = textX - lineWidth;
      }
      
      const savedAlign = ctx.textAlign;
      ctx.textAlign = 'left';
      
      lineSegments.forEach(segment => {
        let displayText = segment.text;
        if (slide.style.text.textTransform === 'uppercase') {
          displayText = segment.text.toUpperCase();
        } else if (slide.style.text.textTransform === 'lowercase') {
          displayText = segment.text.toLowerCase();
        } else if (slide.style.text.textTransform === 'capitalize') {
          displayText = segment.text.replace(/\b\w/g, l => l.toUpperCase());
        }
        ctx.fillStyle = segment.color;
        ctx.fillText(displayText, lineX, currentY);
        lineX += measureSegment(displayText, slide.style.text.fontSize, slide.style.text.letterSpacing);
      });
      
      ctx.textAlign = savedAlign;
      currentY += block.titleLineHeight;
    });

    // Draw body
    if (block.bodyLines.length > 0) {
      currentY += 30;
      
      const bodyFontSize = slide.style.text.bodyFontSize || slide.style.text.fontSize * 0.5;
      
      ctx.font = `${slide.style.text.bodyFontWeight || slide.style.text.fontWeight - 200} ${bodyFontSize}px ${slide.style.text.bodyFontFamily || slide.style.text.fontFamily}`;
      
      block.bodyLines.forEach((lineSegments) => {
        let lineX = textX;
        
        // Calculate total line width for alignment
        const lineWidth = measureLine(lineSegments, bodyFontSize, slide.style.text.letterSpacing);
        
        if (ctx.textAlign === 'center') {
          lineX = textX - lineWidth / 2;
        } else if (ctx.textAlign === 'right') {
          lineX = textX - lineWidth;
        }
        
        const savedAlign = ctx.textAlign;
        ctx.textAlign = 'left';
        
        lineSegments.forEach(segment => {
          let displayText = segment.text;
          if (slide.style.text.textTransform === 'uppercase') {
            displayText = segment.text.toUpperCase();
          } else if (slide.style.text.textTransform === 'lowercase') {
            displayText = segment.text.toLowerCase();
          } else if (slide.style.text.textTransform === 'capitalize') {
            displayText = segment.text.replace(/\b\w/g, l => l.toUpperCase());
          }
          ctx.fillStyle = segment.color;
          ctx.fillText(displayText, lineX, currentY);
          lineX += measureSegment(displayText, bodyFontSize, slide.style.text.letterSpacing);
        });
        
        ctx.textAlign = savedAlign;
        currentY += block.bodyLineHeight;
      });
    }

    // Add spacing between blocks
    if (blockIndex < processedBlocks.length - 1) {
      currentY += blockSpacing;
    }
  });

  ctx.globalAlpha = 1;
};
