import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface StepProcessingProps {
  isProcessing: boolean;
  progress: number;
  message: string;
}

export const StepProcessing = ({
  isProcessing,
  progress,
  message,
}: StepProcessingProps) => {
  const isComplete = progress === 100 && !isProcessing;
  const isError = message.toLowerCase().startsWith("error");

  return (
    <div className="max-w-md mx-auto py-12">
      <div className="text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          {isProcessing ? (
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
          ) : isError ? (
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-destructive" />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className="text-xl font-semibold">
          {isProcessing 
            ? "Generating Content..." 
            : isError 
              ? "Processing Failed"
              : "Processing Complete!"}
        </h3>

        {/* Progress */}
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground">{progress}%</p>
        </div>

        {/* Status message */}
        <p className={`text-sm ${isError ? 'text-destructive' : 'text-muted-foreground'}`}>
          {message}
        </p>

        {/* Processing tips */}
        {isProcessing && (
          <div className="mt-8 text-left bg-muted/50 rounded-lg p-4">
            <p className="text-sm font-medium mb-2">What's happening:</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Translating content to selected languages</li>
              <li>• Applying ENERGIA → language-specific rules</li>
              <li>• Assigning random background assets</li>
              <li>• Attaching music tracks to videos</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
