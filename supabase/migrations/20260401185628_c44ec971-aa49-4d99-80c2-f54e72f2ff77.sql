
CREATE TABLE public.whatsapp_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  token TEXT NOT NULL,
  instance TEXT NOT NULL,
  robot_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view channels" ON public.whatsapp_channels FOR SELECT USING (true);
CREATE POLICY "Anyone can insert channels" ON public.whatsapp_channels FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update channels" ON public.whatsapp_channels FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete channels" ON public.whatsapp_channels FOR DELETE USING (true);
