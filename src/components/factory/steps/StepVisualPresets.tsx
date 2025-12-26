import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Palette, Check, Settings, Type, Eye } from "lucide-react";
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
  
  // Preview settings
  const [overlayOpacity, setOverlayOpacity] = useState(30);
  const [previewBgIndex, setPreviewBgIndex] = useState(0);

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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

              {/* Overlay Opacity */}
              <div className="space-y-2">
                <Label className="text-xs">Затемнение фона: {overlayOpacity}%</Label>
                <Slider
                  value={[overlayOpacity]}
                  onValueChange={([v]) => setOverlayOpacity(v)}
                  min={0}
                  max={80}
                  step={5}
                />
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

      {/* Right: Live Preview */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Eye className="w-4 h-4" />
          Превью слайда
        </h3>

        {/* 9:16 Aspect Ratio Preview */}
        <div className="flex flex-col items-center">
          <div 
            className="relative w-full max-w-[200px] rounded-lg overflow-hidden shadow-lg"
            style={{ aspectRatio: '9/16' }}
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
              style={{ backgroundColor: `rgba(0, 0, 0, ${overlayOpacity / 100})` }}
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
                  Основной текст слайда с дополнительной информацией
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
                    ? 'border-primary ring-2 ring-primary/30' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <img src={bg} alt={`Background ${index + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>

          <p className="text-xs text-muted-foreground mt-3 text-center">
            Выберите фон для превью
          </p>
        </div>
      </div>
    </div>
  );
};
