
-- Add enhanced fingerprint columns to device_logs
ALTER TABLE public.device_logs 
  ADD COLUMN IF NOT EXISTS canvas_hash text,
  ADD COLUMN IF NOT EXISTS webgl_hash text,
  ADD COLUMN IF NOT EXISTS audio_hash text,
  ADD COLUMN IF NOT EXISTS screen_info text,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS fonts_hash text;

-- Create index for fast duplicate detection
CREATE INDEX IF NOT EXISTS idx_device_logs_fingerprint ON public.device_logs(fingerprint);
CREATE INDEX IF NOT EXISTS idx_device_logs_canvas_webgl ON public.device_logs(canvas_hash, webgl_hash);
CREATE INDEX IF NOT EXISTS idx_device_logs_ip ON public.device_logs(ip_address);
