import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8'
import { createOfissioCatalogHandler } from './handler.js'

Deno.serve(createOfissioCatalogHandler({ createClient, env: (key: string) => Deno.env.get(key) }))
