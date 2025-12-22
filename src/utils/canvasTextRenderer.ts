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

  // Wrap title text
  ctx.font = `${slide.style.text.fontWeight} ${slide.style.text.fontSize}px ${slide.style.text.fontFamily}`;
  const titleWords = cleanTitle.split(' ');
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

  // Wrap body text (preserving line breaks)
  let bodyLines: string[] = [];
  let maxBodyWidth = 0;
  let bodyBlockHeight = 0;
  
  if (cleanBody) {
    const bodyFontSize = slide.style.text.bodyFontSize || slide.style.text.fontSize * 0.5;
    ctx.font = `${slide.style.text.bodyFontWeight || slide.style.text.fontWeight - 200} ${bodyFontSize}px ${slide.style.text.bodyFontFamily || slide.style.text.fontFamily}`;
    
    // Split by line breaks first, then wrap each paragraph
    const paragraphs = cleanBody.split(/\n+/);
    
    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) {
        // Empty line = paragraph break (add spacing)
        bodyLines.push('');
        continue;
      }
      
      const words = paragraph.split(' ');
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine + word + ' ';
        const testWidth = measureText(testLine, bodyFontSize, slide.style.text.letterSpacing);
        if (testWidth > textBoxWidth && currentLine.length > 0) {
          bodyLines.push(currentLine.trim());
          maxBodyWidth = Math.max(maxBodyWidth, measureText(currentLine.trim(), bodyFontSize, slide.style.text.letterSpacing));
          currentLine = word + ' ';
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine.trim()) {
        bodyLines.push(currentLine.trim());
        maxBodyWidth = Math.max(maxBodyWidth, measureText(currentLine.trim(), bodyFontSize, slide.style.text.letterSpacing));
      }
    }
    
    const bodyLineHeight = bodyFontSize * slide.style.text.lineHeight * 1.2;
    bodyBlockHeight = bodyLines.length * bodyLineHeight;
  }

  // Draw background plate if enabled
  if (slide.style.plate.enabled) {
    const plateWidth = Math.max(maxTitleWidth, maxBodyWidth) + slide.style.plate.padding * 2;
    const totalContentHeight = titleBlockHeight + (cleanBody ? (30 + bodyBlockHeight) : 0);
    const plateHeight = totalContentHeight + slide.style.plate.padding * 2;

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
    const plateY = textY - totalContentHeight / 2 - slide.style.plate.padding;
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
    const plateTop = textY - (titleBlockHeight + (cleanBody ? (30 + bodyBlockHeight) : 0)) / 2 - slide.style.plate.padding;
    currentY = plateTop + slide.style.plate.padding + titleLineHeight / 2;
  } else {
    currentY = textY - (titleBlockHeight / 2);
    if (cleanBody) {
      const totalHeight = titleBlockHeight + 30 + bodyBlockHeight;
      currentY = textY - (totalHeight / 2);
    }
  }

  // Draw text shadow
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
      
      // Title shadow
      let shadowY = currentY;
      ctx.font = `${slide.style.text.fontWeight} ${slide.style.text.fontSize}px ${slide.style.text.fontFamily}`;
      ctx.letterSpacing = `${slide.style.text.letterSpacing}em`;
      titleLines.forEach((line) => {
        ctx.fillStyle = slide.style.text.color;
        ctx.fillText(line, textX, shadowY);
        shadowY += titleLineHeight;
      });
      
      // Body shadow
      if (cleanBody) {
        shadowY += 30;
        const bodyFontSize = slide.style.text.bodyFontSize || slide.style.text.fontSize * 0.5;
        ctx.font = `${slide.style.text.bodyFontWeight || slide.style.text.fontWeight - 200} ${bodyFontSize}px ${slide.style.text.bodyFontFamily || slide.style.text.fontFamily}`;
        ctx.letterSpacing = `${slide.style.text.letterSpacing}em`;
        const bodyLineHeight = bodyFontSize * slide.style.text.lineHeight * 1.2;
        bodyLines.forEach((line) => {
          const bodyColor = slide.style.text.bodyColor || slide.style.text.color;
          ctx.fillStyle = bodyColor;
          ctx.fillText(line, textX, shadowY);
          shadowY += bodyLineHeight;
        });
      }
      
      ctx.restore();
    }
  }
  
  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Draw title
  ctx.font = `${slide.style.text.fontWeight} ${slide.style.text.fontSize}px ${slide.style.text.fontFamily}`;
  ctx.letterSpacing = `${slide.style.text.letterSpacing}em`;
  
  titleLines.forEach((line) => {
    let displayLine = line;
    if (slide.style.text.textTransform === 'uppercase') {
      displayLine = line.toUpperCase();
    } else if (slide.style.text.textTransform === 'lowercase') {
      displayLine = line.toLowerCase();
    } else if (slide.style.text.textTransform === 'capitalize') {
      displayLine = line.replace(/\b\w/g, l => l.toUpperCase());
    }
    ctx.fillStyle = slide.style.text.color;
    ctx.fillText(displayLine, textX, currentY);
    currentY += titleLineHeight;
  });

  // Draw body
  if (cleanBody) {
    currentY += 30;
    
    const bodyColor = slide.style.text.bodyColor || slide.style.text.color;
    const bodyFontSize = slide.style.text.bodyFontSize || slide.style.text.fontSize * 0.5;
    
    ctx.font = `${slide.style.text.bodyFontWeight || slide.style.text.fontWeight - 200} ${bodyFontSize}px ${slide.style.text.bodyFontFamily || slide.style.text.fontFamily}`;
    ctx.letterSpacing = `${slide.style.text.letterSpacing}em`;

    const bodyLineHeight = bodyFontSize * slide.style.text.lineHeight * 1.2;
    
    bodyLines.forEach((line) => {
      let displayLine = line;
      if (slide.style.text.textTransform === 'uppercase') {
        displayLine = line.toUpperCase();
      } else if (slide.style.text.textTransform === 'lowercase') {
        displayLine = line.toLowerCase();
      } else if (slide.style.text.textTransform === 'capitalize') {
        displayLine = line.replace(/\b\w/g, l => l.toUpperCase());
      }
      ctx.fillStyle = bodyColor;
      ctx.fillText(displayLine, textX, currentY);
      currentY += bodyLineHeight;
    });
  }

  ctx.globalAlpha = 1;
};
