import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Plus, Download } from "lucide-react";
import { SlideStyle } from "@/types";
import { useEditorStore } from "@/store/useEditorStore";

interface Preset {
  id: string;
  name: string;
  title_slide_duration: number;
  other_slides_duration: number;
  style: any;
}

interface PresetManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PresetManager = ({ open, onOpenChange }: PresetManagerProps) => {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [newPresetName, setNewPresetName] = useState("");
  const [titleDuration, setTitleDuration] = useState(2);
  const [otherDuration, setOtherDuration] = useState(3);
  const { slides, updateSlide, getDefaultStyle } = useEditorStore();

  useEffect(() => {
    if (open) {
      loadPresets();
    }
  }, [open]);

  const loadPresets = async () => {
    const { data, error } = await supabase
      .from("presets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load presets");
      return;
    }

    setPresets(data || []);
  };

  const saveCurrentAsPreset = async () => {
    if (!newPresetName.trim()) {
      toast.error("Please enter a preset name");
      return;
    }

    if (slides.length === 0) {
      toast.error("No slides to save as preset");
      return;
    }

    // Use the style from the first slide as the preset style
    const styleToSave = slides[0].style;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in to save presets");
      return;
    }

    const { error } = await supabase.from("presets").insert([{
      user_id: user.id,
      name: newPresetName,
      title_slide_duration: titleDuration,
      other_slides_duration: otherDuration,
      style: styleToSave as any,
    }]);

    if (error) {
      toast.error("Failed to save preset");
      return;
    }

    toast.success(`Preset "${newPresetName}" saved!`);
    setNewPresetName("");
    loadPresets();
  };

  const applyPreset = async (preset: Preset) => {
    // Apply the preset style and durations to all slides
    slides.forEach((slide) => {
      const duration =
        slide.type === "title-only"
          ? preset.title_slide_duration
          : preset.other_slides_duration;

      // Ensure font family is properly applied
      const updatedStyle = {
        ...preset.style,
        text: {
          ...preset.style.text,
          fontFamily: preset.style.text.fontFamily || "Inter",
          bodyFontFamily: preset.style.text.bodyFontFamily || preset.style.text.fontFamily || "Inter",
        },
      };

      updateSlide(slide.id, {
        style: updatedStyle,
        durationSec: duration,
      });
    });

    toast.success(`Applied preset "${preset.name}"!`);
    onOpenChange(false);
  };

  const deletePreset = async (id: string, name: string) => {
    const { error } = await supabase.from("presets").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete preset");
      return;
    }

    toast.success(`Deleted preset "${name}"`);
    loadPresets();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Presets</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Save New Preset */}
          <div className="space-y-4 border-b pb-4">
            <h3 className="font-semibold">Save Current Style as Preset</h3>
            <div className="grid gap-4">
              <div>
                <Label htmlFor="preset-name">Preset Name</Label>
                <Input
                  id="preset-name"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  placeholder="e.g., 'Quick Reel Style'"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title-duration">Title Slide Duration (sec)</Label>
                  <Input
                    id="title-duration"
                    type="number"
                    min="1"
                    max="10"
                    value={titleDuration}
                    onChange={(e) => setTitleDuration(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="other-duration">Other Slides Duration (sec)</Label>
                  <Input
                    id="other-duration"
                    type="number"
                    min="1"
                    max="10"
                    value={otherDuration}
                    onChange={(e) => setOtherDuration(Number(e.target.value))}
                  />
                </div>
              </div>
              <Button onClick={saveCurrentAsPreset}>
                <Plus className="w-4 h-4 mr-2" />
                Save Preset
              </Button>
            </div>
          </div>

          {/* Load Existing Presets */}
          <div className="space-y-4">
            <h3 className="font-semibold">Saved Presets</h3>
            {presets.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No presets saved yet. Create one above!
              </p>
            ) : (
              <div className="space-y-2">
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{preset.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Title: {preset.title_slide_duration}s | Other:{" "}
                        {preset.other_slides_duration}s
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => applyPreset(preset)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Apply
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deletePreset(preset.id, preset.name)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
