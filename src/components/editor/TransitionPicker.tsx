import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export type TransitionType = "none" | "fade" | "flash" | "glow" | "slide-left" | "slide-right" | "sunlight";

interface TransitionPickerProps {
  value: TransitionType;
  onChange: (value: TransitionType) => void;
  onApplyToAll?: () => void;
}

export const TransitionPicker = ({ value, onChange, onApplyToAll }: TransitionPickerProps) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Slide Transition</Label>
        {onApplyToAll && (
          <Button variant="ghost" size="sm" onClick={onApplyToAll}>
            Apply to All
          </Button>
        )}
      </div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None</SelectItem>
          <SelectItem value="fade">Fade</SelectItem>
          <SelectItem value="flash">Flash</SelectItem>
          <SelectItem value="glow">Glow Effect</SelectItem>
          <SelectItem value="sunlight">Sunlight Flash</SelectItem>
          <SelectItem value="slide-left">Slide Left</SelectItem>
          <SelectItem value="slide-right">Slide Right</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
