export type ContentFormat = "video" | "carousel" | "static-single" | "static-multi";

export type FactoryLanguage = "en" | "de" | "pl";

export interface ContentMatrixSelection {
  languages: FactoryLanguage[];
  formats: ContentFormat[];
}

export interface VisualPreset {
  id: string;
  name: string;
  titleDuration: number;
  otherDuration: number;
  style: any; // SlideStyle
}

export interface GeneratedContent {
  id: string;
  language: FactoryLanguage;
  format: ContentFormat;
  slides: any[]; // Slide[]
  status: "pending" | "processing" | "completed" | "error";
  musicUrl?: string;
  previewUrl?: string;
}

export interface FactoryState {
  step: 1 | 2 | 3 | 4 | 5;
  sourceText: string;
  selectedTemplateId?: string;
  selectedPreset?: VisualPreset;
  matrix: ContentMatrixSelection;
  generatedContent: GeneratedContent[];
  isProcessing: boolean;
  processingProgress: number;
  processingMessage: string;
}

export const FACTORY_LANGUAGES: { code: FactoryLanguage; name: string; energiaReplacement: string }[] = [
  { code: "en", name: "English", energiaReplacement: "energy" },
  { code: "de", name: "German", energiaReplacement: "energie" },
  { code: "pl", name: "Polish", energiaReplacement: "Energia" },
];

export const CONTENT_FORMATS: { code: ContentFormat; name: string; description: string }[] = [
  { code: "video", name: "Video (Reels)", description: "9:16 video with transitions" },
  { code: "carousel", name: "Photo Carousel", description: "Multiple images for swipe" },
  { code: "static-single", name: "Static Post (Single)", description: "One 1080x1080 image" },
  { code: "static-multi", name: "Static Post (Multi)", description: "Multiple images per slide" },
];
