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
  projects: Record<string, ProjectData>;
  currentLanguage: string;
  assets: Asset[];
  selectedSlideId: string | null;
  
  slides: Slide[];
  globalOverlay: number;
  projectName: string;
  backgroundMusicUrl: string | null;
  
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
  slides: [],
  globalOverlay: 30,
  projectName: "Untitled Project",
  backgroundMusicUrl: null,
  
  getCurrentProject: () => {
    const state = get();
    return state.projects[state.currentLanguage] || createEmptyProject();
  },
  
  setCurrentLanguage: (lang) => {
    set((state) => {
      const newProject = state.projects[lang] || createEmptyProject();
      if (!state.projects[lang]) {
        return {
          currentLanguage: lang,
          projects: {
            ...state.projects,
            [lang]: newProject,
          },
          selectedSlideId: null,
          slides: newProject.slides,
          globalOverlay: newProject.globalOverlay,
          projectName: newProject.projectName,
          backgroundMusicUrl: newProject.backgroundMusicUrl,
        };
      }
      return { 
        currentLanguage: lang, 
        selectedSlideId: null,
        slides: newProject.slides,
        globalOverlay: newProject.globalOverlay,
        projectName: newProject.projectName,
        backgroundMusicUrl: newProject.backgroundMusicUrl,
      };
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
      const newCurrentLang = state.currentLanguage === lang ? "default" : state.currentLanguage;
      const newProject = newProjects[newCurrentLang];
      return {
        projects: newProjects,
        currentLanguage: newCurrentLang,
        selectedSlideId: state.currentLanguage === lang ? null : state.selectedSlideId,
        slides: newProject.slides,
        globalOverlay: newProject.globalOverlay,
        projectName: newProject.projectName,
        backgroundMusicUrl: newProject.backgroundMusicUrl,
      };
    });
  },
  
  setSlides: (slides) => set((state) => {
    const newProject = { ...state.getCurrentProject(), slides };
    // Auto-select first slide when slides are set
    const firstSlideId = slides.length > 0 ? slides[0].id : null;
    
    return {
      projects: {
        ...state.projects,
        [state.currentLanguage]: newProject,
      },
      slides: newProject.slides,
      selectedSlideId: firstSlideId,
    };
  }),
  
  addSlide: (slide) => {
    const id = crypto.randomUUID();
    const newSlide = { ...slide, id };
    set((state) => {
      const newSlides = [...state.getCurrentProject().slides, newSlide];
      const newProject = { ...state.getCurrentProject(), slides: newSlides };
      return {
        projects: {
          ...state.projects,
          [state.currentLanguage]: newProject,
        },
        slides: newSlides,
      };
    });
  },
  
  updateSlide: (id, updates) => {
    set((state) => {
      const newSlides = state.getCurrentProject().slides.map((slide) =>
        slide.id === id ? { ...slide, ...updates } : slide
      );
      const newProject = { ...state.getCurrentProject(), slides: newSlides };
      return {
        projects: {
          ...state.projects,
          [state.currentLanguage]: newProject,
        },
        slides: newSlides,
      };
    });
  },
  
  deleteSlide: (id) => {
    set((state) => {
      const newSlides = state.getCurrentProject().slides.filter((slide) => slide.id !== id);
      const newProject = { ...state.getCurrentProject(), slides: newSlides };
      return {
        projects: {
          ...state.projects,
          [state.currentLanguage]: newProject,
        },
        slides: newSlides,
        selectedSlideId: state.selectedSlideId === id ? null : state.selectedSlideId,
      };
    });
  },
  
  duplicateSlide: (id) => {
    const slide = get().getCurrentProject().slides.find((s) => s.id === id);
    if (slide) {
      const newSlide = {
        ...slide,
        id: crypto.randomUUID(),
        index: slide.index + 1,
      };
      set((state) => {
        const newSlides = [...state.getCurrentProject().slides, newSlide];
        const newProject = { ...state.getCurrentProject(), slides: newSlides };
        return {
          projects: {
            ...state.projects,
            [state.currentLanguage]: newProject,
          },
          slides: newSlides,
        };
      });
    }
  },
  
  reorderSlides: (startIndex, endIndex) => {
    set((state) => {
      const result = Array.from(state.getCurrentProject().slides);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      const newSlides = result.map((slide, index) => ({ ...slide, index }));
      const newProject = { ...state.getCurrentProject(), slides: newSlides };
      return {
        projects: {
          ...state.projects,
          [state.currentLanguage]: newProject,
        },
        slides: newSlides,
      };
    });
  },
  
  applyStyleToAll: (sourceSlideId) => {
    const sourceSlide = get().getCurrentProject().slides.find((s) => s.id === sourceSlideId);
    if (!sourceSlide) return;
    
    set((state) => {
      const newSlides = state.getCurrentProject().slides.map((slide) => ({
        ...slide,
        style: { ...sourceSlide.style },
      }));
      const newProject = { ...state.getCurrentProject(), slides: newSlides };
      return {
        projects: {
          ...state.projects,
          [state.currentLanguage]: newProject,
        },
        slides: newSlides,
      };
    });
  },

  applyDurationToAll: (duration) => {
    set((state) => {
      const newSlides = state.getCurrentProject().slides.map((slide) => ({
        ...slide,
        durationSec: duration,
      }));
      const newProject = { ...state.getCurrentProject(), slides: newSlides };
      return {
        projects: {
          ...state.projects,
          [state.currentLanguage]: newProject,
        },
        slides: newSlides,
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
  
  setGlobalOverlay: (overlay) => set((state) => {
    const newProject = { ...state.getCurrentProject(), globalOverlay: overlay };
    return {
      projects: {
        ...state.projects,
        [state.currentLanguage]: newProject,
      },
      globalOverlay: overlay,
    };
  }),
  
  setProjectName: (name) => set((state) => {
    const newProject = { ...state.getCurrentProject(), projectName: name };
    return {
      projects: {
        ...state.projects,
        [state.currentLanguage]: newProject,
      },
      projectName: name,
    };
  }),
  
  setBackgroundMusic: (url) => set((state) => {
    const newProject = { ...state.getCurrentProject(), backgroundMusicUrl: url };
    return {
      projects: {
        ...state.projects,
        [state.currentLanguage]: newProject,
      },
      backgroundMusicUrl: url,
    };
  }),
  
  randomizeBackgrounds: () => {
    const state = get();
    const { assets } = state;
    const slides = state.getCurrentProject().slides;
    if (assets.length === 0) return;
    
    const randomAsset = assets[Math.floor(Math.random() * assets.length)];

    set((state) => {
      const newSlides = state.getCurrentProject().slides.map((slide) => ({
        ...slide,
        assetId: randomAsset.id,
      }));
      const newProject = { ...state.getCurrentProject(), slides: newSlides };
      return {
        projects: {
          ...state.projects,
          [state.currentLanguage]: newProject,
        },
        slides: newSlides,
      };
    });
  },
  
  getDefaultStyle: () => DEFAULT_STYLE,
}));
