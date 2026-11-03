import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export interface PlatformAdminUser {
  id: string;
  email: string;
  name: string;
}

export interface PlatformAdminRecord {
  id: string;
  userId: string;
  role: 'superadmin' | 'support' | 'auditor';
  isActive: boolean;
}

interface PlatformAuthContextType {
  user: PlatformAdminUser | null;
  admin: PlatformAdminRecord | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>;
}

const PlatformAuthContext = createContext<PlatformAuthContextType | undefined>(undefined);

const PLATFORM_TOKEN_KEY = 'gympulse_platform_token';
const PLATFORM_USER_KEY = 'gympulse_platform_user';
const PLATFORM_ADMIN_KEY = 'gympulse_platform_admin';

export function PlatformAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PlatformAdminUser | null>(() => {
    try {
      const stored = localStorage.getItem(PLATFORM_USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [admin, setAdmin] = useState<PlatformAdminRecord | null>(() => {
    try {
      const stored = localStorage.getItem(PLATFORM_ADMIN_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(PLATFORM_TOKEN_KEY);
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState(true);

  // Authenticated fetch helper for Platform API
  const apiFetch = useCallback(
    async (path: string, options: RequestInit = {}): Promise<Response> => {
      const headers = new Headers(options.headers || {});

      if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }

      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      const res = await fetch(path, {
        ...options,
        headers,
        credentials: 'include',
      });

      if (res.status === 401 && !path.includes('/auth/sign-in')) {
        localStorage.removeItem(PLATFORM_TOKEN_KEY);
        localStorage.removeItem(PLATFORM_USER_KEY);
        localStorage.removeItem(PLATFORM_ADMIN_KEY);
        setToken(null);
        setUser(null);
        setAdmin(null);
      }

      return res;
    },
    [token]
  );

  // Hydrate platform admin session on mount
  useEffect(() => {
    let isMounted = true;

    async function checkPlatformSession() {
      try {
        const sessionToken = localStorage.getItem(PLATFORM_TOKEN_KEY);
        if (!sessionToken) {
          if (isMounted) setIsLoading(false);
          return;
        }

        const res = await fetch('/v1/platform/me', {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
          credentials: 'include',
        });

        if (res.ok) {
          const adminData: PlatformAdminRecord = await res.json();
          if (isMounted) {
            setAdmin(adminData);
            localStorage.setItem(PLATFORM_ADMIN_KEY, JSON.stringify(adminData));
          }
        } else {
          // Token invalid or user revoked from platformAdmins
          if (isMounted) {
            setUser(null);
            setAdmin(null);
            setToken(null);
            localStorage.removeItem(PLATFORM_TOKEN_KEY);
            localStorage.removeItem(PLATFORM_USER_KEY);
            localStorage.removeItem(PLATFORM_ADMIN_KEY);
          }
        }
      } catch (err) {
        console.warn('Platform session hydration check failed:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    checkPlatformSession();

    return () => {
      isMounted = false;
    };
  }, []);

  // Platform Sign In
  const signIn = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // 1. Authenticate credentials via Better Auth
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
          error: data?.message || data?.error?.message || 'Invalid administrator credentials.',
        };
      }

      const sessionToken: string = data.token || data.session?.token || '';
      const authUser: PlatformAdminUser = data.user || {
        id: data.userId || 'admin-user',
        email: email.trim(),
        name: data.name || 'Platform Administrator',
      };

      // 2. Strict Platform Clearance Check: Verify caller exists in platform_admins
      const clearanceRes = await fetch('/v1/platform/me', {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
        credentials: 'include',
      });

      if (!clearanceRes.ok) {
        // Disavow session: User authenticated in auth_user, but has ZERO clearance in platform_admins
        try {
          await fetch('/v1/auth/sign-out', {
            method: 'POST',
            headers: { Authorization: `Bearer ${sessionToken}` },
            credentials: 'include',
            body: JSON.stringify({}),
          });
        } catch {
          // ignore cleanup error
        }

        return {
          success: false,
          error:
            'Access Denied (403): This identity is not authorized as a Platform Administrator in the global directory. Security incident logged.',
        };
      }

      const adminRecord: PlatformAdminRecord = await clearanceRes.json();

      setUser(authUser);
      setAdmin(adminRecord);
      setToken(sessionToken);

      localStorage.setItem(PLATFORM_USER_KEY, JSON.stringify(authUser));
      localStorage.setItem(PLATFORM_ADMIN_KEY, JSON.stringify(adminRecord));
      if (sessionToken) {
        localStorage.setItem(PLATFORM_TOKEN_KEY, sessionToken);
      }

      return { success: true };
    } catch (err) {
      console.error('Platform sign-in error:', err);
      return {
        success: false,
        error: 'Unable to reach the Platform Gateway. Ensure backend API is running.',
      };
    }
  };

  // Platform Sign Out
  const signOut = async () => {
    try {
      if (token) {
        await fetch('/v1/auth/sign-out', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          credentials: 'include',
          body: JSON.stringify({}),
        });
      }
    } catch (err) {
      console.warn('Error during platform sign-out:', err);
    } finally {
      setUser(null);
      setAdmin(null);
      setToken(null);
      localStorage.removeItem(PLATFORM_TOKEN_KEY);
      localStorage.removeItem(PLATFORM_USER_KEY);
      localStorage.removeItem(PLATFORM_ADMIN_KEY);
    }
  };

  return (
    <PlatformAuthContext.Provider
      value={{
        user,
        admin,
        token,
        isAuthenticated: !!user && !!admin,
        isLoading,
        signIn,
        signOut,
        apiFetch,
      }}
    >
      {children}
    </PlatformAuthContext.Provider>
  );
}

export function usePlatformAuth(): PlatformAuthContextType {
  const context = useContext(PlatformAuthContext);
  if (!context) {
    throw new Error('usePlatformAuth must be used within a PlatformAuthProvider');
  }
  return context;
}
