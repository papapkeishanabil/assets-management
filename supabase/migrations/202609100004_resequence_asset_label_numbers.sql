-- Rebuild global label numbers after assets were deleted and before labels are printed.
-- This intentionally changes existing label_number values, but never changes asset_code or qr_token.

CREATE SEQUENCE IF NOT EXISTS public.asset_label_number_seq START WITH 1 INCREMENT BY 1;

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS label_number BIGINT;

LOCK TABLE public.assets IN ACCESS EXCLUSIVE MODE;

ALTER TABLE public.assets
  ALTER COLUMN label_number DROP DEFAULT,
  ALTER COLUMN label_number DROP NOT NULL;

DROP INDEX IF EXISTS public.idx_assets_label_number;

WITH ordered_assets AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY created_at ASC NULLS LAST, asset_code ASC, id ASC) AS new_label_number
  FROM public.assets
)
UPDATE public.assets asset
SET label_number = ordered_assets.new_label_number
FROM ordered_assets
WHERE asset.id = ordered_assets.id;

DO $$
DECLARE
  final_max BIGINT;
BEGIN
  SELECT COALESCE(MAX(label_number), 0) INTO final_max FROM public.assets;
  IF final_max > 0 THEN
    PERFORM setval('public.asset_label_number_seq', final_max, true);
  ELSE
    PERFORM setval('public.asset_label_number_seq', 1, false);
  END IF;
END $$;

ALTER TABLE public.assets
  ALTER COLUMN label_number SET DEFAULT nextval('public.asset_label_number_seq'),
  ALTER COLUMN label_number SET NOT NULL;

ALTER SEQUENCE public.asset_label_number_seq OWNED BY public.assets.label_number;

CREATE UNIQUE INDEX idx_assets_label_number
  ON public.assets(label_number);
