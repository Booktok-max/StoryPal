import { useState, useEffect, useCallback } from "react";
import {
  fetchMe,
  loginAccount,
  registerAccount,
  logoutAccount,
  switchActiveChild,
  createChildProfile,
  type MeResponse,
  type ChildSummary,
} from "../api/client";

export type AuthStatus = "loading" | "signed-out" | "signed-in";

export interface UseAuthResult {
  status: AuthStatus;
  me: MeResponse | null;
  activeChild: ChildSummary | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, displayName: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  selectChild: (childId: string) => Promise<void>;
  /** Clears the active child so the picker (ChildGate) shows again, without fully logging out. */
  deselectChild: () => Promise<void>;
  addChild: (params: {
    displayName: string;
    ageBand?: "4-5" | "6-7" | "8-9";
    buddyRole?: "owl" | "dragon";
  }) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Session state for the whole app. On mount, calls GET /api/auth/me — a 401
 * (no valid session cookie) is treated as "signed out", not an error.
 * login/register/logout/selectChild/addChild all re-fetch /me afterward so
 * `me`/`activeChild` stay in sync with the server's session state.
 */
export function useAuth(): UseAuthResult {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [me, setMe] = useState<MeResponse | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchMe();
      setMe(data);
      setStatus("signed-in");
    } catch {
      setMe(null);
      setStatus("signed-out");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      await loginAccount({ email, password });
      await refresh();
    },
    [refresh]
  );

  const register = useCallback(
    async (email: string, displayName: string, password: string) => {
      await registerAccount({ email, displayName, password });
      // Registration doesn't auto-establish a session server-side; log in
      // immediately after so the parent doesn't have to re-type anything.
      await loginAccount({ email, password });
      await refresh();
    },
    [refresh]
  );

  const logout = useCallback(async () => {
    await logoutAccount();
    setMe(null);
    setStatus("signed-out");
  }, []);

  const selectChild = useCallback(
    async (childId: string) => {
      await switchActiveChild(childId);
      await refresh();
    },
    [refresh]
  );

  const deselectChild = useCallback(async () => {
    await switchActiveChild(null);
    await refresh();
  }, [refresh]);

  const addChild = useCallback(
    async (params: { displayName: string; ageBand?: "4-5" | "6-7" | "8-9"; buddyRole?: "owl" | "dragon" }) => {
      const { child } = await createChildProfile(params);
      await switchActiveChild(child.id);
      await refresh();
    },
    [refresh]
  );

  const activeChild = me?.children.find((c) => c.id === me.activeChildId) ?? null;

  return { status, me, activeChild, login, register, logout, selectChild, deselectChild, addChild, refresh };
}
