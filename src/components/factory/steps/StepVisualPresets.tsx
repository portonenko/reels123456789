import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Palette, Settings, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { VisualPreset } from "@/types/contentFactory";

// Sample background for preview
const PREVIEW_BACKGROUNDS = [
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=700&fit=crop",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&h=700&fit=crop",
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=400&h=700&fit=crop",
];

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

  // Adjustable settings (on top of selected preset)
  const [overlayOpacity, setOverlayOpacity] = useState(30);
  const [titleDuration, setTitleDuration] = useState(2);
  const [otherDuration, setOtherDuration] = useState(3);

  // Preview
  const [previewBgIndex, setPreviewBgIndex] = useState(0);

  // Track if we're syncing from preset to avoid loops
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    loadPresets();
  }, []);

  // Sync sliders from selected preset (only when preset changes)
  useEffect(() => {
    if (!selectedPreset) return;

    setIsSyncing(true);

    // Read overlay from preset's overlayOpacity field (default to 30%)
    setOverlayOpacity(selectedPreset.overlayOpacity ?? 30);
    setTitleDuration(selectedPreset.titleDuration || 2);
    setOtherDuration(selectedPreset.otherDuration || 3);

    // Allow changes after sync
    setTimeout(() => setIsSyncing(false), 50);
  }, [selectedPreset?.id]);

  // Apply slider changes to the selected preset
  useEffect(() => {
    if (!selectedPreset || isSyncing) return;

    // Check if anything changed
    const overlayChanged = overlayOpacity !== (selectedPreset.overlayOpacity ?? 30);
    const titleChanged = titleDuration !== selectedPreset.titleDuration;
    const otherChanged = otherDuration !== selectedPreset.otherDuration;

    if (!overlayChanged && !titleChanged && !otherChanged) return;

    const updatedPreset: VisualPreset = {
      ...selectedPreset,
      titleDuration,
      otherDuration,
      overlayOpacity,
    };

    onPresetSelect(updatedPreset);
  }, [overlayOpacity, titleDuration, otherDuration]);

  const loadPresets = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("presets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formattedPresets: VisualPreset[] = (data || []).map((p) => ({
        id: p.id,
        name: p.name,
        titleDuration: Number(p.title_slide_duration),
        otherDuration: Number(p.other_slides_duration),
        overlayOpacity: 30, // Default overlay, user can adjust
        style: p.style,
      }));

      setPresets(formattedPresets);

      // Auto-select first preset if none selected
      if (!selectedPreset && formattedPresets.length > 0) {
        onPresetSelect(formattedPresets[0]);
      }
    } catch (error) {
      console.error("Error loading presets:", error);
      toast.error("Ошибка загрузки пресетов");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPreset = (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId);
    if (preset) {
      onPresetSelect(preset);
    }
  };

  // Get preview colors from selected preset
  const previewStyle = selectedPreset?.style as any;
  const textColor = previewStyle?.text?.color || "#FFFFFF";
  const bodyTextColor = previewStyle?.text?.bodyColor || textColor;
  const backgroundColor = previewStyle?.plate?.backgroundColor || "#000000";
  const titleFontFamily = previewStyle?.text?.fontFamily || "Inter";
  const bodyFontFamily = previewStyle?.text?.bodyFontFamily || titleFontFamily;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Preset selection */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Palette className="w-4 h-4" />
          Выберите пресет
        </h3>

        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-8">
              Загрузка пресетов...
            </div>
          ) : presets.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>Пресеты ещё не сохранены.</p>
              <p className="text-sm mt-2">
                Создайте пресет в редакторе и сохраните его.
              </p>
            </div>
          ) : (
            <RadioGroup
              value={selectedPreset?.id || ""}
              onValueChange={handleSelectPreset}
              className="space-y-2"
            >
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className={`flex items-center space-x-3 p-3 rounded-lg border transition-all cursor-pointer ${
                    selectedPreset?.id === preset.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => handleSelectPreset(preset.id)}
                >
                  <RadioGroupItem value={preset.id} id={preset.id} />
                  <label
                    htmlFor={preset.id}
                    className="flex-1 cursor-pointer"
                  >
                    <div className="font-medium">{preset.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {preset.titleDuration}с / {preset.otherDuration}с
                    </div>
                  </label>
                </div>
              ))}
            </RadioGroup>
          )}
        </ScrollArea>
      </div>

      {/* Middle: Adjustments */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Настройки
        </h3>

        {!selectedPreset ? (
          <div className="text-center text-muted-foreground py-8">
            Сначала выберите пресет слева
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overlay Opacity */}
            <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
              <Label className="text-sm font-medium">
                Затемнение фона: {overlayOpacity}%
              </Label>
              <Slider
                value={[overlayOpacity]}
                onValueChange={([v]) => setOverlayOpacity(v)}
                min={0}
                max={80}
                step={5}
              />
              <p className="text-xs text-muted-foreground">
                Насколько затемнить видео/фото под текстом
              </p>
            </div>

            {/* Duration Settings */}
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
              <Label className="text-sm font-medium">Длительность слайдов</Label>

              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Титульный слайд</span>
                    <span className="font-mono">{titleDuration}с</span>
                  </div>
                  <Slider
                    value={[titleDuration]}
                    onValueChange={([v]) => setTitleDuration(v)}
                    min={1}
                    max={10}
                    step={0.5}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Остальные слайды</span>
                    <span className="font-mono">{otherDuration}с</span>
                  </div>
                  <Slider
                    value={[otherDuration]}
                    onValueChange={([v]) => setOtherDuration(v)}
                    min={1}
                    max={10}
                    step={0.5}
                  />
                </div>
              </div>
            </div>

            {/* Selected preset info */}
            <div className="p-3 bg-primary/10 rounded-lg text-sm">
              <div className="font-medium text-primary">
                Выбран: {selectedPreset.name}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Настройки применяются автоматически
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right: Live Preview */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Eye className="w-4 h-4" />
          Превью
        </h3>

        <div className="flex flex-col items-center">
          <div
            className="relative w-full max-w-[200px] rounded-lg overflow-hidden shadow-lg"
            style={{ aspectRatio: "9/16" }}
          >
            {/* Background Image */}
            <img
              src={PREVIEW_BACKGROUNDS[previewBgIndex]}
              alt="Preview background"
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Overlay */}
            <div
              className="absolute inset-0"
              style={{
                backgroundColor: `rgba(0, 0, 0, ${overlayOpacity / 100})`,
              }}
            />

            {/* Content */}
            <div className="absolute inset-0 flex flex-col justify-center items-center p-4 text-center">
              {/* Text Plate */}
              <div
                className="rounded-lg p-3 w-full"
                style={{ backgroundColor: `${backgroundColor}cc` }}
              >
                <div
                  className="text-sm font-bold leading-tight"
                  style={{ color: textColor, fontFamily: titleFontFamily }}
                >
                  Заголовок слайда
                </div>
                <div
                  className="text-[10px] mt-1 leading-tight opacity-90"
                  style={{ color: bodyTextColor, fontFamily: bodyFontFamily }}
                >
                  Основной текст слайда
                </div>
              </div>
            </div>
          </div>

          {/* Background switcher */}
          <div className="flex gap-2 mt-4">
            {PREVIEW_BACKGROUNDS.map((bg, index) => (
              <button
                key={index}
                onClick={() => setPreviewBgIndex(index)}
                className={`w-10 h-10 rounded-lg overflow-hidden border-2 transition-all ${
                  previewBgIndex === index
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <img
                  src={bg}
                  alt={`Background ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
