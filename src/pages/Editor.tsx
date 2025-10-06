import { useState } from "react";
import { useEditorStore } from "@/store/useEditorStore";
import { SlideCard } from "@/components/editor/SlideCard";
import { CanvasPreview } from "@/components/editor/CanvasPreview";
import { StylePanel } from "@/components/editor/StylePanel";
import { TextInputDialog } from "@/components/editor/TextInputDialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Home, Download, Shuffle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { parseTextToSlides } from "@/utils/textParser";
import { toast } from "sonner";

const Editor = () => {
  const navigate = useNavigate();
  const [showTextDialog, setShowTextDialog] = useState(false);
  
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

  const handleExport = () => {
    toast.info("Export feature coming soon!");
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
    </div>
  );
};

export default Editor;
