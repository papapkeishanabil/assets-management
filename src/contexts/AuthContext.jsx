import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { ROLES } from '../lib/constants';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const initialLoadDone = useRef(false);

  const fetchProfile = useCallback(async (authUser) => {
    if (!authUser) {
      setProfile(null);
      setRole(null);
      return { profile: null, role: null };
    }
    
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('auth_user_id', authUser.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        const { data: roleData } = await supabase
          .from('roles')
          .select('id')
          .eq('role_name', ROLES.PELAKSANA)
          .single();

        const { data: newProfile, error: insertError } = await supabase
          .from('user_profiles')
          .insert([{
            auth_user_id: authUser.id,
            full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
            email: authUser.email || '',
            phone: '',
            department: '',
            position: '',
            role_id: roleData?.id || null,
            account_status: 'PENDING'
          }])
          .select('*')
          .single();

        if (insertError) {
          console.error('Error creating profile:', insertError);
          setProfile(null);
          setRole(null);
          return { profile: null, role: null };
        }

        setProfile(newProfile);
        let roleResult = null;
        if (newProfile?.role_id) {
          const { data: rd } = await supabase
            .from('roles')
            .select('*')
            .eq('id', newProfile.role_id)
            .single();
          roleResult = rd || null;
          setRole(roleResult);
        } else {
          setRole(null);
        }
        return { profile: newProfile, role: roleResult };
      } else {
        console.error('Error fetching profile:', error);
        setProfile(null);
        setRole(null);
        return { profile: null, role: null };
      }
    } else {
      setProfile(data);
      let roleResult = null;
      if (data?.role_id) {
        const { data: rd } = await supabase
          .from('roles')
          .select('*')
          .eq('id', data.role_id)
          .single();
        roleResult = rd || null;
        setRole(roleResult);
      } else {
        setRole(null);
      }
      return { profile: data, role: roleResult };
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      
      const authUser = session?.user ?? null;
      setUser(authUser);
      
      if (authUser) {
        await fetchProfile(authUser);
      }
      
      if (mounted) {
        initialLoadDone.current = true;
        setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const authUser = session?.user ?? null;
        setUser(authUser);
        
        if (event === 'SIGNED_IN' && authUser) {
          await fetchProfile(authUser);
          if (mounted) setLoading(false);
        } else if (event === 'SIGNED_OUT') {
          setProfile(null);
          setRole(null);
          if (mounted) setLoading(false);
        } else if (event === 'USER_UPDATED' && authUser) {
          await fetchProfile(authUser);
        } else if (event === 'TOKEN_REFRESHED' && authUser) {
          await fetchProfile(authUser);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const login = async (email, password) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) {
      setLoading(false);
      throw error;
    }
    // Profile will be loaded by onAuthStateChange
    return data;
  };

  const register = async (userData) => {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: {
          full_name: userData.full_name
        }
      }
    });
    if (authError) throw authError;

    if (authData.user) {
      const { data: roleData } = await supabase
        .from('roles')
        .select('id')
        .eq('role_name', ROLES.PELAKSANA)
        .single();

      const { error: profileError } = await supabase.from('user_profiles').insert([{
        auth_user_id: authData.user.id,
        full_name: userData.full_name,
        email: userData.email,
        phone: userData.phone || '',
        department: userData.department || '',
        position: userData.position || '',
        role_id: roleData?.id || null,
        account_status: 'PENDING'
      }]);
      if (profileError) throw profileError;
    }

    return authData;
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setProfile(null);
    setRole(null);
  };

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    if (error) throw error;
  };

  const updateProfile = async (updates) => {
    if (!profile?.id) throw new Error('Profile not found');
    
    const { data, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', profile.id)
      .select('*')
      .single();

    if (error) throw error;
    setProfile(data);
    if (data?.role_id) {
      const { data: roleData } = await supabase
        .from('roles')
        .select('*')
        .eq('id', data.role_id)
        .single();
      setRole(roleData || null);
    } else {
      setRole(null);
    }
    return data;
  };

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    await fetchProfile(user);
  }, [user, fetchProfile]);

  const value = {
    user,
    profile,
    role,
    loading,
    login,
    register,
    logout,
    resetPassword,
    updateProfile,
    refreshProfile,
    fetchProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}