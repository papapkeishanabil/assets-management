import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8'
import { createAdminUserHandler } from './handler.js'

Deno.serve(createAdminUserHandler({ createClient, env: (key: string) => Deno.env.get(key) }))
