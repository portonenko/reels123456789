import { Slide, SlideType } from "@/types";

const READING_SPEED_WPM = 160;

function isHeading(line: string): boolean {
  const trimmed = line.trim();
  // Check for Markdown heading
  if (trimmed.startsWith("#")) return true;
  // Check for ALL CAPS or Title Case (most words capitalized)
  const words = trimmed.split(" ");
  const capitalizedWords = words.filter(
    (w) => w.length > 0 && w[0] === w[0].toUpperCase()
  );
  return capitalizedWords.length / words.length > 0.7;
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
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  const slides: Slide[] = [];
  let currentTitle = "";
  let currentBody: string[] = [];
  let index = 0;

  const flushSlide = () => {
    if (currentTitle) {
      const type: SlideType = currentBody.length === 0 ? "title-only" : "title-body";
      const body = currentBody.join(" ");
      const duration = type === "title-only" ? 2 : calculateDuration(body || currentTitle);

      slides.push({
        id: crypto.randomUUID(),
        projectId,
        index: index++,
        type,
        title: cleanMarkdown(currentTitle),
        body: body || undefined,
        durationSec: duration,
        style: defaultStyle,
      });

      currentTitle = "";
      currentBody = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (isHeading(line)) {
      flushSlide();
      currentTitle = line;
      
      // Check if next line is body text
      if (i + 1 < lines.length && !isHeading(lines[i + 1])) {
        // Collect body lines until next heading
        i++;
        while (i < lines.length && !isHeading(lines[i])) {
          currentBody.push(lines[i]);
          i++;
        }
        i--; // Back up one since loop will increment
      }
    } else {
      // Body text without a heading - treat previous as title if available
      if (!currentTitle && slides.length > 0) {
        currentBody.push(line);
      } else if (!currentTitle) {
        currentTitle = line;
      } else {
        currentBody.push(line);
      }
    }
  }

  flushSlide();

  return slides;
}
