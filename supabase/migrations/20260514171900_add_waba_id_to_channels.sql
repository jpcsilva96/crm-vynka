-- Add waba_id column to whatsapp_channels for Meta template lookups
ALTER TABLE public.whatsapp_channels ADD COLUMN waba_id TEXT NOT NULL DEFAULT '';
