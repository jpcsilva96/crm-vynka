
CREATE TABLE public.tabulations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID REFERENCES public.whatsapp_channels(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_by_email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tabulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tabulations" ON public.tabulations FOR SELECT USING (true);
CREATE POLICY "Anyone can insert tabulations" ON public.tabulations FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update tabulations" ON public.tabulations FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete tabulations" ON public.tabulations FOR DELETE USING (true);
