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
  },
  plate: {
    padding: 24,
    borderRadius: 16,
    opacity: 0.8,
    backgroundColor: "#000000",
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
    
    // Pick ONE random video for all slides
    const randomAsset = assets[Math.floor(Math.random() * assets.length)];
    
    set({
      slides: slides.map((slide) => ({
        ...slide,
        assetId: randomAsset.id,
      })),
    });
  },
  
  getDefaultStyle: () => DEFAULT_STYLE,
}));
