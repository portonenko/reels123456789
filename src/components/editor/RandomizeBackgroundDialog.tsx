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
import { Shuffle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEditorStore } from "@/store/useEditorStore";

interface RandomizeBackgroundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RandomizeBackgroundDialog = ({
  open,
  onOpenChange,
}: RandomizeBackgroundDialogProps) => {
  const { assets, addAsset } = useEditorStore();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadCategories();
      loadDefaultCategory();
    }
  }, [open]);

  const loadDefaultCategory = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("user_preferences")
      .select("default_video_category")
      .eq("user_id", user.id)
      .single();

    if (data?.default_video_category) {
      setSelectedCategory(data.default_video_category);
    }
  };

  const loadCategories = async () => {
    const { data: assetsData } = await supabase
      .from("assets")
      .select("category");
    
    if (assetsData) {
      const uniqueCategories = Array.from(new Set(assetsData.map(a => a.category || 'default')));
      setCategories(uniqueCategories);
    }
  };

  const handleRandomize = async () => {
    setLoading(true);
    try {
      // Save selected category as default
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("user_preferences")
          .upsert({ 
            user_id: user.id, 
            default_video_category: selectedCategory 
          });
      }

      let query = supabase.from("assets").select("*");
      
      if (selectedCategory !== "all") {
        query = query.eq("category", selectedCategory);
      }
      
      const { data: fetchedAssets, error } = await query;

      if (error || !fetchedAssets || fetchedAssets.length === 0) {
        toast.error("Нет видео в выбранной категории");
        setLoading(false);
        return;
      }

      // Add assets to store if not already there
      fetchedAssets.forEach((asset) => {
        if (!assets.find(a => a.id === asset.id)) {
          addAsset({
            id: asset.id,
            url: asset.url,
            duration: Number(asset.duration),
            width: asset.width,
            height: asset.height,
            createdAt: new Date(asset.created_at || new Date()),
          });
        }
      });

      // Pick random asset from filtered list
      const randomAsset = fetchedAssets[Math.floor(Math.random() * fetchedAssets.length)];
      
      // Update all slides with this asset
      const { slides } = useEditorStore.getState();
      const newSlides = slides.map((slide) => ({
        ...slide,
        assetId: randomAsset.id,
      }));

      useEditorStore.getState().setSlides(newSlides);
      
      toast.success("Фоны обновлены");
      onOpenChange(false);
    } catch (error) {
      console.error("Error randomizing backgrounds:", error);
      toast.error("Ошибка при рандомизации фонов");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Выберите категорию видео</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="category">Категория</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Все категории" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все категории</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleRandomize} disabled={loading}>
            <Shuffle className="w-4 h-4 mr-2" />
            {loading ? "Загрузка..." : "Применить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
