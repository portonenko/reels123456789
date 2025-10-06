import { useState } from "react";
import { useEditorStore } from "@/store/useEditorStore";
import { SlideCard } from "@/components/editor/SlideCard";
import { CanvasPreview } from "@/components/editor/CanvasPreview";
import { StylePanel } from "@/components/editor/StylePanel";
import { TextInputDialog } from "@/components/editor/TextInputDialog";
import { TranslationDialog } from "@/components/editor/TranslationDialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Home, Download, Shuffle, Languages } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { parseTextToSlides } from "@/utils/textParser";
import { toast } from "sonner";
import { Slide } from "@/types";
import { supabase } from "@/integrations/supabase/client";

const Editor = () => {
  const navigate = useNavigate();
  const [showTextDialog, setShowTextDialog] = useState(false);
  const [showTranslationDialog, setShowTranslationDialog] = useState(false);
  
  const {
    slides,
    selectedSlideId,
    globalOverlay,
    setSlides,
    updateSlide,
    deleteSlide,
    duplicateSlide,
    setSelectedSlideId,
    setGlobalOverlay,
    randomizeBackgrounds,
    getDefaultStyle,
  } = useEditorStore();

  const selectedSlide = slides.find((s) => s.id === selectedSlideId) || null;

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

      const translatedSlides: Slide[] = data.translatedSlides.map(
        (ts: any, idx: number) => ({
          ...ts,
          index: slides.length + idx,
        })
      );

      setSlides([...slides, ...translatedSlides]);
      toast.success(`Created ${translatedSlides.length} translated slides`);
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
    // Group slides by language
    const slidesByLanguage: Record<string, typeof slides> = slides.reduce((acc, slide) => {
      const lang = slide.language || "original";
      if (!acc[lang]) acc[lang] = [];
      acc[lang].push(slide);
      return acc;
    }, {} as Record<string, typeof slides>);

    const languageCount = Object.keys(slidesByLanguage).length;
    
    toast.info(
      `Export feature coming soon! You have ${languageCount} language version(s) to export: ${Object.keys(slidesByLanguage).join(", ")}`,
      { duration: 5000 }
    );
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTextDialog(true)}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Parse Text
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={randomizeBackgrounds}
            disabled={slides.length === 0}
          >
            <Shuffle className="w-4 h-4 mr-2" />
            Randomize
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTranslationDialog(true)}
            disabled={slides.length === 0}
          >
            <Languages className="w-4 h-4 mr-2" />
            Translate
          </Button>
          <Button
            size="sm"
            onClick={handleExport}
            disabled={slides.length === 0}
            className="bg-gradient-primary"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
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
                />
              ))}
            </div>
          )}
        </div>

        {/* Center - Canvas */}
        <div className="flex-1 p-6 bg-canvas">
          <CanvasPreview slide={selectedSlide} globalOverlay={globalOverlay} />
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
          />
        </div>
      </div>

      <TextInputDialog
        open={showTextDialog}
        onClose={() => setShowTextDialog(false)}
        onParse={handleParseText}
      />

      <TranslationDialog
        open={showTranslationDialog}
        onClose={() => setShowTranslationDialog(false)}
        onTranslate={handleTranslate}
      />
    </div>
  );
};

export default Editor;
