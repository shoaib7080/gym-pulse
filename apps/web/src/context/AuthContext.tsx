import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  emailVerified?: boolean;
  image?: string | null;
}

export interface GymDetails {
  id: string;
  legalName: string;
  tradeName: string;
  tradeLicenseNumber: string;
  vatRegistered: boolean;
  trnNumber: string | null;
  timezone: string;
  currency: string;
  status: 'pending_verification' | 'active' | 'suspended' | 'closed' | 'rejected';
  settings?: Record<string, unknown>;
  branches?: Array<{
    id: string;
    name: string;
    code: string;
    address?: string;
    city?: string;
    isMain: boolean;
  }>;
  yourRole?: 'owner' | 'manager' | 'front_desk';
  yourBranchScope?: 'all' | 'selected';
}

export interface UserGymAssignment {
  gymId: string;
  role: 'owner' | 'manager' | 'front_desk';
  branchScope: 'all' | 'selected';
  gym: GymDetails;
}

export interface CreateGymPayload {
  legalName: string;
  tradeName: string;
  tradeLicenseNumber: string;
  vatRegistered?: boolean;
  trnNumber?: string | null;
  currency?: string;
  timezone?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isGymsLoading: boolean;
  userGyms: UserGymAssignment[];
  activeGymId: string | null;
  activeGym: GymDetails | null;
  userRole: 'owner' | 'manager' | 'front_desk' | null;
  branchScope: 'all' | 'selected' | null;
  setActiveGymId: (gymId: string) => void;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshGyms: () => Promise<void>;
  fetchGyms: () => Promise<void>;
  createGym: (data: CreateGymPayload) => Promise<{ success: boolean; gymId?: string; error?: string }>;
  resubmitGym: (gymId: string) => Promise<{ success: boolean; error?: string }>;
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'gympulse_auth_token';
const USER_KEY = 'gympulse_user';
const ACTIVE_GYM_KEY = 'gympulse_active_gym_id';
const USER_GYMS_KEY = 'gympulse_user_gyms';
const ACTIVE_NAV_KEY = 'gympulse_active_nav';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  });

  const [activeGymId, setActiveGymIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ACTIVE_GYM_KEY);
    } catch {
      return null;
    }
  });

  const [userGyms, setUserGyms] = useState<UserGymAssignment[]>(() => {
    try {
      const stored = localStorage.getItem(USER_GYMS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isGymsLoading, setIsGymsLoading] = useState(true);

  // Authenticated fetch helper respecting multi-tenant headers, CSRF origins, and cookies
  const apiFetch = useCallback(
    async (path: string, options: RequestInit = {}): Promise<Response> => {
      const headers = new Headers(options.headers || {});

      // Add JSON content-type if sending body and not already specified
      if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }

      // Dual token authentication support: cookie (credentials: include) + Bearer header
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      // Mandatory multi-tenant context header for TenantGuard
      if (activeGymId && !headers.has('x-gym-id')) {
        headers.set('x-gym-id', activeGymId);
      }

      // Automatically generate Idempotency-Key for mutating financial requests if not provided
      const method = (options.method || 'GET').toUpperCase();
      const isMutating = ['POST', 'PUT', 'PATCH'].includes(method);
      const isFinancialOrCritical =
        path.includes('/sales/') ||
        path.includes('/payments/') ||
        path.includes('/freezes') ||
        path.includes('/shifts/');

      if (isMutating && isFinancialOrCritical && !headers.has('Idempotency-Key')) {
        const idKey = typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        headers.set('Idempotency-Key', idKey);
      }

      const res = await fetch(path, {
        ...options,
        headers,
        credentials: 'include', // Ensures better-auth.session_token cookie is transmitted
      });

      // Handle unauthenticated 401 session expiry
      if (res.status === 401 && !path.includes('/auth/sign-in') && !path.includes('/auth/get-session')) {
        // Clear local credentials on explicit 401 session expiration
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(USER_GYMS_KEY);
        localStorage.removeItem(ACTIVE_GYM_KEY);
        localStorage.removeItem(ACTIVE_NAV_KEY);
        setToken(null);
        setUser(null);
        setUserGyms([]);
      }

      return res;
    },
    [token, activeGymId]
  );

  // Fetch gyms associated with the authenticated user
  const fetchUserGyms = useCallback(async () => {
    try {
      setIsGymsLoading(true);
      const res = await apiFetch('/v1/gyms/my-gyms');
      if (res.ok) {
        const data = await res.json();
        const gyms: UserGymAssignment[] = Array.isArray(data) ? data : [];
        setUserGyms(gyms);
        localStorage.setItem(USER_GYMS_KEY, JSON.stringify(gyms));

        // Auto-select gym if none currently selected or if previously selected is invalid
        if (gyms.length > 0) {
          const validSelected = gyms.find((g) => g.gymId === activeGymId);
          if (!validSelected) {
            const defaultGymId = gyms[0].gymId;
            setActiveGymIdState(defaultGymId);
            localStorage.setItem(ACTIVE_GYM_KEY, defaultGymId);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load user gyms:', err);
    } finally {
      setIsGymsLoading(false);
    }
  }, [apiFetch, activeGymId]);

  // Set active gym ID and persist
  const setActiveGymId = useCallback((id: string) => {
    setActiveGymIdState(id);
    localStorage.setItem(ACTIVE_GYM_KEY, id);
  }, []);

  // Hydrate session on app mount synchronously with gyms to prevent KYC modal flicker
  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      try {
        const res = await apiFetch('/v1/auth/get-session');
        if (res.ok) {
          const sessionData = await res.json();
          if (sessionData?.user && isMounted) {
            setUser(sessionData.user);
            localStorage.setItem(USER_KEY, JSON.stringify(sessionData.user));
            const sessToken = sessionData.session?.token;
            if (sessToken) {
              setToken(sessToken);
              localStorage.setItem(TOKEN_KEY, sessToken);
            }

            // Immediately load user's gyms before marking session hydration complete
            try {
              const gymsRes = await fetch('/v1/gyms/my-gyms', {
                headers: sessToken ? { Authorization: `Bearer ${sessToken}` } : {},
                credentials: 'include',
              });
              if (gymsRes.ok) {
                const gymsData = await gymsRes.json();
                const gymsList: UserGymAssignment[] = Array.isArray(gymsData) ? gymsData : [];
                if (isMounted) {
                  setUserGyms(gymsList);
                  localStorage.setItem(USER_GYMS_KEY, JSON.stringify(gymsList));
                  if (gymsList.length > 0) {
                    const validSelected = gymsList.find((g) => g.gymId === activeGymId);
                    if (!validSelected) {
                      const firstGymId = gymsList[0].gymId;
                      setActiveGymIdState(firstGymId);
                      localStorage.setItem(ACTIVE_GYM_KEY, firstGymId);
                    }
                  }
                }
              }
            } catch (gymErr) {
              console.warn('Failed to fetch gyms during session hydration:', gymErr);
            }
          }
        } else if (res.status === 401) {
          if (isMounted) {
            setUser(null);
            setToken(null);
            setUserGyms([]);
            localStorage.removeItem(USER_KEY);
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_GYMS_KEY);
            localStorage.removeItem(ACTIVE_GYM_KEY);
            localStorage.removeItem(ACTIVE_NAV_KEY);
          }
        }
      } catch (err) {
        console.warn('Initial session check skipped (offline or server starting):', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsGymsLoading(false);
        }
      }
    }

    checkSession();

    return () => {
      isMounted = false;
    };
  }, []);

  // Sign In implementation
  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/v1/auth/sign-in/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        return {
          success: false,
          error: data?.message || data?.error?.message || 'Invalid email or password. Please try again.',
        };
      }

      // Capture user and session token
      const sessionUser: AuthUser = data.user || {
        id: data.userId || 'user',
        email: email.trim(),
        name: data.name || email.split('@')[0],
      };
      const sessionToken: string = data.token || data.session?.token || '';

      setUser(sessionUser);
      setToken(sessionToken);

      localStorage.setItem(USER_KEY, JSON.stringify(sessionUser));
      if (sessionToken) {
        localStorage.setItem(TOKEN_KEY, sessionToken);
      }

      // Pre-fetch gyms for this user prior to returning to ensure no modal flicker
      setIsGymsLoading(true);
      try {
        const gymsRes = await fetch('/v1/gyms/my-gyms', {
          headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {},
          credentials: 'include',
        });
        if (gymsRes.ok) {
          const gyms = await gymsRes.json();
          const gymsList: UserGymAssignment[] = Array.isArray(gyms) ? gyms : [];
          setUserGyms(gymsList);
          localStorage.setItem(USER_GYMS_KEY, JSON.stringify(gymsList));
          if (gymsList.length > 0) {
            const firstGymId = gymsList[0].gymId;
            setActiveGymIdState(firstGymId);
            localStorage.setItem(ACTIVE_GYM_KEY, firstGymId);
          }
        }
      } catch (gymErr) {
        console.warn('Could not load gyms immediately after login:', gymErr);
      } finally {
        setIsGymsLoading(false);
      }

      return { success: true };
    } catch (err) {
      console.error('Sign-in network error:', err);
      return {
        success: false,
        error: 'Unable to connect to the authentication server. Please verify your connection or ensure API is running.',
      };
    }
  };

  // Sign Up implementation
  const signUp = async (
    name: string,
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/v1/auth/sign-up/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        return {
          success: false,
          error: data?.message || data?.error?.message || 'Sign-up failed. This email may already be registered.',
        };
      }

      const sessionUser: AuthUser = data.user || {
        id: data.userId || 'user',
        email: email.trim(),
        name: name.trim(),
      };
      const sessionToken: string = data.token || data.session?.token || '';

      setUser(sessionUser);
      setToken(sessionToken);
      setUserGyms([]);

      localStorage.setItem(USER_KEY, JSON.stringify(sessionUser));
      localStorage.setItem(USER_GYMS_KEY, JSON.stringify([]));
      if (sessionToken) {
        localStorage.setItem(TOKEN_KEY, sessionToken);
      }
      setIsGymsLoading(false);

      return { success: true };
    } catch (err) {
      console.error('Sign-up error:', err);
      return {
        success: false,
        error: 'Network error during registration. Please verify your connection.',
      };
    }
  };

  // Sign Out implementation - clears all data and tab cache
  const signOut = async () => {
    try {
      await fetch('/v1/auth/sign-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({}),
      });
    } catch (err) {
      console.warn('Error during sign-out call:', err);
    } finally {
      setUser(null);
      setToken(null);
      setUserGyms([]);
      setActiveGymIdState(null);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(ACTIVE_GYM_KEY);
      localStorage.removeItem(USER_GYMS_KEY);
      localStorage.removeItem(ACTIVE_NAV_KEY);
    }
  };

  // Create Gym implementation for new gym owners
  const createGym = async (data: CreateGymPayload): Promise<{ success: boolean; gymId?: string; error?: string }> => {
    try {
      const res = await apiFetch('/v1/gyms', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      const resData = await res.json();

      if (!res.ok) {
        return {
          success: false,
          error: resData?.message || 'Failed to create gym facility. Please check your license details.',
        };
      }

      const newGymId = resData.id || resData.gym?.id;
      if (newGymId) {
        setActiveGymId(newGymId);
      }

      await fetchUserGyms();
      return { success: true, gymId: newGymId };
    } catch (err) {
      return {
        success: false,
        error: 'Network error while provisioning gym facility.',
      };
    }
  };

  // Resubmit gym for verification after rejection
  const resubmitGym = async (gymId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await apiFetch(`/v1/gyms/${gymId}/resubmit`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: data?.message || 'Failed to resubmit gym for verification.',
        };
      }
      await fetchUserGyms();
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Network error resubmitting gym for verification.',
      };
    }
  };

  // Determine current active gym object & role assignment from userGyms
  const activeAssignment = userGyms.find((g) => g.gymId === activeGymId) || null;
  const activeGym = activeAssignment?.gym || null;
  const userRole = activeAssignment?.role || null;
  const branchScope = activeAssignment?.branchScope || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        isGymsLoading,
        userGyms,
        activeGymId,
        activeGym,
        userRole,
        branchScope,
        setActiveGymId,
        signIn,
        signUp,
        signOut,
        refreshGyms: fetchUserGyms,
        fetchGyms: fetchUserGyms,
        createGym,
        resubmitGym,
        apiFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
