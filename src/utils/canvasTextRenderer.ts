import { Slide } from "@/types";

export interface TextRenderConfig {
  canvas: HTMLCanvasElement;
  slide: Slide;
  globalOverlay: number;
  backgroundVideo?: HTMLVideoElement;
  transitionProgress?: number;
}

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

  // Helper to measure text with letter spacing
  const measureText = (text: string, fontSize: number, letterSpacing: number) => {
    const baseWidth = ctx.measureText(text).width;
    const spacingPx = letterSpacing * fontSize;
    return baseWidth + (text.length - 1) * spacingPx;
  };

  // Process all text blocks
  const processedBlocks = textBlocks.map(block => {
    const cleanBlockTitle = block.title.replace(/^\[.*?\]\s*/, '');
    const cleanBlockBody = block.body?.replace(/^\[.*?\]\s*/, '');

    // Wrap title text
    ctx.font = `${slide.style.text.fontWeight} ${slide.style.text.fontSize}px ${slide.style.text.fontFamily}`;
    const titleWords = cleanBlockTitle.split(' ');
    let titleLine = '';
    const titleLines: string[] = [];
    let maxTitleWidth = 0;

    for (const word of titleWords) {
      const testLine = titleLine + word + ' ';
      const testWidth = measureText(testLine, slide.style.text.fontSize, slide.style.text.letterSpacing);
      if (testWidth > textBoxWidth && titleLine.length > 0) {
        titleLines.push(titleLine.trim());
        maxTitleWidth = Math.max(maxTitleWidth, measureText(titleLine.trim(), slide.style.text.fontSize, slide.style.text.letterSpacing));
        titleLine = word + ' ';
      } else {
        titleLine = testLine;
      }
    }
    if (titleLine.trim()) {
      titleLines.push(titleLine.trim());
      maxTitleWidth = Math.max(maxTitleWidth, measureText(titleLine.trim(), slide.style.text.fontSize, slide.style.text.letterSpacing));
    }

    const titleLineHeight = slide.style.text.fontSize * slide.style.text.lineHeight;
    const titleBlockHeight = titleLines.length * titleLineHeight;

    // Wrap body text
    let bodyLines: string[] = [];
    let maxBodyWidth = 0;
    let bodyBlockHeight = 0;
    
    if (cleanBlockBody) {
      const bodyFontSize = slide.style.text.bodyFontSize || slide.style.text.fontSize * 0.5;
      ctx.font = `${slide.style.text.bodyFontWeight || slide.style.text.fontWeight - 200} ${bodyFontSize}px ${slide.style.text.bodyFontFamily || slide.style.text.fontFamily}`;
      const bodyWords = cleanBlockBody.split(' ');
      let bodyLine = '';

      for (const word of bodyWords) {
        const testLine = bodyLine + word + ' ';
        const testWidth = measureText(testLine, bodyFontSize, slide.style.text.letterSpacing);
        if (testWidth > textBoxWidth && bodyLine.length > 0) {
          bodyLines.push(bodyLine.trim());
          maxBodyWidth = Math.max(maxBodyWidth, measureText(bodyLine.trim(), bodyFontSize, slide.style.text.letterSpacing));
          bodyLine = word + ' ';
        } else {
          bodyLine = testLine;
        }
      }
      if (bodyLine.trim()) {
        bodyLines.push(bodyLine.trim());
        maxBodyWidth = Math.max(maxBodyWidth, measureText(bodyLine.trim(), bodyFontSize, slide.style.text.letterSpacing));
      }
      
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
        ctx.letterSpacing = `${slide.style.text.letterSpacing}em`;
        block.titleLines.forEach((line) => {
          ctx.fillStyle = slide.style.text.color;
          ctx.fillText(line, textX, shadowY);
          shadowY += block.titleLineHeight;
        });
        
        // Body shadow
        if (block.bodyLines.length > 0) {
          shadowY += 30;
          const bodyFontSize = slide.style.text.bodyFontSize || slide.style.text.fontSize * 0.5;
          ctx.font = `${slide.style.text.bodyFontWeight || slide.style.text.fontWeight - 200} ${bodyFontSize}px ${slide.style.text.bodyFontFamily || slide.style.text.fontFamily}`;
          ctx.letterSpacing = `${slide.style.text.letterSpacing}em`;
          block.bodyLines.forEach((line) => {
            const bodyColor = slide.style.text.bodyColor || slide.style.text.color;
            ctx.fillStyle = bodyColor;
            ctx.fillText(line, textX, shadowY);
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

  // Helper to parse and render text with inline colors
  const renderTextWithColors = (line: string, x: number, y: number, defaultColor: string) => {
    // Match pattern: [#hexcolor]text[]
    const regex = /\[#([0-9a-fA-F]{6})\](.*?)\[\]/g;
    let lastIndex = 0;
    let currentX = x;
    const parts: Array<{text: string, color: string}> = [];
    
    let match;
    while ((match = regex.exec(line)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        parts.push({
          text: line.substring(lastIndex, match.index),
          color: defaultColor
        });
      }
      // Add colored text
      parts.push({
        text: match[2],
        color: `#${match[1]}`
      });
      lastIndex = regex.lastIndex;
    }
    // Add remaining text
    if (lastIndex < line.length) {
      parts.push({
        text: line.substring(lastIndex),
        color: defaultColor
      });
    }
    
    // If no matches, just use default
    if (parts.length === 0) {
      parts.push({ text: line, color: defaultColor });
    }
    
    // Calculate total width for alignment
    const totalWidth = parts.reduce((sum, part) => {
      return sum + ctx.measureText(part.text).width + (part.text.length - 1) * slide.style.text.letterSpacing * slide.style.text.fontSize;
    }, 0);
    
    // Adjust starting position based on alignment
    if (ctx.textAlign === 'center') {
      currentX = x - totalWidth / 2;
      ctx.textAlign = 'left';
    } else if (ctx.textAlign === 'right') {
      currentX = x - totalWidth;
      ctx.textAlign = 'left';
    }
    
    // Render each part
    parts.forEach(part => {
      ctx.fillStyle = part.color;
      ctx.fillText(part.text, currentX, y);
      currentX += ctx.measureText(part.text).width + (part.text.length - 1) * slide.style.text.letterSpacing * slide.style.text.fontSize;
    });
    
    // Restore alignment
    ctx.textAlign = slide.style.text.alignment as CanvasTextAlign;
  };

  // Draw all text blocks
  processedBlocks.forEach((block, blockIndex) => {
    // Draw title
    ctx.font = `${slide.style.text.fontWeight} ${slide.style.text.fontSize}px ${slide.style.text.fontFamily}`;
    ctx.letterSpacing = `${slide.style.text.letterSpacing}em`;
    
    block.titleLines.forEach((line) => {
      let displayLine = line;
      if (slide.style.text.textTransform === 'uppercase') {
        displayLine = line.toUpperCase();
      } else if (slide.style.text.textTransform === 'lowercase') {
        displayLine = line.toLowerCase();
      } else if (slide.style.text.textTransform === 'capitalize') {
        displayLine = line.replace(/\b\w/g, l => l.toUpperCase());
      }
      renderTextWithColors(displayLine, textX, currentY, slide.style.text.color);
      currentY += block.titleLineHeight;
    });

    // Draw body
    if (block.bodyLines.length > 0) {
      currentY += 30;
      
      const bodyColor = slide.style.text.bodyColor || slide.style.text.color;
      const bodyFontSize = slide.style.text.bodyFontSize || slide.style.text.fontSize * 0.5;
      
      ctx.font = `${slide.style.text.bodyFontWeight || slide.style.text.fontWeight - 200} ${bodyFontSize}px ${slide.style.text.bodyFontFamily || slide.style.text.fontFamily}`;
      ctx.letterSpacing = `${slide.style.text.letterSpacing}em`;
      
      block.bodyLines.forEach((line) => {
        let displayLine = line;
        if (slide.style.text.textTransform === 'uppercase') {
          displayLine = line.toUpperCase();
        } else if (slide.style.text.textTransform === 'lowercase') {
          displayLine = line.toLowerCase();
        } else if (slide.style.text.textTransform === 'capitalize') {
          displayLine = line.replace(/\b\w/g, l => l.toUpperCase());
        }
        renderTextWithColors(displayLine, textX, currentY, bodyColor);
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
