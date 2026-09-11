-- Operational asset kept as a ready-to-use backup.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.asset_statuses WHERE status_name = 'Cadangan/Backup'
  ) THEN
    UPDATE public.asset_statuses
    SET display_order = display_order + 1
    WHERE display_order >= 2;

    INSERT INTO public.asset_statuses (
      status_name,
      description,
      is_operational,
      display_order,
      icon_name,
      is_active
    ) VALUES (
      'Cadangan/Backup',
      'Aset operasional yang disimpan sebagai cadangan dan siap digunakan saat diperlukan',
      true,
      2,
      'archive',
      true
    );
  ELSE
    UPDATE public.asset_statuses
    SET
      description = 'Aset operasional yang disimpan sebagai cadangan dan siap digunakan saat diperlukan',
      is_operational = true,
      is_active = true,
      icon_name = 'archive'
    WHERE status_name = 'Cadangan/Backup';
  END IF;
END $$;
