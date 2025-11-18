import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEditorStore } from "@/store/useEditorStore";
import { parseTextToSlides } from "@/utils/textParser";

export const RandomVideoButton = () => {
  const { setSlides, addAsset, setBackgroundMusic, getDefaultStyle } = useEditorStore();
  const [showDialog, setShowDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    const { data: assets } = await supabase
      .from("assets")
      .select("category");
    
    if (assets) {
      const uniqueCategories = Array.from(new Set(assets.map(a => a.category || 'default')));
      setCategories(uniqueCategories);
    }
  };

  const generateRandomVideo = async () => {
    try {
      // 1. Get random text template
      const { data: templates, error: templatesError } = await supabase
        .from("text_templates")
        .select("*");

      if (templatesError || !templates || templates.length === 0) {
        toast.error("No text templates found. Please add some first!");
        return;
      }

      const randomTemplate = templates[Math.floor(Math.random() * templates.length)];

      // 2. Get random assets
      let query = supabase.from("assets").select("*");
      
      if (selectedCategory !== "all") {
        query = query.eq("category", selectedCategory);
      }
      
      const { data: assets, error: assetsError } = await query;

      if (assetsError || !assets || assets.length === 0) {
        toast.error("No video assets found in this category. Please upload some first!");
        return;
      }

      // 3. Get random music
      const { data: music, error: musicError } = await supabase
        .from("music_tracks")
        .select("*");

      if (musicError || !music || music.length === 0) {
        toast.error("No music tracks found. Please upload some first!");
        return;
      }

      const randomMusic = music[Math.floor(Math.random() * music.length)];

      // 4. Parse text to slides
      const projectId = crypto.randomUUID();
      const parsedSlides = parseTextToSlides(
        randomTemplate.content,
        projectId,
        getDefaultStyle()
      );

      // 5. Pick ONE random asset for ALL slides
      const randomAsset = assets[Math.floor(Math.random() * assets.length)];
      const slidesWithAssets = parsedSlides.map((slide) => ({
        ...slide,
        assetId: randomAsset.id,
      }));

      // 6. Update store
      setSlides(slidesWithAssets);
      setBackgroundMusic(randomMusic.url);

      // 7. Add all used assets to the store
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

      toast.success(`Random video created from "${randomTemplate.name}"!`);
      setShowDialog(false);
    } catch (error) {
      console.error("Error generating random video:", error);
      toast.error("Failed to generate random video");
    }
  };

  return (
    <>
      <Button
        onClick={() => setShowDialog(true)}
        className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
      >
        <Sparkles className="w-4 h-4 mr-2" />
        Random Video
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Выберите категорию видео</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="category-select">Категория:</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger id="category-select" className="w-full mt-2">
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Отмена
            </Button>
            <Button onClick={generateRandomVideo}>
              <Sparkles className="w-4 h-4 mr-2" />
              Создать видео
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
