import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { screenshots as scrApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { ImportResponse } from '../types';

interface ImportState {
  phase: 'idle' | 'discover' | 'resolve' | 'download' | 'done' | 'error';
  steam_id?: string;
  total_discovered: number;
  total_resolved: number;
  total_failed: number;
  total_downloaded: number;
  live_pending: number;
  live_resolved: number;
  live_failed: number;
  live_download_failed: number;
  live_downloaded: number;
  stale_failed?: number;
  stale_pending?: number;
  error_msg?: string;
  started_at?: string;
}

interface ImportContextValue {
  state: ImportState;
  startImport: (steamId: string) => void;
  cancelImport: () => void;
  retryFailed: () => void;
  clear: () => void;
}

const IDLE: ImportState = {
  phase: 'idle',
  total_discovered: 0,
  total_resolved: 0,
  total_failed: 0,
  total_downloaded: 0,
  live_pending: 0,
  live_resolved: 0,
  live_failed: 0,
  live_download_failed: 0,
  live_downloaded: 0,
};

const ImportCtx = createContext<ImportContextValue>({
  state: IDLE,
  startImport: () => {},
  cancelImport: () => {},
  retryFailed: () => {},
  clear: () => {},
});

export function ImportProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ImportState>(IDLE);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { user } = useAuth();
  const prevUserId = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Poll progress every 3s while import is active
  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    let alive = true;
    pollingRef.current = setInterval(async () => {
      if (!alive) return;
      try {
        const data = await scrApi.importProgress();
        if (!alive) return;
        const s = data as ImportState;
        setState(s);
        if (s.phase === 'done' || s.phase === 'error' || s.phase === 'idle') {
          stopPolling();
        }
      } catch {
        // Server might be restarting, keep polling
      }
    }, 3000);
    return () => { alive = false; };
  }, []);

  // Reset + re-check import state whenever the logged-in user changes
  useEffect(() => {
    const currentId = user?.id ?? null;
    if (prevUserId.current === currentId) return; // no change

    stopPolling();

    if (currentId !== null) {
      // Logged in — check backend for this user's active import
      scrApi.importProgress().then((data) => {
        const s = data as ImportState;
        setState(s);
        if (s.phase !== 'idle' && s.phase !== 'done' && s.phase !== 'error') {
          startPolling();
        }
      }).catch(() => {
        setState(IDLE);
      });
    } else {
      // Logged out — wipe state
      setState(IDLE);
    }

    prevUserId.current = currentId;
  }, [user?.id, stopPolling, startPolling]);

  const startImport = useCallback(async (steamId: string) => {
    setState({ ...IDLE, phase: 'discover' });
    try {
      const res = await scrApi.importSteamApi(steamId) as ImportResponse;
      if (res.started) {
        startPolling();
      } else if (res.message) {
        setState((prev) => ({ ...prev, phase: 'error', error_msg: res.message }));
      }
    } catch (err: any) {
      setState((prev) => ({ ...prev, phase: 'error', error_msg: err.message }));
    }
  }, [startPolling]);

  const retryFailed = useCallback(async () => {
    setState((prev) => ({
      ...IDLE, phase: 'resolve',
      total_discovered: prev.stale_failed || prev.total_failed || 0,
      stale_failed: 0,
    }));
    try {
      const res = await scrApi.retrySteamFailed() as ImportResponse;
      if (res.started) {
        startPolling();
      } else if (res.message) {
        setState((prev) => ({ ...prev, phase: 'error', error_msg: res.message }));
      }
    } catch (err: any) {
      setState((prev) => ({ ...prev, phase: 'error', error_msg: err.message }));
    }
  }, [startPolling]);

  const clear = useCallback(() => {
    stopPolling();
    setState(IDLE);
    // Reset backend state so refresh doesn't resurrect the completion card
    scrApi.clearImportProgress().catch(() => {});
  }, [stopPolling]);

  const cancelImport = useCallback(async () => {
    stopPolling();
    setState(IDLE);
    scrApi.cancelImport().catch(() => {});
    // Also reset backend state
    scrApi.clearImportProgress().catch(() => {});
  }, [stopPolling]);

  return (
    <ImportCtx.Provider value={{ state, startImport, cancelImport, retryFailed, clear }}>
      {children}
    </ImportCtx.Provider>
  );
}

export function useImport() {
  const ctx = useContext(ImportCtx);
  if (!ctx) throw new Error('useImport must be used within ImportProvider');
  return ctx;
}
