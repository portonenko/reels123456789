import { Slide } from "@/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useEditorStore } from "@/store/useEditorStore";
import { toast } from "sonner";
import { MusicUploadSimple } from "./MusicUploadSimple";
import { ColorPicker } from "./ColorPicker";
import { TransitionPicker, TransitionType } from "./TransitionPicker";
import { Separator } from "@/components/ui/separator";
import { UnusedTextPreview } from "./UnusedTextPreview";

interface StylePanelProps {
  slide: Slide | null;
  globalOverlay: number;
  onUpdateSlide: (updates: Partial<Slide>) => void;
  onUpdateGlobalOverlay: (value: number) => void;
  showTextBoxControls: boolean;
  onToggleTextBoxControls: (show: boolean) => void;
  showPositionEditor?: boolean;
  onTogglePositionEditor?: (show: boolean) => void;
  lang?: 'en' | 'ru';
}

const FONT_FAMILIES = [
  "Inter",
  "Lora",
  "Roboto",
  "League Spartan",
  "Arial",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Verdana",
];

export const StylePanel = ({
  slide,
  globalOverlay,
  onUpdateSlide,
  onUpdateGlobalOverlay,
  showTextBoxControls,
  onToggleTextBoxControls,
  showPositionEditor = false,
  onTogglePositionEditor,
  lang = 'en',
}: StylePanelProps) => {
  const { applyStyleToAll, applyDurationToAll, slides, updateSlide } = useEditorStore();

  const handleApplyStyleToAll = () => {
    if (!slide) return;
    applyStyleToAll(slide.id);
    toast.success(`Applied ALL styles to all ${slides.length} slides`);
  };

  const handleApplyDurationToAll = () => {
    if (!slide) return;
    applyDurationToAll(slide.durationSec);
    toast.success(`Applied ${slide.durationSec}s duration to all ${slides.length} slides`);
  };
  
  if (!slide) {
    return (
      <div className="h-full flex items-center justify-center bg-panel rounded-lg">
        <p className="text-muted-foreground text-sm">Select a slide to edit styles</p>
      </div>
    );
  }

  return (
    <div className="h-full bg-panel rounded-lg overflow-hidden flex flex-col">
      <Tabs defaultValue="text" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-4 bg-secondary">
          <TabsTrigger value="text">Text</TabsTrigger>
          <TabsTrigger value="position">Position</TabsTrigger>
          <TabsTrigger value="plate">Plate</TabsTrigger>
          <TabsTrigger value="global">Global</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto p-4">
          <TabsContent value="text" className="space-y-4 mt-0">
            <div>
              <Label>Title Font Family</Label>
              <Select
                value={slide.style.text.fontFamily}
                onValueChange={(value) =>
                  onUpdateSlide({
                    style: {
                      ...slide.style,
                      text: { ...slide.style.text, fontFamily: value },
                    },
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_FAMILIES.map((font) => (
                    <SelectItem key={font} value={font}>
                      {font}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Body Font Family</Label>
              <Select
                value={slide.style.text.bodyFontFamily || slide.style.text.fontFamily}
                onValueChange={(value) =>
                  onUpdateSlide({
                    style: {
                      ...slide.style,
                      text: { ...slide.style.text, bodyFontFamily: value },
                    },
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_FAMILIES.map((font) => (
                    <SelectItem key={font} value={font}>
                      {font}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Title Font Size: {slide.style.text.fontSize}px</Label>
              <Slider
                value={[slide.style.text.fontSize]}
                onValueChange={([value]) =>
                  onUpdateSlide({
                    style: {
                      ...slide.style,
                      text: { ...slide.style.text, fontSize: value },
                    },
                  })
                }
                min={24}
                max={96}
                step={2}
              />
            </div>

            <div>
              <Label>Body Font Size: {slide.style.text.bodyFontSize || Math.round(slide.style.text.fontSize * 0.5)}px</Label>
              <Slider
                value={[slide.style.text.bodyFontSize || Math.round(slide.style.text.fontSize * 0.5)]}
                onValueChange={([value]) =>
                  onUpdateSlide({
                    style: {
                      ...slide.style,
                      text: { ...slide.style.text, bodyFontSize: value },
                    },
                  })
                }
                min={12}
                max={72}
                step={1}
              />
            </div>

            <div>
              <Label>Title Font Weight: {slide.style.text.fontWeight}</Label>
              <Slider
                value={[slide.style.text.fontWeight]}
                onValueChange={([value]) =>
                  onUpdateSlide({
                    style: {
                      ...slide.style,
                      text: { ...slide.style.text, fontWeight: value },
                    },
                  })
                }
                min={300}
                max={900}
                step={100}
              />
            </div>

            <div>
              <Label>Body Font Weight: {slide.style.text.bodyFontWeight || slide.style.text.fontWeight - 200}</Label>
              <Slider
                value={[slide.style.text.bodyFontWeight || slide.style.text.fontWeight - 200]}
                onValueChange={([value]) =>
                  onUpdateSlide({
                    style: {
                      ...slide.style,
                      text: { ...slide.style.text, bodyFontWeight: value },
                    },
                  })
                }
                min={300}
                max={900}
                step={100}
              />
            </div>

            <ColorPicker
              label="Title Color"
              value={slide.style.text.color}
              onChange={(color) => {
                // Preserve the current body color when changing title color
                const currentBodyColor = slide.style.text.bodyColor || slide.style.text.color;
                onUpdateSlide({
                  style: {
                    ...slide.style,
                    text: { 
                      ...slide.style.text, 
                      color,
                      bodyColor: currentBodyColor
                    },
                  },
                });
              }}
            />

            <ColorPicker
              label="Body Color"
              value={slide.style.text.bodyColor || slide.style.text.color}
              onChange={(color) =>
                onUpdateSlide({
                  style: {
                    ...slide.style,
                    text: { ...slide.style.text, bodyColor: color },
                  },
                })
              }
            />

            <div>
              <Label>Alignment</Label>
              <Select
                value={slide.style.text.alignment}
                onValueChange={(value: any) =>
                  onUpdateSlide({
                    style: {
                      ...slide.style,
                      text: { ...slide.style.text, alignment: value },
                    },
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Text Transform</Label>
              <Select
                value={slide.style.text.textTransform || "none"}
                onValueChange={(value: any) =>
                  onUpdateSlide({
                    style: {
                      ...slide.style,
                      text: { ...slide.style.text, textTransform: value },
                    },
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="uppercase">UPPERCASE</SelectItem>
                  <SelectItem value="lowercase">lowercase</SelectItem>
                  <SelectItem value="capitalize">Capitalize</SelectItem>
                </SelectContent>
            </Select>
          </div>

          <div className="text-xs text-muted-foreground bg-blue-500/10 border border-blue-500/20 rounded p-3">
            <p className="font-medium mb-1">💡 Цвет отдельных слов:</p>
            <p>Используйте <code className="bg-background/50 px-1 rounded">[#FF0000]текст[]</code></p>
            <p className="mt-1 text-[10px]">Пример: <code className="bg-background/50 px-1 rounded">Привет [#FF0000]красный[] мир</code></p>
          </div>

          <Separator className="my-4" />
            
            <div>
              <Label>Shadow Intensity: {slide.style.text.shadowIntensity || 10}</Label>
              <Slider
                value={[slide.style.text.shadowIntensity || 10]}
                onValueChange={([value]) =>
                  onUpdateSlide({
                    style: {
                      ...slide.style,
                      text: { ...slide.style.text, shadowIntensity: value },
                    },
                  })
                }
                min={0}
                max={20}
                step={1}
              />
            </div>


            <Button 
              variant="outline" 
              className="w-full" 
              onClick={handleApplyStyleToAll}
            >
              Apply All Styles to All Slides
            </Button>
          </TabsContent>

          <TabsContent value="position" className="space-y-4 mt-0">
            <div className="flex items-center justify-between">
              <Label>Enable Text Box Positioning</Label>
              <Switch
                checked={showTextBoxControls}
                onCheckedChange={onToggleTextBoxControls}
              />
            </div>
            
            {showTextBoxControls && slide?.style.text.position && (
              <>
                <div className="text-xs text-muted-foreground bg-blue-500/10 border border-blue-500/20 rounded p-3">
                  <p className="font-medium mb-1">How to use:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Drag the blue box on the preview to move text</li>
                    <li>Drag the corner handle to resize</li>
                    <li>Click "Apply to All" to use same position everywhere</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <Label>Position (X: {slide.style.text.position.x.toFixed(0)}%, Y: {slide.style.text.position.y.toFixed(0)}%)</Label>
                  <Label>Size (W: {slide.style.text.position.width.toFixed(0)}%, H: {slide.style.text.position.height.toFixed(0)}%)</Label>
                </div>
              </>
            )}

            <Separator className="my-4" />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{lang === 'ru' ? 'Перетаскивание текста' : 'Drag & Drop Text'}</Label>
                {onTogglePositionEditor && (
                  <Switch
                    checked={showPositionEditor}
                    onCheckedChange={onTogglePositionEditor}
                  />
                )}
              </div>
              
              {showPositionEditor && (
                <div className="text-xs text-muted-foreground bg-primary/10 border border-primary/20 rounded p-3">
                  <p className="font-medium mb-1">{lang === 'ru' ? 'Как использовать:' : 'How to use:'}</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>{lang === 'ru' ? 'Перетаскивайте текст на превью' : 'Drag text on preview to move'}</li>
                    <li>{lang === 'ru' ? 'Используйте кнопки Center для выравнивания' : 'Use Center buttons to align text'}</li>
                    <li>{lang === 'ru' ? 'Блоки с одинаковым delay появятся одновременно' : 'Blocks with same delay appear simultaneously'}</li>
                  </ul>
                </div>
              )}
            </div>

            {showTextBoxControls && (
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={handleApplyStyleToAll}
              >
                Apply All Styles to All Slides
              </Button>
            )}
          </TabsContent>

          <TabsContent value="plate" className="space-y-4 mt-0">
            <div className="flex items-center justify-between">
              <Label>Enable Background Plate</Label>
              <Switch
                checked={slide.style.plate.enabled}
                onCheckedChange={(checked) =>
                  onUpdateSlide({
                    style: {
                      ...slide.style,
                      plate: { ...slide.style.plate, enabled: checked },
                    },
                  })
                }
              />
            </div>

            {slide.style.plate.enabled ? (
              <>
                <div>
                  <Label>Padding: {slide.style.plate.padding}px</Label>
                  <Slider
                    value={[slide.style.plate.padding]}
                    onValueChange={([value]) =>
                      onUpdateSlide({
                        style: {
                          ...slide.style,
                          plate: { ...slide.style.plate, padding: value },
                        },
                      })
                    }
                    min={0}
                    max={64}
                    step={4}
                  />
                </div>

                <div>
                  <Label>Border Radius: {slide.style.plate.borderRadius}px</Label>
                  <Slider
                    value={[slide.style.plate.borderRadius]}
                    onValueChange={([value]) =>
                      onUpdateSlide({
                        style: {
                          ...slide.style,
                          plate: { ...slide.style.plate, borderRadius: value },
                        },
                      })
                    }
                    min={0}
                    max={32}
                    step={2}
                  />
                </div>

                <div>
                  <Label>Opacity: {slide.style.plate.opacity}</Label>
                  <Slider
                    value={[slide.style.plate.opacity]}
                    onValueChange={([value]) =>
                      onUpdateSlide({
                        style: {
                          ...slide.style,
                          plate: { ...slide.style.plate, opacity: value },
                        },
                      })
                    }
                    min={0}
                    max={1}
                    step={0.05}
                  />
                </div>

                <div>
                  <Label>Background Color</Label>
                  <Input
                    type="color"
                    value={slide.style.plate.backgroundColor}
                    onChange={(e) =>
                      onUpdateSlide({
                        style: {
                          ...slide.style,
                          plate: { ...slide.style.plate, backgroundColor: e.target.value },
                        },
                      })
                    }
                  />
                </div>

            <div>
              <Label>Edge Blur: {slide.style.plate.blurSize || 30}px</Label>
              <Slider
                value={[slide.style.plate.blurSize || 30]}
                onValueChange={([value]) =>
                  onUpdateSlide({
                    style: {
                      ...slide.style,
                      plate: { ...slide.style.plate, blurSize: value },
                    },
                  })
                }
                min={0}
                max={100}
                step={5}
              />
              <div className="text-xs text-muted-foreground mt-1">
                Amount of blur on plate edges
              </div>
            </div>
              </>
            ) : (
              <>
                <div>
                  <Label>Shadow Intensity: {slide.style.text.shadowIntensity || 10}</Label>
                  <Slider
                    value={[slide.style.text.shadowIntensity || 10]}
                    onValueChange={([value]) =>
                      onUpdateSlide({
                        style: {
                          ...slide.style,
                          text: { ...slide.style.text, shadowIntensity: value },
                        },
                      })
                    }
                    min={0}
                    max={20}
                    step={1}
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    Насыщенность тени (темнота)
                  </div>
                </div>

                <div>
                  <Label>Shadow Radius: {slide.style.text.shadowRadius || 20}px</Label>
                  <Slider
                    value={[slide.style.text.shadowRadius || 20]}
                    onValueChange={([value]) =>
                      onUpdateSlide({
                        style: {
                          ...slide.style,
                          text: { ...slide.style.text, shadowRadius: value },
                        },
                      })
                    }
                    min={0}
                    max={100}
                    step={5}
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    Расстояние свечения от текста
                  </div>
                </div>
              </>
            )}

            <Button 
              variant="outline" 
              className="w-full mt-4" 
              onClick={handleApplyStyleToAll}
            >
              Apply All Styles to All Slides
            </Button>
          </TabsContent>

          <TabsContent value="global" className="space-y-4 mt-0">
            <MusicUploadSimple lang={lang} />

            <div className="pt-4 border-t">
              <Label>Video Overlay Dimming: {globalOverlay}%</Label>
              <Slider
                value={[globalOverlay]}
                onValueChange={([value]) => onUpdateGlobalOverlay(value)}
                min={0}
                max={70}
                step={5}
              />
            </div>

            <Separator />

            {/* Transition */}
            <div className="space-y-4">
              <TransitionPicker
                value={slide.transition || "none"}
                onChange={(value: TransitionType) =>
                  onUpdateSlide({ transition: value })
                }
                onApplyToAll={() => {
                  slides.forEach(s => {
                    if (s.id !== slide.id) {
                      updateSlide(s.id, { ...s, transition: slide.transition });
                    }
                  });
                  toast.success("Transition applied to all slides");
                }}
              />
            </div>

            <Separator />

            <div>
              <Label>Slide Duration: {slide.durationSec}s</Label>
              <Slider
                value={[slide.durationSec]}
                onValueChange={([value]) =>
                  onUpdateSlide({ durationSec: value })
                }
                min={1}
                max={10}
                step={0.5}
              />
            </div>

            <Button 
              variant="outline" 
              className="w-full" 
              onClick={handleApplyDurationToAll}
            >
              Apply Duration to All Slides
            </Button>

            <Separator className="my-4" />

            <UnusedTextPreview slides={slides} lang={lang} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
