import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

const createQueryBuilder = (result = { data: [], error: null, count: 0 }) => {
  const builder = {
    ...result,
    select: () => createQueryBuilder(result),
    eq: () => createQueryBuilder(result),
    gt: () => createQueryBuilder(result),
    lt: () => createQueryBuilder(result),
    gte: () => createQueryBuilder(result),
    lte: () => createQueryBuilder(result),
    in: () => createQueryBuilder(result),
    order: () => createQueryBuilder(result),
    limit: () => createQueryBuilder(result),
    single: async () => ({ data: result.data?.[0] ?? null, error: null }),
    maybeSingle: async () => ({ data: result.data?.[0] ?? null, error: null }),
    then: (resolve) => Promise.resolve(result).then(resolve),
    catch: (reject) => Promise.resolve(result).catch(reject),
    finally: (onFinally) => Promise.resolve(result).finally(onFinally)
  };
  return builder;
};

const createSafeSupabase = () => {
  if (!hasSupabaseConfig) {
    return {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signInWithPassword: async () => ({ data: null, error: new Error('Supabase is not configured') }),
        signOut: async () => ({ error: null }),
        resetPasswordForEmail: async () => ({ error: null })
      },
      from: () => createQueryBuilder({ data: [], error: null, count: 0 }),
      channel: () => ({
        on: () => this,
        subscribe: async () => ({})
      }),
      removeChannel: () => {}
    };
  }

  return createClient(supabaseUrl, supabaseAnonKey);
};

export const supabase = createSafeSupabase();