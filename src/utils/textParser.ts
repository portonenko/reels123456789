import { Slide, SlideType } from "@/types";

const READING_SPEED_WPM = 160;

function isHeading(line: string): boolean {
  const trimmed = line.trim();
  
  // Check for Markdown heading
  if (trimmed.startsWith("#")) return true;
  
  // Check if ALL CAPS (at least 2 words)
  const words = trimmed.split(/\s+/).filter(w => w.length > 0);
  if (words.length >= 2 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
    return true;
  }
  
  // Check if it's a short line (likely a heading if under 60 chars and doesn't end with punctuation)
  if (trimmed.length < 60 && !/[.!?;,]$/.test(trimmed)) {
    // Also check if first letter is uppercase
    return /^[A-Z]/.test(trimmed);
  }
  
  return false;
}

function calculateDuration(text: string): number {
  const words = text.split(/\s+/).length;
  const readingTime = (words / READING_SPEED_WPM) * 60;
  return Math.max(2, Math.min(6, readingTime));
}

function cleanMarkdown(text: string): string {
  return text.replace(/^#+\s*/, "").trim();
}

export function parseTextToSlides(
  text: string,
  projectId: string,
  defaultStyle: any
): Slide[] {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const slides: Slide[] = [];
  let index = 0;
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    
    if (isHeading(line)) {
      // Found a heading, collect body text until next heading
      const title = cleanMarkdown(line);
      const bodyLines: string[] = [];
      
      // Look ahead for body text
      i++;
      while (i < lines.length && !isHeading(lines[i])) {
        bodyLines.push(lines[i].trim());
        i++;
      }
      
      const body = bodyLines.join(" ").trim();
      const type: SlideType = body.length === 0 ? "title-only" : "title-body";
      const duration = type === "title-only" ? 2 : calculateDuration(body || title);
      
      slides.push({
        id: crypto.randomUUID(),
        projectId,
        index: index++,
        type,
        title,
        body: body || undefined,
        durationSec: duration,
        style: defaultStyle,
      });
    } else {
      // Non-heading line at the start or standalone - treat as title-only
      slides.push({
        id: crypto.randomUUID(),
        projectId,
        index: index++,
        type: "title-only",
        title: cleanMarkdown(line),
        body: undefined,
        durationSec: 2,
        style: defaultStyle,
      });
      i++;
    }
  }

  return slides;
}
