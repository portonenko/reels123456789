import { Slide, SlideType } from "@/types";

const READING_SPEED_WPM = 160;

function isHeading(line: string, nextLine?: string): boolean {
  const trimmed = line.trim();
  
  // Check for Markdown heading
  if (trimmed.startsWith("#")) return true;
  
  // Check if ALL CAPS (at least 2 words)
  const words = trimmed.split(/\s+/).filter(w => w.length > 0);
  if (words.length >= 2 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
    return true;
  }
  
  // If line ends with period and is followed by longer text, it's likely a heading
  if (nextLine && trimmed.endsWith('.')) {
    const nextTrimmed = nextLine.trim();
    // If next line is significantly longer (body text), current line is heading
    if (nextTrimmed.length > trimmed.length * 1.5) {
      return true;
    }
  }
  
  // Check if it's a short line (likely a heading if under 80 chars and doesn't end with multiple punctuation)
  if (trimmed.length < 80 && !/[.!?;,]\s+[A-Z]/.test(trimmed)) {
    // Check if first letter is uppercase
    if (/^[A-Z]/.test(trimmed)) {
      return true;
    }
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
  
  // First line is ALWAYS the main headline
  if (lines.length > 0) {
    slides.push({
      id: crypto.randomUUID(),
      projectId,
      index: index++,
      type: "title-only",
      title: cleanMarkdown(lines[0].trim()),
      body: undefined,
      durationSec: 3,
      style: defaultStyle,
    });
  }
  
  // Process remaining lines
  let i = 1;
  while (i < lines.length) {
    const line = lines[i].trim();
    const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : undefined;
    
    if (isHeading(line, nextLine)) {
      // Found a heading, collect body text until next heading
      const title = cleanMarkdown(line);
      const bodyLines: string[] = [];
      
      // Look ahead for body text
      i++;
      while (i < lines.length && !isHeading(lines[i], i + 1 < lines.length ? lines[i + 1] : undefined)) {
        bodyLines.push(lines[i].trim());
        i++;
      }
      
      const body = bodyLines.join("\n").trim();
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
      // Non-heading line - treat as title-only
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
