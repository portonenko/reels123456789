-- Create presets table for saving slide configurations
CREATE TABLE public.presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  title_slide_duration NUMERIC NOT NULL DEFAULT 2,
  other_slides_duration NUMERIC NOT NULL DEFAULT 3,
  style JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.presets ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own presets" 
ON public.presets 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own presets" 
ON public.presets 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own presets" 
ON public.presets 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own presets" 
ON public.presets 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_presets_updated_at
BEFORE UPDATE ON public.presets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();