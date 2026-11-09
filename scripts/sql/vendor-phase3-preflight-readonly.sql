-- SELECT saja; driver PostgreSQL memakai transaksi REPEATABLE READ READ ONLY.
SELECT jsonb_build_object(
 'functions',(SELECT jsonb_agg(jsonb_build_object(
   'name',p.proname,'signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),
   'source',p.prosrc,'definer',p.prosecdef,'config',p.proconfig,'owner',pg_get_userbyid(p.proowner),
   'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),
   'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),
   'service_execute',has_function_privilege('service_role',p.oid,'EXECUTE')) ORDER BY p.proname)
   FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname IN
   ('is_app_role','my_profile_id','profiles_guard_admin_fields','vendor_guard_restricted_columns',
    'vendor_record_activity','vendor_record_status_change','exec_sql','vendor_followups_guard',
    'vendor_followups_audit','vendor_sourcing_dashboard','vendor_remind_overdue_followups')),
 'policies',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY schemaname,tablename,policyname),'[]'::jsonb)
   FROM pg_policies p WHERE (schemaname='public' AND tablename IN
   ('vendors','assets','user_profiles','roles','notifications','vendor_candidates','vendor_contacts',
    'vendor_candidate_specialties','vendor_activity_logs','vendor_status_history','vendor_followups',
    'vendor_locations','vendor_location_photos')) OR (schemaname='storage' AND tablename IN ('objects','buckets'))),
 'rls',(SELECT jsonb_object_agg(n.nspname||'.'||c.relname,c.relrowsecurity)
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE
   (n.nspname='public' AND c.relname IN ('vendors','assets','user_profiles','roles','notifications',
    'vendor_candidates','vendor_contacts','vendor_candidate_specialties','vendor_activity_logs',
    'vendor_status_history','vendor_followups')) OR (n.nspname='storage' AND c.relname IN ('objects','buckets'))),
 'triggers',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,
   'name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) ORDER BY n.nspname,c.relname,t.tgname)
   FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE NOT t.tgisinternal AND ((n.nspname='public' AND c.relname IN
   ('user_profiles','vendor_candidates','vendor_followups')) OR (n.nspname='storage' AND c.relname IN ('objects','buckets')))),
 'columns',(SELECT jsonb_agg(jsonb_build_object('schema',table_schema,'table',table_name,
   'column',column_name,'type',data_type,'nullable',is_nullable) ORDER BY table_schema,table_name,ordinal_position)
   FROM information_schema.columns WHERE (table_schema='public' AND table_name IN
   ('vendors','vendor_candidates','vendor_contacts','vendor_activity_logs','user_profiles')) OR
   (table_schema='storage' AND table_name IN ('objects','buckets'))),
 'collisions',jsonb_build_object(
   'relations',(SELECT coalesce(jsonb_agg(c.relname ORDER BY c.relname),'[]'::jsonb) FROM pg_class c
     WHERE c.relnamespace='public'::regnamespace AND c.relname IN
     ('vendor_locations','vendor_location_photos','vendor_map_points','vendor_location_summary')),
   'functions',(SELECT coalesce(jsonb_agg(p.oid::regprocedure::text ORDER BY p.proname),'[]'::jsonb) FROM pg_proc p
     WHERE p.pronamespace='public'::regnamespace AND p.proname IN
     ('vendor_locations_guard','vendor_photos_guard','vendor_location_audit','vendor_set_primary_location',
      'vendor_set_cover_photo','vendor_link_existing_active','vendor_location_monitoring','vendor_photo_valid_path',
      'vendor_photo_can_remove','vendor_photo_reader','vendor_photo_upload_allowed')),
   'storage_policies',(SELECT coalesce(jsonb_agg(policyname ORDER BY policyname),'[]'::jsonb)
     FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'Vendor storage %'),
   'bucket',(SELECT count(*) FROM storage.buckets WHERE id='vendor-photos')),
 'buckets',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',b.id,'public',b.public,
   'file_size_limit',b.file_size_limit,'allowed_mime_types',b.allowed_mime_types,
   'objects',(SELECT count(*) FROM storage.objects o WHERE o.bucket_id=b.id),
   'bytes',(SELECT coalesce(sum((o.metadata->>'size')::bigint),0) FROM storage.objects o WHERE o.bucket_id=b.id)) ORDER BY b.id),'[]'::jsonb)
   FROM storage.buckets b),
 'storage_service_acl',jsonb_build_object(
   'select',has_table_privilege('service_role','storage.objects','SELECT'),
   'insert',has_table_privilege('service_role','storage.objects','INSERT'),
   'delete',has_table_privilege('service_role','storage.objects','DELETE'),
   'bypass_rls',(SELECT rolbypassrls FROM pg_roles WHERE rolname='service_role')),
 'roles',(SELECT jsonb_agg(role_name ORDER BY role_name) FROM public.roles),
 'permissions',(SELECT jsonb_agg(jsonb_build_object('role',r.role_name,'module',p.module_key,'access',p.can_access)
   ORDER BY r.role_name,p.module_key) FROM public.role_permissions p JOIN public.roles r ON r.id=p.role_id WHERE p.module_key LIKE 'vendor%'),
 'baseline',(SELECT jsonb_object_agg(name,jsonb_build_object('count',n,'checksum',checksum)) FROM (
   SELECT 'vendors' name,count(*) n,md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) checksum FROM public.vendors x
   UNION ALL SELECT 'assets',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.assets x
   UNION ALL SELECT 'user_profiles',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.user_profiles x
   UNION ALL SELECT 'roles',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.roles x
   UNION ALL SELECT 'role_permissions',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.role_permissions x
   UNION ALL SELECT 'notifications',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.notifications x
   UNION ALL SELECT 'employees',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.employees x
   UNION ALL SELECT 'contracts',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.contracts x
   UNION ALL SELECT 'vendor_candidates',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.vendor_candidates x
   UNION ALL SELECT 'vendor_followups',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.vendor_followups x
   UNION ALL SELECT 'vendor_categories',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.vendor_categories x
   UNION ALL SELECT 'vendor_specialties',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.vendor_specialties x
   UNION ALL SELECT 'vendor_contacts',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.vendor_contacts x
   UNION ALL SELECT 'vendor_candidate_specialties',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY candidate_id,specialty_id)::text,'')) FROM public.vendor_candidate_specialties x
   UNION ALL SELECT 'vendor_activity_logs',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.vendor_activity_logs x
   UNION ALL SELECT 'vendor_status_history',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.vendor_status_history x
   UNION ALL SELECT 'auth.users',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM auth.users x
 ) q),
 'asset_vendor_links',(SELECT count(*) FROM public.assets WHERE vendor_id IS NOT NULL),
 'asset_vendor_orphans',(SELECT count(*) FROM public.assets a LEFT JOIN public.vendors v ON v.id=a.vendor_id WHERE a.vendor_id IS NOT NULL AND v.id IS NULL)
)
