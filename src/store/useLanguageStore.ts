import { create } from "zustand";
import { persist } from "zustand/middleware";

interface LanguageStore {
  language: 'en' | 'ru';
  setLanguage: (lang: 'en' | 'ru') => void;
}

export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set) => ({
      language: 'en',
      setLanguage: (lang) => set({ language: lang }),
    }),
    {
      name: 'language-storage',
    }
  )
);
