import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type TransitionType = "none" | "fade" | "flash" | "glow" | "slide-left" | "slide-right";

interface TransitionPickerProps {
  value: TransitionType;
  onChange: (value: TransitionType) => void;
}

export const TransitionPicker = ({ value, onChange }: TransitionPickerProps) => {
  return (
    <div className="space-y-2">
      <Label>Slide Transition</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None</SelectItem>
          <SelectItem value="fade">Fade</SelectItem>
          <SelectItem value="flash">Flash</SelectItem>
          <SelectItem value="glow">Glow Effect</SelectItem>
          <SelectItem value="slide-left">Slide Left</SelectItem>
          <SelectItem value="slide-right">Slide Right</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
