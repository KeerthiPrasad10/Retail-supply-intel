"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Model } from "@/lib/types";

const ModelContext = createContext<Model | null>(null);

export function ModelProvider({ model, children }: { model: Model; children: ReactNode }) {
  return <ModelContext.Provider value={model}>{children}</ModelContext.Provider>;
}

export function useModel(): Model {
  const m = useContext(ModelContext);
  if (!m) throw new Error("useModel must be used within ModelProvider");
  return m;
}

export function useCname(): (code: string | null | undefined) => string {
  const { nameByCode } = useModel();
  return (code) => (code ? nameByCode[code] ?? code : "—");
}
