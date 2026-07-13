-- Public/private account setting. Private accounts require the owner to
-- accept a follow request (status stays 'pending' until they approve);
-- public accounts (the default) keep the existing instant-accept behavior.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;
