export type SlideType = "title-only" | "title-body";

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
  color: string;
  textShadow: string;
  alignment: "left" | "center" | "right";
  // Text effects (when plate is disabled)
  stroke?: string; // Text outline
  strokeWidth?: number;
  glow?: string; // Glow effect color
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
  createdAt: Date;
  updatedAt: Date;
}
