import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Palette, Check, Settings, Type } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { VisualPreset } from "@/types/contentFactory";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Available fonts
const FONTS = [
  { value: "Inter", label: "Inter" },
  { value: "Roboto", label: "Roboto" },
  { value: "Montserrat", label: "Montserrat" },
  { value: "Playfair Display", label: "Playfair Display" },
  { value: "Oswald", label: "Oswald" },
  { value: "Lato", label: "Lato" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Raleway", label: "Raleway" },
  { value: "Poppins", label: "Poppins" },
  { value: "Merriweather", label: "Merriweather" },
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
  
  // Custom preset settings
  const [customName, setCustomName] = useState("Custom Preset");
  const [titleDuration, setTitleDuration] = useState(2);
  const [otherDuration, setOtherDuration] = useState(3);
  
  // Font settings - separate for title and body
  const [titleFontFamily, setTitleFontFamily] = useState("Inter");
  const [bodyFontFamily, setBodyFontFamily] = useState("Inter");
  
  // Color settings
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [bodyTextColor, setBodyTextColor] = useState("#FFFFFF");
  const [backgroundColor, setBackgroundColor] = useState("#000000");

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
      toast.error("Ошибка загрузки пресетов");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPreset = (preset: VisualPreset) => {
    onPresetSelect(preset);
  };

  const handleUseCustom = () => {
    const baseStyle = getDefaultStyle();
    const customStyle = {
      ...baseStyle,
      text: {
        ...baseStyle.text,
        fontFamily: titleFontFamily,
        bodyFontFamily: bodyFontFamily,
        color: textColor,
        bodyColor: bodyTextColor,
      },
      plate: {
        ...baseStyle.plate,
        backgroundColor,
      },
    };
    
    const customPreset: VisualPreset = {
      id: "custom",
      name: customName,
      titleDuration,
      otherDuration,
      style: customStyle,
    };
    onPresetSelect(customPreset);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Saved presets */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Palette className="w-4 h-4" />
          Сохранённые пресеты
        </h3>

        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-8">
              Загрузка пресетов...
            </div>
          ) : presets.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>Пресеты ещё не сохранены.</p>
              <p className="text-sm mt-2">Используйте настройки справа.</p>
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
                      Титульный: {preset.titleDuration}с • Другие: {preset.otherDuration}с
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
          Кастомные настройки
        </h3>

        <ScrollArea className="h-[400px] pr-2">
          <div className="space-y-5">
            {/* Preset Name */}
            <div className="space-y-2">
              <Label>Название пресета</Label>
              <Input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Мой пресет"
              />
            </div>

            {/* Duration Settings */}
            <div className="space-y-4 p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Settings className="w-4 h-4" />
                Длительность слайдов
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs">Титульный слайд: {titleDuration}с</Label>
                <Slider
                  value={[titleDuration]}
                  onValueChange={([v]) => setTitleDuration(v)}
                  min={1}
                  max={10}
                  step={0.5}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Остальные слайды: {otherDuration}с</Label>
                <Slider
                  value={[otherDuration]}
                  onValueChange={([v]) => setOtherDuration(v)}
                  min={1}
                  max={10}
                  step={0.5}
                />
              </div>
            </div>

            {/* Font & Color Settings */}
            <div className="space-y-4 p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Type className="w-4 h-4" />
                Шрифт и цвета
              </div>

              {/* Title Font */}
              <div className="space-y-2">
                <Label className="text-xs">Шрифт заголовка</Label>
                <Select value={titleFontFamily} onValueChange={setTitleFontFamily}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONTS.map(font => (
                      <SelectItem 
                        key={font.value} 
                        value={font.value}
                        style={{ fontFamily: font.value }}
                      >
                        {font.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Body Font */}
              <div className="space-y-2">
                <Label className="text-xs">Шрифт основного текста</Label>
                <Select value={bodyFontFamily} onValueChange={setBodyFontFamily}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONTS.map(font => (
                      <SelectItem 
                        key={font.value} 
                        value={font.value}
                        style={{ fontFamily: font.value }}
                      >
                        {font.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Colors */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Цвет заголовка</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border border-border"
                    />
                    <Input
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="flex-1 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Цвет основного текста</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={bodyTextColor}
                      onChange={(e) => setBodyTextColor(e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border border-border"
                    />
                    <Input
                      value={bodyTextColor}
                      onChange={(e) => setBodyTextColor(e.target.value)}
                      className="flex-1 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Цвет плашки</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border border-border"
                  />
                  <Input
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="flex-1 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Preview */}
              <div 
                className="mt-3 p-4 rounded-lg text-center"
                style={{ backgroundColor: backgroundColor }}
              >
                <div 
                  className="text-lg font-bold"
                  style={{ color: textColor, fontFamily: titleFontFamily }}
                >
                  Превью заголовка
                </div>
                <div 
                  className="text-sm mt-1"
                  style={{ color: bodyTextColor, fontFamily: bodyFontFamily }}
                >
                  Превью основного текста
                </div>
              </div>
            </div>

            <Button
              onClick={handleUseCustom}
              variant={selectedPreset?.id === "custom" ? "default" : "outline"}
              className="w-full"
            >
              {selectedPreset?.id === "custom" ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Используются кастомные настройки
                </>
              ) : (
                "Применить кастомные настройки"
              )}
            </Button>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
