import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { useSession } from '@/context/session';
import { supabase } from '@/lib/supabase';
import { darkColors, lightColors, type Colors } from './colors';

export type ThemePreference = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  preference: ThemePreference;
  scheme: 'light' | 'dark';
  colors: Colors;
  setPreference: (next: ThemePreference) => void;
};

const STORAGE_KEY = 'theme-preference';

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isPreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

function readLocal(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isPreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

function writeLocal(value: ThemePreference) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {}
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const [preference, setPreferenceState] = useState<ThemePreference>(readLocal);
  const systemScheme = useColorScheme();

  // Apply the preference to the native appearance (also themes native UI like alerts).
  useEffect(() => {
    Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
  }, [preference]);

  // Adopt the synced preference from the user's Supabase profile when it changes (e.g. on sign-in).
  const remote = session?.user.user_metadata?.theme;
  const [seenRemote, setSeenRemote] = useState<unknown>(undefined);
  if (remote !== seenRemote) {
    setSeenRemote(remote);
    if (isPreference(remote)) setPreferenceState(remote);
  }
  useEffect(() => {
    writeLocal(preference);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    // Sync to the user's profile (user_metadata); the local value is already applied.
    supabase.auth.updateUser({ data: { theme: next } }).catch(() => {});
  }, []);

  const scheme: 'light' | 'dark' =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      scheme,
      colors: scheme === 'dark' ? darkColors : lightColors,
      setPreference,
    }),
    [preference, scheme, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
