import { useEditorStore } from "@/store/useEditorStore";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Languages, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const LANGUAGE_NAMES: Record<string, string> = {
  default: "Original",
  en: "English",
  ru: "Русский",
  es: "Español",
  de: "Deutsch",
  fr: "Français",
  it: "Italiano",
  pt: "Português",
  zh: "中文",
  ja: "日本語",
  ko: "한국어",
};

interface LanguageSwitcherProps {
  onCreateTranslation: () => void;
}

export const LanguageSwitcher = ({ onCreateTranslation }: LanguageSwitcherProps) => {
  const { 
    currentLanguage, 
    setCurrentLanguage, 
    getAvailableLanguages,
    deleteLanguageProject,
  } = useEditorStore();

  const availableLanguages = getAvailableLanguages();

  const handleDeleteLanguage = (lang: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (lang === "default") {
      toast.error("Cannot delete original project");
      return;
    }
    
    deleteLanguageProject(lang);
    toast.success(`Deleted ${LANGUAGE_NAMES[lang] || lang} version`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Languages className="w-4 h-4 mr-2" />
          {LANGUAGE_NAMES[currentLanguage] || currentLanguage}
          {availableLanguages.length > 1 && ` (${availableLanguages.length})`}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-card z-50 w-56">
        {availableLanguages.map((lang) => (
          <DropdownMenuItem
            key={lang}
            onClick={() => {
              setCurrentLanguage(lang);
              toast.success(`Switched to ${LANGUAGE_NAMES[lang] || lang}`);
            }}
            className="flex items-center justify-between group"
          >
            <span className={currentLanguage === lang ? "font-semibold" : ""}>
              {LANGUAGE_NAMES[lang] || lang}
            </span>
            {lang !== "default" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                onClick={(e) => handleDeleteLanguage(lang, e)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onCreateTranslation}>
          <Plus className="w-4 h-4 mr-2" />
          Add Translation
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
