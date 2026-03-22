"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface OfflineContextType {
  isOnline: boolean;
  pendingChanges: number;
  lastSyncAt: Date | null;
  isSyncing: boolean;
}

const OfflineCtx = createContext<OfflineContextType>({
  isOnline: true, pendingChanges: 0, lastSyncAt: null, isSyncing: false
});

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
  }, []);

  return (
    <OfflineCtx.Provider value={{ isOnline, pendingChanges: 0, lastSyncAt: null, isSyncing: false }}>
      {children}
    </OfflineCtx.Provider>
  );
}

export const useOffline = () => useContext(OfflineCtx);
