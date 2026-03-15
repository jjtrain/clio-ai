"use client";

import { createContext, useContext } from "react";

interface PortalUser {
  id: string;
  name: string;
  email: string;
  clientId: string;
  clientName?: string;
}

export const PortalContext = createContext<{ user: PortalUser | null; token: string | null }>({ user: null, token: null });

export function usePortal() {
  return useContext(PortalContext);
}
