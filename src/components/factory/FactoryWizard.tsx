import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  FactoryState, 
  GeneratedContent,
  FactoryLanguage,
  FACTORY_LANGUAGES,
} from "@/types/contentFactory";
import { useEditorStore } from "@/store/useEditorStore";
import { Slide } from "@/types";

import { StepSourceText } from "./steps/StepSourceText";
import { StepVisualPresets } from "./steps/StepVisualPresets";
import { StepContentMatrix } from "./steps/StepContentMatrix";
import { StepProcessing } from "./steps/StepProcessing";
import { StepReview } from "./steps/StepReview";

const STEP_TITLES = [
  "Source Text",
  "Visual Presets",
  "Content Matrix",
  "Processing",
  "Review & Save"
];

export const FactoryWizard = () => {
  const navigate = useNavigate();
  const { getDefaultStyle, assets, addAsset } = useEditorStore();
  
  const [state, setState] = useState<FactoryState>({
    step: 1,
    slides: [{ id: crypto.randomUUID(), title: "", body: "" }],
    captionText: "",
    selectedTemplateId: undefined,
    selectedPreset: undefined,
    matrix: {
      languages: [],
      formats: [],
    },
    generatedContent: [],
    isProcessing: false,
    processingProgress: 0,
    processingMessage: "",
  });

  // Check auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        toast.error("Please sign in to access the Content Factory");
      }
    };
    checkAuth();
  }, [navigate]);

  const canProceed = (): boolean => {
    switch (state.step) {
      case 1:
        // At least one slide with a title
        return state.slides.some(s => s.title.trim().length > 0);
      case 2:
        return state.selectedPreset !== undefined;
      case 3:
        return state.matrix.languages.length > 0 && state.matrix.formats.length > 0;
      case 4:
        return !state.isProcessing;
      case 5:
        return true;
      default:
        return false;
    }
  };

  const handleNext = async () => {
    if (state.step < 5) {
      if (state.step === 3) {
        // Start processing when moving from step 3 to 4
        setState(prev => ({ ...prev, step: 4 }));
        await startBatchProcessing();
      } else {
        setState(prev => ({ ...prev, step: (prev.step + 1) as any }));
      }
    }
  };

  const handleBack = () => {
    if (state.step > 1) {
      setState(prev => ({ ...prev, step: (prev.step - 1) as any }));
    }
  };

  const applyEnergiaRule = (text: string, lang: FactoryLanguage): string => {
    const rule = FACTORY_LANGUAGES.find(l => l.code === lang);
    if (!rule) return text;
    
    // Replace ENERGIA (case-insensitive) with language-specific version
    return text.replace(/ENERGIA/gi, rule.energiaReplacement);
  };

  const startBatchProcessing = async () => {
    setState(prev => ({ 
      ...prev, 
      isProcessing: true, 
      processingProgress: 0,
      processingMessage: "Initializing...",
      generatedContent: []
    }));

    try {
      const { languages, formats } = state.matrix;
      const totalCombinations = languages.length * formats.length;
      let completed = 0;

      // Convert slide inputs to Slide objects
      const baseSlides: Slide[] = state.slides
        .filter(s => s.title.trim()) // Only slides with content
        .map((slideInput, idx) => ({
          id: crypto.randomUUID(),
          projectId: "factory-project",
          index: idx,
          type: slideInput.body.trim() ? "title-body" as const : "title-only" as const,
          title: slideInput.title,
          body: slideInput.body.trim() || undefined,
          durationSec: state.selectedPreset 
            ? (idx === 0 ? state.selectedPreset.titleDuration : state.selectedPreset.otherDuration)
            : 3,
          style: state.selectedPreset?.style || getDefaultStyle(),
        }));

      const generatedContent: GeneratedContent[] = [];

      // Load assets if needed
      let availableAssets = Object.values(assets);
      if (availableAssets.length === 0) {
        setState(prev => ({ ...prev, processingMessage: "Loading assets..." }));
        const { data: dbAssets } = await supabase.from("assets").select("*");
        if (dbAssets) {
          availableAssets = dbAssets.map(a => ({
            id: a.id,
            url: a.url,
            duration: Number(a.duration),
            width: a.width,
            height: a.height,
            createdAt: new Date(a.created_at || Date.now()),
            type: a.type as 'video' | 'image',
            category: a.category,
          }));
          availableAssets.forEach(a => addAsset(a));
        }
      }

      // Load music tracks
      let musicTracks: any[] = [];
      const { data: dbMusic } = await supabase.from("music_tracks").select("*");
      if (dbMusic) {
        musicTracks = dbMusic;
      }

      // Process each language
      for (const lang of languages) {
        setState(prev => ({ 
          ...prev, 
          processingMessage: `Translating to ${FACTORY_LANGUAGES.find(l => l.code === lang)?.name}...` 
        }));

        let translatedSlides: Slide[] = [];

        if (lang === "en") {
          // For English, just apply the ENERGIA rule
          const caption = state.captionText?.trim()
            ? applyEnergiaRule(state.captionText, lang)
            : "";

          translatedSlides = baseSlides.map(slide => ({
            ...slide,
            id: crypto.randomUUID(),
            title: applyEnergiaRule(slide.title, lang),
            body: slide.body ? applyEnergiaRule(slide.body, lang) : undefined,
            language: lang,
          }));

          // attach caption later per generated item
          (translatedSlides as any)._factoryCaption = caption;
        } else {
          // Translate using the edge function
          try {
            const { data, error } = await supabase.functions.invoke("translate-slides", {
              body: {
                slides: baseSlides.map(s => ({
                  id: s.id,
                  title: s.title,
                  body: s.body,
                  style: s.style,
                  durationSec: s.durationSec,
                  type: s.type,
                  projectId: s.projectId,
                })),
                targetLanguages: [lang],
                unusedText: state.captionText,
              },
            });

            if (error) {
              console.error("Edge function error:", error);
              throw new Error(error.message || "Failed to send a request to the Edge Function");
            }

            if (!data || !data.translatedSlides) {
              console.error("Invalid response from translate-slides:", data);
              throw new Error("Invalid response from translation service");
            }

            const caption = (data.translatedUnusedText?.[lang] as string | undefined)?.trim()
              ? applyEnergiaRule(String(data.translatedUnusedText[lang]), lang)
              : "";

            translatedSlides = (data.translatedSlides || []).map((ts: any, idx: number) => {
              // Apply ENERGIA rule to translated text
              let title = ts.title.replace(/^\[.*?\]\s*/, ""); // Remove language prefix
              let body = ts.body;

              title = applyEnergiaRule(title, lang);
              if (body) body = applyEnergiaRule(body, lang);

              return {
                ...ts,
                id: crypto.randomUUID(),
                title,
                body,
                style: baseSlides[idx]?.style || getDefaultStyle(),
                durationSec: baseSlides[idx]?.durationSec || 3,
                language: lang,
              };
            });

            (translatedSlides as any)._factoryCaption = caption;
          } catch (invokeError: any) {
            console.error("Function invoke failed:", invokeError);
            throw new Error(`Translation failed for ${lang}: ${invokeError.message || "Network error"}`);
          }
        }

        // Generate each format for this language
        for (const format of formats) {
          const contentId = `${lang}-${format}-${Date.now()}`;

          setState((prev) => ({
            ...prev,
            processingMessage: `Generating ${format} for ${FACTORY_LANGUAGES.find((l) => l.code === lang)?.name}...`,
          }));

          // Clone slides and assign random backgrounds
          const contentSlides = translatedSlides.map((slide) => {
            let assetId: string | undefined;

            if (format === "video") {
              const videoAssets = availableAssets.filter((a) => a.type === "video" || !a.type);
              if (videoAssets.length > 0) {
                assetId = videoAssets[Math.floor(Math.random() * videoAssets.length)].id;
              }
            } else {
              const imageAssets = availableAssets.filter((a) => a.type === "image");
              if (imageAssets.length > 0) {
                assetId = imageAssets[Math.floor(Math.random() * imageAssets.length)].id;
              }
            }

            return { ...slide, assetId };
          });

          // Assign random music for video format
          let musicUrl: string | undefined;
          if (format === "video" && musicTracks.length > 0) {
            const randomTrack = musicTracks[Math.floor(Math.random() * musicTracks.length)];
            musicUrl = randomTrack.url;
          }

          generatedContent.push({
            id: contentId,
            language: lang,
            format,
            slides: contentSlides,
            status: "completed",
            musicUrl,
            captionText: (translatedSlides as any)._factoryCaption || "",
          });

          completed++;
          setState((prev) => ({
            ...prev,
            processingProgress: Math.round((completed / totalCombinations) * 100),
            generatedContent: [...generatedContent],
          }));
        }
      }

      setState(prev => ({ 
        ...prev, 
        isProcessing: false,
        processingProgress: 100,
        processingMessage: "Complete!",
        generatedContent,
        step: 5
      }));

      toast.success(`Generated ${generatedContent.length} content items!`);
    } catch (error: any) {
      console.error("Batch processing error:", error);
      setState(prev => ({ 
        ...prev, 
        isProcessing: false,
        processingMessage: `Error: ${error.message}` 
      }));
      toast.error(`Processing failed: ${error.message}`);
    }
  };

  const updateState = (updates: Partial<FactoryState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const renderStepContent = () => {
    switch (state.step) {
      case 1:
        return (
          <StepSourceText
            slides={state.slides}
            captionText={state.captionText}
            selectedTemplateId={state.selectedTemplateId}
            onSlidesChange={(slides) => updateState({ slides })}
            onCaptionTextChange={(text) => updateState({ captionText: text })}
            onTemplateSelect={(id, _content) =>
              updateState({
                selectedTemplateId: id,
              })
            }
          />
        );
      case 2:
        return (
          <StepVisualPresets
            selectedPreset={state.selectedPreset}
            onPresetSelect={(preset) => updateState({ selectedPreset: preset })}
            getDefaultStyle={getDefaultStyle}
          />
        );
      case 3:
        return (
          <StepContentMatrix
            matrix={state.matrix}
            onMatrixChange={(matrix) => updateState({ matrix })}
          />
        );
      case 4:
        return (
          <StepProcessing
            isProcessing={state.isProcessing}
            progress={state.processingProgress}
            message={state.processingMessage}
          />
        );
      case 5:
        return (
          <StepReview
            generatedContent={state.generatedContent}
            assets={Object.values(assets)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-14 border-b border-border bg-card px-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <Home className="w-4 h-4 mr-2" />
            Home
          </Button>
          <h1 className="font-semibold">Content Factory</h1>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {STEP_TITLES.map((title, idx) => (
            <div 
              key={idx}
              className={`flex items-center gap-1 ${idx + 1 === state.step ? 'text-primary' : 'text-muted-foreground'}`}
            >
              <div 
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  idx + 1 < state.step 
                    ? 'bg-primary text-primary-foreground' 
                    : idx + 1 === state.step 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {idx + 1}
              </div>
              <span className="text-sm hidden lg:inline">{title}</span>
              {idx < STEP_TITLES.length - 1 && (
                <ChevronRight className="w-4 h-4 text-muted-foreground mx-1" />
              )}
            </div>
          ))}
        </div>

        <div className="w-24" /> {/* Spacer for balance */}
      </header>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">
            Step {state.step}: {STEP_TITLES[state.step - 1]}
          </h2>
          
          {renderStepContent()}
        </div>
      </div>

      {/* Footer with navigation */}
      <footer className="h-16 border-t border-border bg-card px-6 flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={state.step === 1 || state.isProcessing}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Button
          onClick={handleNext}
          disabled={!canProceed() || state.step === 5}
          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
        >
          {state.step === 3 ? "Generate" : state.step === 4 ? "View Results" : "Next"}
          {state.step < 5 && <ChevronRight className="w-4 h-4 ml-2" />}
        </Button>
      </footer>
    </div>
  );
};
