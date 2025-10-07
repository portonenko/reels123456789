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

interface ProjectData {
  slides: Slide[];
  backgroundMusicUrl: string | null;
  globalOverlay: number;
  projectName: string;
}

interface EditorStore {
  projects: Record<string, ProjectData>; // language code -> project data
  currentLanguage: string;
  assets: Asset[];
  selectedSlideId: string | null;
  
  getCurrentProject: () => ProjectData;
  setCurrentLanguage: (lang: string) => void;
  getAvailableLanguages: () => string[];
  deleteLanguageProject: (lang: string) => void;
  
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
  setBackgroundMusic: (url: string | null) => void;
  
  randomizeBackgrounds: () => void;
  getDefaultStyle: () => SlideStyle;
  
  // Getters for current project data
  get slides(): Slide[];
  get globalOverlay(): number;
  get projectName(): string;
  get backgroundMusicUrl(): string | null;
}

const createEmptyProject = (): ProjectData => ({
  slides: [],
  backgroundMusicUrl: null,
  globalOverlay: 30,
  projectName: "Untitled Project",
});

export const useEditorStore = create<EditorStore>((set, get) => ({
  projects: {
    default: createEmptyProject(),
  },
  currentLanguage: "default",
  assets: [],
  selectedSlideId: null,
  
  getCurrentProject: () => {
    const state = get();
    return state.projects[state.currentLanguage] || createEmptyProject();
  },
  
  setCurrentLanguage: (lang) => {
    set((state) => {
      if (!state.projects[lang]) {
        return {
          currentLanguage: lang,
          projects: {
            ...state.projects,
            [lang]: createEmptyProject(),
          },
          selectedSlideId: null,
        };
      }
      return { currentLanguage: lang, selectedSlideId: null };
    });
  },
  
  getAvailableLanguages: () => {
    return Object.keys(get().projects);
  },
  
  deleteLanguageProject: (lang) => {
    set((state) => {
      if (lang === "default") return state;
      const newProjects = { ...state.projects };
      delete newProjects[lang];
      return {
        projects: newProjects,
        currentLanguage: state.currentLanguage === lang ? "default" : state.currentLanguage,
        selectedSlideId: state.currentLanguage === lang ? null : state.selectedSlideId,
      };
    });
  },
  
  get slides() {
    return get().getCurrentProject().slides;
  },
  
  get globalOverlay() {
    return get().getCurrentProject().globalOverlay;
  },
  
  get projectName() {
    return get().getCurrentProject().projectName;
  },
  
  get backgroundMusicUrl() {
    return get().getCurrentProject().backgroundMusicUrl;
  },
  
  setSlides: (slides) => set((state) => ({
    projects: {
      ...state.projects,
      [state.currentLanguage]: {
        ...state.getCurrentProject(),
        slides,
      },
    },
  })),
  
  addSlide: (slide) => {
    const id = crypto.randomUUID();
    const newSlide = { ...slide, id };
    set((state) => ({
      projects: {
        ...state.projects,
        [state.currentLanguage]: {
          ...state.getCurrentProject(),
          slides: [...state.getCurrentProject().slides, newSlide],
        },
      },
    }));
  },
  
  updateSlide: (id, updates) => {
    set((state) => ({
      projects: {
        ...state.projects,
        [state.currentLanguage]: {
          ...state.getCurrentProject(),
          slides: state.getCurrentProject().slides.map((slide) =>
            slide.id === id ? { ...slide, ...updates } : slide
          ),
        },
      },
    }));
  },
  
  deleteSlide: (id) => {
    set((state) => ({
      projects: {
        ...state.projects,
        [state.currentLanguage]: {
          ...state.getCurrentProject(),
          slides: state.getCurrentProject().slides.filter((slide) => slide.id !== id),
        },
      },
      selectedSlideId: state.selectedSlideId === id ? null : state.selectedSlideId,
    }));
  },
  
  duplicateSlide: (id) => {
    const slide = get().getCurrentProject().slides.find((s) => s.id === id);
    if (slide) {
      const newSlide = {
        ...slide,
        id: crypto.randomUUID(),
        index: slide.index + 1,
      };
      set((state) => ({
        projects: {
          ...state.projects,
          [state.currentLanguage]: {
            ...state.getCurrentProject(),
            slides: [...state.getCurrentProject().slides, newSlide],
          },
        },
      }));
    }
  },
  
  reorderSlides: (startIndex, endIndex) => {
    set((state) => {
      const result = Array.from(state.getCurrentProject().slides);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return {
        projects: {
          ...state.projects,
          [state.currentLanguage]: {
            ...state.getCurrentProject(),
            slides: result.map((slide, index) => ({ ...slide, index })),
          },
        },
      };
    });
  },
  
  applyStyleToAll: (sourceSlideId) => {
    const sourceSlide = get().getCurrentProject().slides.find((s) => s.id === sourceSlideId);
    if (!sourceSlide) return;
    
    set((state) => ({
      projects: {
        ...state.projects,
        [state.currentLanguage]: {
          ...state.getCurrentProject(),
          slides: state.getCurrentProject().slides.map((slide) => ({
            ...slide,
            style: { ...sourceSlide.style },
          })),
        },
      },
    }));
  },

  applyDurationToAll: (duration) => {
    set((state) => ({
      projects: {
        ...state.projects,
        [state.currentLanguage]: {
          ...state.getCurrentProject(),
          slides: state.getCurrentProject().slides.map((slide) => ({
            ...slide,
            durationSec: duration,
          })),
        },
      },
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
  
  setGlobalOverlay: (overlay) => set((state) => ({
    projects: {
      ...state.projects,
      [state.currentLanguage]: {
        ...state.getCurrentProject(),
        globalOverlay: overlay,
      },
    },
  })),
  
  setProjectName: (name) => set((state) => ({
    projects: {
      ...state.projects,
      [state.currentLanguage]: {
        ...state.getCurrentProject(),
        projectName: name,
      },
    },
  })),
  
  setBackgroundMusic: (url) => set((state) => ({
    projects: {
      ...state.projects,
      [state.currentLanguage]: {
        ...state.getCurrentProject(),
        backgroundMusicUrl: url,
      },
    },
  })),
  
  randomizeBackgrounds: () => {
    const state = get();
    const { assets } = state;
    const slides = state.getCurrentProject().slides;
    if (assets.length === 0) return;
    
    // Pick a random video for current project
    const randomAsset = assets[Math.floor(Math.random() * assets.length)];

    set((state) => ({
      projects: {
        ...state.projects,
        [state.currentLanguage]: {
          ...state.getCurrentProject(),
          slides: state.getCurrentProject().slides.map((slide) => ({
            ...slide,
            assetId: randomAsset.id,
          })),
        },
      },
    }));
  },
  
  getDefaultStyle: () => DEFAULT_STYLE,
}));
