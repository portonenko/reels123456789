import { create } from "zustand";
import { Slide, Asset, SlideStyle } from "@/types";

const DEFAULT_STYLE: SlideStyle = {
  text: {
    fontFamily: "Inter",
    fontSize: 48,
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: -0.02,
    color: "#FFFFFF",
    textShadow: "0 2px 8px rgba(0,0,0,0.5)",
    alignment: "center",
    stroke: "#000000",
    strokeWidth: 2,
    glow: "rgba(255,255,255,0.5)",
  },
  plate: {
    padding: 24,
    borderRadius: 16,
    opacity: 0.8,
    backgroundColor: "#000000",
    enabled: true,
  },
  safeMarginTop: 10,
  safeMarginBottom: 10,
};

interface EditorStore {
  slides: Slide[];
  assets: Asset[];
  selectedSlideId: string | null;
  globalOverlay: number;
  projectName: string;
  
  setSlides: (slides: Slide[]) => void;
  addSlide: (slide: Omit<Slide, "id">) => void;
  updateSlide: (id: string, updates: Partial<Slide>) => void;
  deleteSlide: (id: string) => void;
  duplicateSlide: (id: string) => void;
  reorderSlides: (startIndex: number, endIndex: number) => void;
  applyStyleToAll: (sourceSlideId: string) => void;
  applyDurationToAll: (duration: number) => void;
  
  setAssets: (assets: Asset[]) => void;
  addAsset: (asset: Asset) => void;
  deleteAsset: (id: string) => void;
  
  setSelectedSlideId: (id: string | null) => void;
  setGlobalOverlay: (overlay: number) => void;
  setProjectName: (name: string) => void;
  
  randomizeBackgrounds: () => void;
  getDefaultStyle: () => SlideStyle;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  slides: [],
  assets: [],
  selectedSlideId: null,
  globalOverlay: 30,
  projectName: "Untitled Project",
  
  setSlides: (slides) => set({ slides }),
  
  addSlide: (slide) => {
    const id = crypto.randomUUID();
    const newSlide = { ...slide, id };
    set((state) => ({
      slides: [...state.slides, newSlide],
    }));
  },
  
  updateSlide: (id, updates) => {
    set((state) => ({
      slides: state.slides.map((slide) =>
        slide.id === id ? { ...slide, ...updates } : slide
      ),
    }));
  },
  
  deleteSlide: (id) => {
    set((state) => ({
      slides: state.slides.filter((slide) => slide.id !== id),
      selectedSlideId: state.selectedSlideId === id ? null : state.selectedSlideId,
    }));
  },
  
  duplicateSlide: (id) => {
    const slide = get().slides.find((s) => s.id === id);
    if (slide) {
      const newSlide = {
        ...slide,
        id: crypto.randomUUID(),
        index: slide.index + 1,
      };
      set((state) => ({
        slides: [...state.slides, newSlide],
      }));
    }
  },
  
  reorderSlides: (startIndex, endIndex) => {
    set((state) => {
      const result = Array.from(state.slides);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return {
        slides: result.map((slide, index) => ({ ...slide, index })),
      };
    });
  },
  
  applyStyleToAll: (sourceSlideId) => {
    const sourceSlide = get().slides.find((s) => s.id === sourceSlideId);
    if (!sourceSlide) return;
    
    set((state) => ({
      slides: state.slides.map((slide) => ({
        ...slide,
        style: { ...sourceSlide.style },
      })),
    }));
  },

  applyDurationToAll: (duration) => {
    set((state) => ({
      slides: state.slides.map((slide) => ({
        ...slide,
        durationSec: duration,
      })),
    }));
  },
  
  setAssets: (assets) => set({ assets }),
  
  addAsset: (asset) => {
    set((state) => ({
      assets: [...state.assets, asset],
    }));
  },
  
  deleteAsset: (id) => {
    set((state) => ({
      assets: state.assets.filter((asset) => asset.id !== id),
    }));
  },
  
  setSelectedSlideId: (id) => set({ selectedSlideId: id }),
  setGlobalOverlay: (overlay) => set({ globalOverlay: overlay }),
  setProjectName: (name) => set({ projectName: name }),
  
  randomizeBackgrounds: () => {
    const { slides, assets } = get();
    if (assets.length === 0) return;
    
    // Group slides by language
    const slidesByLanguage = slides.reduce((acc, slide) => {
      const lang = slide.language || "default";
      if (!acc[lang]) acc[lang] = [];
      acc[lang].push(slide);
      return acc;
    }, {} as Record<string, typeof slides>);

    // Pick a random video for each language group
    const videoByLanguage: Record<string, string> = {};
    Object.keys(slidesByLanguage).forEach((lang) => {
      const randomAsset = assets[Math.floor(Math.random() * assets.length)];
      videoByLanguage[lang] = randomAsset.id;
    });

    set({
      slides: slides.map((slide) => ({
        ...slide,
        assetId: videoByLanguage[slide.language || "default"],
      })),
    });
  },
  
  getDefaultStyle: () => DEFAULT_STYLE,
}));
