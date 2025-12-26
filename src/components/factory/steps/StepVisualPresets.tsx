import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Palette, Check, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { VisualPreset } from "@/types/contentFactory";

interface StepVisualPresetsProps {
  selectedPreset?: VisualPreset;
  onPresetSelect: (preset: VisualPreset) => void;
  getDefaultStyle: () => any;
}

export const StepVisualPresets = ({
  selectedPreset,
  onPresetSelect,
  getDefaultStyle,
}: StepVisualPresetsProps) => {
  const [presets, setPresets] = useState<VisualPreset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  
  // Custom preset settings
  const [customName, setCustomName] = useState("Custom Preset");
  const [titleDuration, setTitleDuration] = useState(2);
  const [otherDuration, setOtherDuration] = useState(3);

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("presets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formattedPresets: VisualPreset[] = (data || []).map(p => ({
        id: p.id,
        name: p.name,
        titleDuration: Number(p.title_slide_duration),
        otherDuration: Number(p.other_slides_duration),
        style: p.style,
      }));

      setPresets(formattedPresets);
    } catch (error) {
      console.error("Error loading presets:", error);
      toast.error("Failed to load presets");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPreset = (preset: VisualPreset) => {
    setShowCustom(false);
    onPresetSelect(preset);
  };

  const handleUseCustom = () => {
    const customPreset: VisualPreset = {
      id: "custom",
      name: customName,
      titleDuration,
      otherDuration,
      style: getDefaultStyle(),
    };
    onPresetSelect(customPreset);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Saved presets */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Palette className="w-4 h-4" />
          Saved Presets
        </h3>

        <ScrollArea className="h-[350px]">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-8">
              Loading presets...
            </div>
          ) : presets.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>No presets saved yet.</p>
              <p className="text-sm mt-2">Use custom settings on the right.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {presets.map((preset) => (
                <Button
                  key={preset.id}
                  variant={selectedPreset?.id === preset.id ? "default" : "outline"}
                  className="w-full justify-between h-auto py-3 px-4"
                  onClick={() => handleSelectPreset(preset)}
                >
                  <div className="text-left">
                    <div className="font-medium">{preset.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Title: {preset.titleDuration}s • Other: {preset.otherDuration}s
                    </div>
                  </div>
                  {selectedPreset?.id === preset.id && (
                    <Check className="w-4 h-4 ml-2" />
                  )}
                </Button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right: Custom settings */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Custom Settings
        </h3>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Preset Name</Label>
            <Input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="My Custom Preset"
            />
          </div>

          <div className="space-y-2">
            <Label>Title Slide Duration: {titleDuration}s</Label>
            <Slider
              value={[titleDuration]}
              onValueChange={([v]) => setTitleDuration(v)}
              min={1}
              max={10}
              step={0.5}
            />
          </div>

          <div className="space-y-2">
            <Label>Other Slides Duration: {otherDuration}s</Label>
            <Slider
              value={[otherDuration]}
              onValueChange={([v]) => setOtherDuration(v)}
              min={1}
              max={10}
              step={0.5}
            />
          </div>

          <div className="pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground mb-4">
              Custom settings will use the default visual style. 
              For advanced styling, create and save presets from the regular Editor.
            </p>
            
            <Button
              onClick={handleUseCustom}
              variant={selectedPreset?.id === "custom" ? "default" : "outline"}
              className="w-full"
            >
              {selectedPreset?.id === "custom" ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Using Custom Settings
                </>
              ) : (
                "Use Custom Settings"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
