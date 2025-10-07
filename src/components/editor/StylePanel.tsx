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
import { MusicUpload } from "./MusicUpload";

interface StylePanelProps {
  slide: Slide | null;
  globalOverlay: number;
  onUpdateSlide: (updates: Partial<Slide>) => void;
  onUpdateGlobalOverlay: (value: number) => void;
  showTextBoxControls: boolean;
  onToggleTextBoxControls: (show: boolean) => void;
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
  lang = 'en',
}: StylePanelProps) => {
  const { applyStyleToAll, applyDurationToAll, slides, updateSlide } = useEditorStore();

  const handleApplyStyleToAll = () => {
    if (!slide) return;
    applyStyleToAll(slide.id);
    toast.success(`Applied style to all ${slides.length} slides`);
  };

  const handleApplyDurationToAll = () => {
    if (!slide) return;
    applyDurationToAll(slide.durationSec);
    toast.success(`Applied ${slide.durationSec}s duration to all ${slides.length} slides`);
  };

  const handleApplyPlateToAll = () => {
    if (!slide) return;
    slides.forEach((s) => {
      if (s.id !== slide.id) {
        updateSlide(s.id, {
          style: {
            ...s.style,
            plate: { ...slide.style.plate },
          },
        });
      }
    });
    toast.success(`Applied plate style to all ${slides.length} slides`);
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
        <TabsList className="grid w-full grid-cols-5 bg-secondary">
          <TabsTrigger value="text">Text</TabsTrigger>
          <TabsTrigger value="position">Position</TabsTrigger>
          <TabsTrigger value="plate">Plate</TabsTrigger>
          <TabsTrigger value="shadow">Shadow</TabsTrigger>
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

            <div>
              <Label>Color</Label>
              <Input
                type="color"
                value={slide.style.text.color}
                onChange={(e) =>
                  onUpdateSlide({
                    style: {
                      ...slide.style,
                      text: { ...slide.style.text, color: e.target.value },
                    },
                  })
                }
              />
            </div>

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

            <Button 
              variant="outline" 
              className="w-full" 
              onClick={handleApplyStyleToAll}
            >
              Apply Text Style to All Slides
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

            {showTextBoxControls && (
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={handleApplyStyleToAll}
              >
                Apply Position to All Slides
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
              </>
            ) : (
              <>
                <div>
                  <Label>Text Outline Color</Label>
                  <Input
                    type="color"
                    value={slide.style.text.stroke || "#000000"}
                    onChange={(e) =>
                      onUpdateSlide({
                        style: {
                          ...slide.style,
                          text: { ...slide.style.text, stroke: e.target.value },
                        },
                      })
                    }
                  />
                </div>

                <div>
                  <Label>Outline Width: {slide.style.text.strokeWidth || 2}px</Label>
                  <Slider
                    value={[slide.style.text.strokeWidth || 2]}
                    onValueChange={([value]) =>
                      onUpdateSlide({
                        style: {
                          ...slide.style,
                          text: { ...slide.style.text, strokeWidth: value },
                        },
                      })
                    }
                    min={0}
                    max={8}
                    step={1}
                  />
                </div>

                <div>
                  <Label>Enhanced Text Shadow</Label>
                  <Input
                    value={slide.style.text.textShadow}
                    onChange={(e) =>
                      onUpdateSlide({
                        style: {
                          ...slide.style,
                          text: { ...slide.style.text, textShadow: e.target.value },
                        },
                      })
                    }
                    placeholder="0 4px 12px rgba(0,0,0,0.8)"
                  />
                </div>

                <div>
                  <Label>Glow Color</Label>
                  <Input
                    type="color"
                    value={slide.style.text.glow?.startsWith("rgba") ? "#FFFFFF" : slide.style.text.glow || "#FFFFFF"}
                    onChange={(e) =>
                      onUpdateSlide({
                        style: {
                          ...slide.style,
                          text: { ...slide.style.text, glow: e.target.value },
                        },
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Soft glow effect around text
                  </p>
                </div>
              </>
            )}

            <Button 
              variant="outline" 
              className="w-full mt-4" 
              onClick={handleApplyPlateToAll}
            >
              Apply Plate Style to All Slides
            </Button>
          </TabsContent>

          <TabsContent value="shadow" className="space-y-4 mt-0">
            <div>
              <Label>Text Shadow</Label>
              <Input
                value={slide.style.text.textShadow}
                onChange={(e) =>
                  onUpdateSlide({
                    style: {
                      ...slide.style,
                      text: { ...slide.style.text, textShadow: e.target.value },
                    },
                  })
                }
                placeholder="0 2px 8px rgba(0,0,0,0.5)"
              />
            </div>

            <Button 
              variant="outline" 
              className="w-full" 
              onClick={handleApplyStyleToAll}
            >
              Apply Shadow & Effects to All Slides
            </Button>
          </TabsContent>

          <TabsContent value="global" className="space-y-4 mt-0">
            <MusicUpload lang={lang} />

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
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
