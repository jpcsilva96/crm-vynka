
-- Contacts table
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  area TEXT NOT NULL DEFAULT '',
  ddd TEXT NOT NULL DEFAULT '',
  mobile TEXT NOT NULL DEFAULT '',
  created_by_email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view contacts" ON public.contacts FOR SELECT USING (true);
CREATE POLICY "Anyone can insert contacts" ON public.contacts FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update contacts" ON public.contacts FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete contacts" ON public.contacts FOR DELETE USING (true);

-- Tags table
CREATE TABLE public.tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#FF3A5E',
  created_by_email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tags" ON public.tags FOR SELECT USING (true);
CREATE POLICY "Anyone can insert tags" ON public.tags FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update tags" ON public.tags FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete tags" ON public.tags FOR DELETE USING (true);

-- Contact-Tags junction
CREATE TABLE public.contact_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(contact_id, tag_id)
);

ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view contact_tags" ON public.contact_tags FOR SELECT USING (true);
CREATE POLICY "Anyone can insert contact_tags" ON public.contact_tags FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete contact_tags" ON public.contact_tags FOR DELETE USING (true);

-- Session-Tags junction
CREATE TABLE public.session_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(session_id, tag_id)
);

ALTER TABLE public.session_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view session_tags" ON public.session_tags FOR SELECT USING (true);
CREATE POLICY "Anyone can insert session_tags" ON public.session_tags FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete session_tags" ON public.session_tags FOR DELETE USING (true);

-- Update trigger for contacts
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_contacts_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
