import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Star, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
}

export const ColorPicker = ({ label, value, onChange }: ColorPickerProps) => {
  const [favoriteColors, setFavoriteColors] = useState<string[]>([]);

  useEffect(() => {
    loadFavoriteColors();
  }, []);

  const loadFavoriteColors = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("user_preferences")
      .select("favorite_colors")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Error loading favorite colors:", error);
      return;
    }

    setFavoriteColors(data?.favorite_colors || []);
  };

  const addToFavorites = async () => {
    if (favoriteColors.includes(value)) {
      toast.info("Color already in favorites");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const newFavorites = [...favoriteColors, value];

    const { error } = await supabase
      .from("user_preferences")
      .upsert({
        user_id: user.id,
        favorite_colors: newFavorites,
      });

    if (error) {
      toast.error("Failed to save favorite color");
      return;
    }

    setFavoriteColors(newFavorites);
    toast.success("Color added to favorites");
  };

  const removeFavorite = async (color: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const newFavorites = favoriteColors.filter((c) => c !== color);

    const { error } = await supabase
      .from("user_preferences")
      .update({ favorite_colors: newFavorites })
      .eq("user_id", user.id);

    if (error) {
      toast.error("Failed to remove favorite");
      return;
    }

    setFavoriteColors(newFavorites);
    toast.success("Color removed from favorites");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Button
          size="sm"
          variant="ghost"
          onClick={addToFavorites}
          className="h-6 px-2"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add to Favorites
        </Button>
      </div>
      
      <div className="flex gap-2">
        <Input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-20"
        />
        <div className="flex-1 px-3 py-2 bg-secondary rounded text-sm font-mono">
          {value.toUpperCase()}
        </div>
      </div>

      {favoriteColors.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Favorite Colors:</Label>
          <div className="flex flex-wrap gap-2">
            {favoriteColors.map((color) => (
              <button
                key={color}
                className="group relative w-8 h-8 rounded border-2 border-border hover:border-primary transition-colors"
                style={{ backgroundColor: color }}
                onClick={() => onChange(color)}
                title={`Click to use ${color}`}
              >
                <button
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFavorite(color);
                  }}
                >
                  ×
                </button>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
