DROP POLICY IF EXISTS "Anyone can view channels" ON public.whatsapp_channels;
DROP POLICY IF EXISTS "Anyone can insert channels" ON public.whatsapp_channels;
DROP POLICY IF EXISTS "Anyone can update channels" ON public.whatsapp_channels;
DROP POLICY IF EXISTS "Anyone can delete channels" ON public.whatsapp_channels;

CREATE POLICY "channels owned by authenticated user" ON public.whatsapp_channels
  FOR ALL TO authenticated
  USING (lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  WITH CHECK (lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

DROP POLICY IF EXISTS "Anyone can view contacts" ON public.contacts;
DROP POLICY IF EXISTS "Anyone can insert contacts" ON public.contacts;
DROP POLICY IF EXISTS "Anyone can update contacts" ON public.contacts;
DROP POLICY IF EXISTS "Anyone can delete contacts" ON public.contacts;

CREATE POLICY "contacts owned by authenticated user" ON public.contacts
  FOR ALL TO authenticated
  USING (lower(created_by_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  WITH CHECK (lower(created_by_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

DROP POLICY IF EXISTS "Anyone can view tags" ON public.tags;
DROP POLICY IF EXISTS "Anyone can insert tags" ON public.tags;
DROP POLICY IF EXISTS "Anyone can update tags" ON public.tags;
DROP POLICY IF EXISTS "Anyone can delete tags" ON public.tags;

CREATE POLICY "tags owned by authenticated user" ON public.tags
  FOR ALL TO authenticated
  USING (lower(created_by_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  WITH CHECK (lower(created_by_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

DROP POLICY IF EXISTS "Anyone can view contact_tags" ON public.contact_tags;
DROP POLICY IF EXISTS "Anyone can insert contact_tags" ON public.contact_tags;
DROP POLICY IF EXISTS "Anyone can delete contact_tags" ON public.contact_tags;

CREATE POLICY "contact tags owned by authenticated user" ON public.contact_tags
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.contacts c
      WHERE c.id = public.contact_tags.contact_id
        AND lower(c.created_by_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.contacts c
      WHERE c.id = public.contact_tags.contact_id
        AND lower(c.created_by_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
    AND EXISTS (
      SELECT 1
      FROM public.tags t
      WHERE t.id = public.contact_tags.tag_id
        AND lower(t.created_by_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

DROP POLICY IF EXISTS "Anyone can view session_tags" ON public.session_tags;
DROP POLICY IF EXISTS "Anyone can insert session_tags" ON public.session_tags;
DROP POLICY IF EXISTS "Anyone can delete session_tags" ON public.session_tags;

CREATE POLICY "session tags owned by authenticated user" ON public.session_tags
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tags t
      WHERE t.id = public.session_tags.tag_id
        AND lower(t.created_by_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tags t
      WHERE t.id = public.session_tags.tag_id
        AND lower(t.created_by_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

DROP POLICY IF EXISTS "Anyone can view tabulations" ON public.tabulations;
DROP POLICY IF EXISTS "Anyone can insert tabulations" ON public.tabulations;
DROP POLICY IF EXISTS "Anyone can update tabulations" ON public.tabulations;
DROP POLICY IF EXISTS "Anyone can delete tabulations" ON public.tabulations;

CREATE POLICY "tabulations owned by authenticated user" ON public.tabulations
  FOR ALL TO authenticated
  USING (
    lower(created_by_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    OR EXISTS (
      SELECT 1
      FROM public.whatsapp_channels ch
      WHERE ch.id = public.tabulations.channel_id
        AND lower(ch.user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
  WITH CHECK (
    lower(created_by_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND EXISTS (
      SELECT 1
      FROM public.whatsapp_channels ch
      WHERE ch.id = public.tabulations.channel_id
        AND lower(ch.user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );
