-- Add category column to assets table
ALTER TABLE public.assets 
ADD COLUMN category TEXT DEFAULT 'default';

-- Create index for faster category filtering
CREATE INDEX idx_assets_category ON public.assets(category);

-- Update existing assets to have a default category
UPDATE public.assets SET category = 'default' WHERE category IS NULL;