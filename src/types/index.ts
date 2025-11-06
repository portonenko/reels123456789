export type SlideType = "title-only" | "title-body";

export interface TextStyle {
  fontFamily: string;
  bodyFontFamily?: string; // Separate font for body text
  fontSize: number;
  bodyFontSize?: number; // Separate font size for body text
  fontWeight: number;
  bodyFontWeight?: number; // Separate font weight for body
  lineHeight: number;
  letterSpacing: number;
  color: string;
  bodyColor?: string; // Separate color for body text
  textShadow: string;
  shadowIntensity?: number; // Multiplier for shadow/glow effect (1-10)
  alignment: "left" | "center" | "right";
  // Text effects (when plate is disabled)
  stroke?: string; // Text outline
  strokeWidth?: number;
  glow?: string; // Glow effect color
  // Text box positioning and dimensions (percentage based)
  position?: {
    x: number; // percentage from left (0-100)
    y: number; // percentage from top (0-100)
    width: number; // percentage of canvas width (0-100)
    height: number; // percentage of canvas height (0-100)
  };
}

export interface PlateStyle {
  padding: number;
  borderRadius: number;
  opacity: number;
  backgroundColor: string;
  enabled: boolean; // Toggle between plate and direct text effects
}

export interface SlideStyle {
  text: TextStyle;
  plate: PlateStyle;
  safeMarginTop: number;
  safeMarginBottom: number;
}

export interface Slide {
  id: string;
  projectId: string;
  index: number;
  type: SlideType;
  title: string;
  body?: string;
  durationSec: number;
  assetId?: string;
  style: SlideStyle;
  language?: string; // Language code for translated slides
  transition?: "none" | "fade" | "flash" | "glow" | "slide-left" | "slide-right" | "sunlight";
}

export interface Asset {
  id: string;
  url: string;
  duration: number;
  width: number;
  height: number;
  createdAt: Date;
}

export interface Project {
  id: string;
  name: string;
  slides: Slide[];
  globalOverlay: number; // 0-70%
  backgroundMusicUrl?: string; // Optional background music
  createdAt: Date;
  updatedAt: Date;
}
