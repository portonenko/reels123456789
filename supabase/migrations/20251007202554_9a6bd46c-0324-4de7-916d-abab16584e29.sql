-- Create storage bucket for video assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'video-assets',
  'video-assets',
  true,
  524288000, -- 500MB limit
  ARRAY['video/mp4', 'video/webm', 'video/quicktime']
);

-- Create storage bucket for music tracks
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'music-tracks',
  'music-tracks',
  true,
  52428800, -- 50MB limit
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg']
);

-- RLS policies for video-assets bucket
CREATE POLICY "Users can view their own video assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'video-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own video assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'video-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own video assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'video-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS policies for music-tracks bucket
CREATE POLICY "Users can view their own music tracks"
ON storage.objects FOR SELECT
USING (bucket_id = 'music-tracks' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own music tracks"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'music-tracks' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own music tracks"
ON storage.objects FOR DELETE
USING (bucket_id = 'music-tracks' AND auth.uid()::text = (storage.foldername(name))[1]);