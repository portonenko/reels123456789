import { useState } from "react";
import { useLanguageStore } from "@/store/useLanguageStore";
import { useEditorStore } from "@/store/useEditorStore";
import { SlideCard } from "@/components/editor/SlideCard";
import { CanvasPreview } from "@/components/editor/CanvasPreview";
import { StylePanel } from "@/components/editor/StylePanel";
import { TextInputDialog } from "@/components/editor/TextInputDialog";
import { TranslationDialog } from "@/components/editor/TranslationDialog";
import { ExportDialog } from "@/components/editor/ExportDialog";
import { LanguageSwitcher } from "@/components/editor/LanguageSwitcher";
import { TextTemplateManager } from "@/components/editor/TextTemplateManager";
import { RandomVideoButton } from "@/components/editor/RandomVideoButton";
import { PresetManager } from "@/components/editor/PresetManager";
import { SmartRandomVideoDialog } from "@/components/editor/SmartRandomVideoDialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Home, Download, Shuffle, Globe, FileText, Palette } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { parseTextToSlides } from "@/utils/textParser";
import { toast } from "sonner";
import { Slide } from "@/types";
import { supabase } from "@/integrations/supabase/client";

const Editor = () => {
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguageStore();
  const [showTextDialog, setShowTextDialog] = useState(false);
  const [showTranslationDialog, setShowTranslationDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [showPresetManager, setShowPresetManager] = useState(false);
  const [showSmartRandomDialog, setShowSmartRandomDialog] = useState(false);
  const [showTextBoxControls, setShowTextBoxControls] = useState(false);
  const [draggedSlideIndex, setDraggedSlideIndex] = useState<number | null>(null);
  
  const {
    slides,
    assets,
    selectedSlideId,
    globalOverlay,
    currentLanguage,
    projects,
    setSlides,
    setCurrentLanguage,
    updateSlide,
    deleteSlide,
    duplicateSlide,
    setSelectedSlideId,
    setGlobalOverlay,
    randomizeBackgrounds,
    getDefaultStyle,
    reorderSlides,
  } = useEditorStore();

  const selectedSlide = slides.find((s) => s.id === selectedSlideId) || null;

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    setDraggedSlideIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (draggedSlideIndex === null || draggedSlideIndex === index) return;
    
    // Reorder slides while dragging for visual feedback
    const newSlides = [...slides];
    const draggedSlide = newSlides[draggedSlideIndex];
    newSlides.splice(draggedSlideIndex, 1);
    newSlides.splice(index, 0, draggedSlide);
    
    setSlides(newSlides);
    setDraggedSlideIndex(index);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggedSlideIndex(null);
  };

  const handleParseText = (text: string) => {
    const parsedSlides = parseTextToSlides(text, "project-1", getDefaultStyle());
    setSlides(parsedSlides);
    if (parsedSlides.length > 0) {
      setSelectedSlideId(parsedSlides[0].id);
    }
    toast.success(`Created ${parsedSlides.length} slides`);
  };

  const handleTranslate = async (languages: string[]) => {
    if (slides.length === 0) {
      toast.error("No slides to translate");
      return;
    }

    try {
      toast.info("Translating slides...");

      const { data, error } = await supabase.functions.invoke("translate-slides", {
        body: {
          slides: slides.map((slide) => ({
            id: slide.id,
            title: slide.title,
            body: slide.body,
            style: slide.style,
            durationSec: slide.durationSec,
            type: slide.type,
            projectId: slide.projectId,
          })),
          targetLanguages: languages,
        },
      });

      if (error) {
        console.error("Translation error:", error);
        throw error;
      }

      if (!data?.translatedSlides) {
        throw new Error("No translated slides returned");
      }

      // Create separate projects for each language
      const slidesByLanguage: Record<string, Slide[]> = {};
      data.translatedSlides.forEach((ts: any) => {
        const lang = ts.language || "en";
        if (!slidesByLanguage[lang]) {
          slidesByLanguage[lang] = [];
        }
        slidesByLanguage[lang].push(ts);
      });

      // Get current project settings to copy to new language versions
      const currentProject = projects[currentLanguage];

      // Store current language before switching
      const originalLanguage = currentLanguage;

      // Create project for each language with the translated slides
      const newLanguages = Object.keys(slidesByLanguage);
      newLanguages.forEach((lang) => {
        // First switch to the language (this creates the project if it doesn't exist)
        setCurrentLanguage(lang);
        // Then set the slides for that language, copying settings from original
        setSlides(slidesByLanguage[lang].map((slide, idx) => ({
          ...slide,
          index: idx,
          assetId: currentProject.slides[idx]?.assetId, // Preserve asset assignments
        })));
        // Copy global settings from original project
        setGlobalOverlay(currentProject.globalOverlay);
      });

      // Switch back to original language so user can continue working
      setCurrentLanguage(originalLanguage);

      toast.success(`Created ${newLanguages.length} language versions`);
    } catch (error: any) {
      console.error("Translation error:", error);
      const errorMsg = error.message || "Translation failed";
      
      if (errorMsg.includes("429") || errorMsg.includes("Rate limit")) {
        toast.error("Rate limit exceeded. Please try again later.");
      } else if (errorMsg.includes("402") || errorMsg.includes("Payment")) {
        toast.error("Payment required. Please add credits to your workspace.");
      } else if (errorMsg.includes("FunctionsRelayError") || errorMsg.includes("FunctionsHttpError")) {
        toast.error("Translation service unavailable. Please try again in a moment.");
      } else {
        toast.error(`Translation failed: ${errorMsg}`);
      }
      throw error;
    }
  };

  const handleExport = () => {
    setShowExportDialog(true);
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="h-14 border-b border-border bg-card px-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <Home className="w-4 h-4 mr-2" />
            Home
          </Button>
          <h1 className="font-semibold">Video Editor</h1>
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher onCreateTranslation={() => setShowTranslationDialog(true)} />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <Globe className="w-4 h-4 mr-2" />
                {language === 'ru' ? 'RU' : 'EN'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-card z-50">
              <DropdownMenuItem onClick={() => setLanguage('en')}>
                English
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLanguage('ru')}>
                Русский
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTemplateManager(true)}
          >
            <FileText className="w-4 h-4 mr-2" />
            {language === 'ru' ? 'Шаблоны' : 'Templates'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPresetManager(true)}
          >
            <Palette className="w-4 h-4 mr-2" />
            {language === 'ru' ? 'Пресеты' : 'Presets'}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSmartRandomDialog(true)}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {language === 'ru' ? 'Умный рандом' : 'Smart Random'}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTextDialog(true)}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {language === 'ru' ? 'Создать слайды' : 'Parse Text'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={randomizeBackgrounds}
            disabled={slides.length === 0}
          >
            <Shuffle className="w-4 h-4 mr-2" />
            {language === 'ru' ? 'Случайный фон' : 'Randomize'}
          </Button>
          <Button
            size="sm"
            onClick={handleExport}
            disabled={slides.length === 0}
            className="bg-gradient-primary"
          >
            <Download className="w-4 h-4 mr-2" />
            {language === 'ru' ? 'Экспорт' : 'Export'}
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel - Slides */}
        <div className="w-80 border-r border-border bg-panel p-4 overflow-y-auto">
          <h2 className="font-semibold mb-4 flex items-center justify-between">
            <span>Slides ({slides.length})</span>
          </h2>

          {slides.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground mb-4">
                No slides yet. Click "Parse Text" to get started.
              </p>
              <Button
                variant="outline"
                onClick={() => setShowTextDialog(true)}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Parse Text
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {slides.map((slide, index) => (
                <SlideCard
                  key={slide.id}
                  slide={slide}
                  index={index}
                  isSelected={slide.id === selectedSlideId}
                  onSelect={() => setSelectedSlideId(slide.id)}
                  onDuplicate={() => duplicateSlide(slide.id)}
                  onDelete={() => deleteSlide(slide.id)}
                  isDraggable={index > 0}
                  onDragStart={index > 0 ? handleDragStart(index) : undefined}
                  onDragOver={index > 0 ? handleDragOver(index) : undefined}
                  onDrop={index > 0 ? handleDrop : undefined}
                />
              ))}
            </div>
          )}
        </div>

        {/* Center - Canvas */}
        <div className="flex-1 p-6 bg-canvas">
          <CanvasPreview 
            slide={selectedSlide} 
            globalOverlay={globalOverlay}
            showTextBoxControls={showTextBoxControls}
            lang={language}
          />
        </div>

        {/* Right panel - Styles */}
        <div className="w-80 border-l border-border bg-panel p-4 overflow-hidden">
          <h2 className="font-semibold mb-4">Style Controls</h2>
          <StylePanel
            slide={selectedSlide}
            globalOverlay={globalOverlay}
            onUpdateSlide={(updates) => {
              if (selectedSlideId) {
                updateSlide(selectedSlideId, updates);
              }
            }}
            onUpdateGlobalOverlay={setGlobalOverlay}
            showTextBoxControls={showTextBoxControls}
            onToggleTextBoxControls={setShowTextBoxControls}
            lang={language}
          />
        </div>
      </div>

      <TextInputDialog
        open={showTextDialog}
        onClose={() => setShowTextDialog(false)}
        onParse={handleParseText}
      />

      <TextTemplateManager
        open={showTemplateManager}
        onClose={() => setShowTemplateManager(false)}
      />

      <PresetManager
        open={showPresetManager}
        onOpenChange={setShowPresetManager}
      />

      <SmartRandomVideoDialog
        open={showSmartRandomDialog}
        onOpenChange={setShowSmartRandomDialog}
      />

      <TranslationDialog
        open={showTranslationDialog}
        onClose={() => setShowTranslationDialog(false)}
        onTranslate={handleTranslate}
      />

      <ExportDialog
        open={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        projects={projects}
        assets={assets}
      />
    </div>
  );
};

export default Editor;
