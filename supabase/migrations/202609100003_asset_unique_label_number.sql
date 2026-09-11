-- Global, immutable-friendly number for physical asset labels.
-- Numbers are unique across all categories and are not reused after deletion.

CREATE SEQUENCE IF NOT EXISTS public.asset_label_number_seq START WITH 1 INCREMENT BY 1;

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS label_number BIGINT;

DO $$
DECLARE
  current_max BIGINT;
  final_max BIGINT;
BEGIN
  SELECT COALESCE(MAX(label_number), 0) INTO current_max FROM public.assets;

  WITH missing_assets AS (
    SELECT
      id,
      ROW_NUMBER() OVER (ORDER BY created_at ASC NULLS LAST, asset_code ASC, id ASC) AS row_no
    FROM public.assets
    WHERE label_number IS NULL
  )
  UPDATE public.assets asset
  SET label_number = current_max + missing_assets.row_no
  FROM missing_assets
  WHERE asset.id = missing_assets.id;

  SELECT COALESCE(MAX(label_number), 0) INTO final_max FROM public.assets;
  IF final_max > 0 THEN
    PERFORM setval('public.asset_label_number_seq', final_max, true);
  ELSE
    PERFORM setval('public.asset_label_number_seq', 1, false);
  END IF;
END $$;

ALTER SEQUENCE public.asset_label_number_seq OWNED BY public.assets.label_number;
ALTER TABLE public.assets
  ALTER COLUMN label_number SET DEFAULT nextval('public.asset_label_number_seq'),
  ALTER COLUMN label_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_label_number
  ON public.assets(label_number);

