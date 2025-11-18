import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEditorStore } from "@/store/useEditorStore";
import { parseTextToSlides } from "@/utils/textParser";
import { Copy, Sparkles } from "lucide-react";

interface ParsedSlide {
  title: string;
  body?: string;
  index: number;
}

interface SmartRandomVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SmartRandomVideoDialog = ({
  open,
  onOpenChange,
}: SmartRandomVideoDialogProps) => {
  const [parsedSlides, setParsedSlides] = useState<ParsedSlide[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [unusedText, setUnusedText] = useState("");
  const [templateContent, setTemplateContent] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [categories, setCategories] = useState<string[]>([]);
  
  const { setSlides, addAsset, setBackgroundMusic, getDefaultStyle } = useEditorStore();

  useEffect(() => {
    if (open) {
      loadRandomTemplate();
      loadCategories();
    }
  }, [open]);

  const loadCategories = async () => {
    const { data: assets } = await supabase
      .from("assets")
      .select("category");
    
    if (assets) {
      const uniqueCategories = Array.from(new Set(assets.map(a => a.category || 'default')));
      setCategories(uniqueCategories);
    }
  };

  const loadRandomTemplate = async () => {
    const { data: templates, error } = await supabase
      .from("text_templates")
      .select("*");

    if (error || !templates || templates.length === 0) {
      toast.error("No text templates found. Please add some first!");
      onOpenChange(false);
      return;
    }

    const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
    setTemplateContent(randomTemplate.content);

    // Parse the template into slides
    const projectId = crypto.randomUUID();
    const slides = parseTextToSlides(
      randomTemplate.content,
      projectId,
      getDefaultStyle()
    );

    const parsed = slides.map((slide, index) => ({
      title: slide.title,
      body: slide.body,
      index,
    }));

    setParsedSlides(parsed);
    
    // Default select first 2-3 slides
    const defaultSelected = new Set(parsed.slice(0, Math.min(3, parsed.length)).map(s => s.index));
    setSelectedIndices(defaultSelected);
    updateUnusedText(parsed, defaultSelected);
  };

  const updateUnusedText = (slides: ParsedSlide[], selected: Set<number>) => {
    const unused = slides
      .filter((slide) => !selected.has(slide.index))
      .map((slide) => {
        let text = slide.title;
        if (slide.body) text += `\n${slide.body}`;
        return text;
      })
      .join("\n\n");

    setUnusedText(unused);
  };

  const toggleSlide = (index: number) => {
    const newSelected = new Set(selectedIndices);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedIndices(newSelected);
    updateUnusedText(parsedSlides, newSelected);
  };

  const generateVideo = async () => {
    if (selectedIndices.size === 0) {
      toast.error("Please select at least one slide!");
      return;
    }

    try {
      // Get random assets and music
      let query = supabase.from("assets").select("*");
      
      if (selectedCategory !== "all") {
        query = query.eq("category", selectedCategory);
      }
      
      const { data: assets, error: assetsError } = await query;

      if (assetsError || !assets || assets.length === 0) {
        toast.error("No video assets found in this category. Please upload some first!");
        return;
      }

      const { data: music, error: musicError } = await supabase
        .from("music_tracks")
        .select("*");

      if (musicError || !music || music.length === 0) {
        toast.error("No music tracks found. Please upload some first!");
        return;
      }

      const randomMusic = music[Math.floor(Math.random() * music.length)];

      // Create slides only from selected indices
      const projectId = crypto.randomUUID();
      const allSlides = parseTextToSlides(
        templateContent,
        projectId,
        getDefaultStyle()
      );

      const selectedSlides = allSlides
        .filter((_, index) => selectedIndices.has(index));

      // Calculate total duration needed
      const totalDuration = selectedSlides.reduce((sum, slide) => sum + slide.durationSec, 0);
      
      // Find assets that are equal or longer than total duration
      const suitableAssets = assets.filter(asset => {
        const assetDuration = Number(asset.duration);
        return assetDuration >= totalDuration;
      });

      // Select from suitable assets, or pick the longest available
      let selectedAsset;
      if (suitableAssets.length > 0) {
        selectedAsset = suitableAssets[Math.floor(Math.random() * suitableAssets.length)];
      } else {
        // If no asset is long enough, pick the longest one
        selectedAsset = assets.reduce((longest, asset) => {
          return Number(asset.duration) > Number(longest.duration) ? asset : longest;
        });
      }

      console.log('Selected music:', randomMusic.name, 'URL:', randomMusic.url);
      console.log('Total duration needed:', totalDuration, 'Selected asset duration:', selectedAsset.duration);

      // Apply the selected asset to all slides
      const finalSlides = selectedSlides.map((slide, newIndex) => ({
        ...slide,
        index: newIndex,
        assetId: selectedAsset.id,
      }));

      // Save the full template content for the Global tab (language-specific)
      const { currentLanguage } = useEditorStore.getState();
      localStorage.setItem(`lastParsedText_${currentLanguage}`, templateContent);
      
      // Save the actual unused text (only unselected slides)
      localStorage.setItem(`lastUnusedText_${currentLanguage}`, unusedText);
      
      // Update store - music URL is already the public URL from the database
      setSlides(finalSlides);
      setBackgroundMusic(randomMusic.url);

      // Add all assets to store
      assets.forEach((asset) => {
        addAsset({
          id: asset.id,
          url: asset.url,
          duration: Number(asset.duration),
          width: asset.width,
          height: asset.height,
          createdAt: new Date(asset.created_at),
        });
      });

      toast.success(`Random video created with ${finalSlides.length} slides!`);
      onOpenChange(false);
    } catch (error) {
      console.error("Error generating random video:", error);
      toast.error("Failed to generate random video");
    }
  };

  const copyUnusedText = () => {
    navigator.clipboard.writeText(unusedText);
    toast.success("Unused text copied to clipboard!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Smart Random Video Generator</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Category Selection */}
          <div className="space-y-3">
            <Label htmlFor="category-select">Выберите категорию видео:</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger id="category-select" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все категории</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Slide Selection */}
          <div className="space-y-3">
            <Label>Select slides to include in video:</Label>
            <div className="border rounded-lg p-4 space-y-3 max-h-64 overflow-y-auto">
              {parsedSlides.map((slide) => (
                <div key={slide.index} className="flex items-start gap-3">
                  <Checkbox
                    id={`slide-${slide.index}`}
                    checked={selectedIndices.has(slide.index)}
                    onCheckedChange={() => toggleSlide(slide.index)}
                  />
                  <label
                    htmlFor={`slide-${slide.index}`}
                    className="flex-1 cursor-pointer"
                  >
                    <p className="font-medium">{slide.title}</p>
                    {slide.body && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {slide.body}
                      </p>
                    )}
                  </label>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {selectedIndices.size} slide(s) selected
            </p>
          </div>

          {/* Unused Text Preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Unused text (for captions/description):</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyUnusedText}
                disabled={!unusedText}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </Button>
            </div>
            <Textarea
              value={unusedText}
              readOnly
              className="min-h-[120px] font-mono text-sm"
              placeholder="Unselected slides will appear here..."
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="outline" onClick={loadRandomTemplate}>
            <Sparkles className="w-4 h-4 mr-2" />
            Pick Another Text
          </Button>
          <Button type="button" onClick={generateVideo}>
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Video
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
