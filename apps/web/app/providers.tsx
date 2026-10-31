"use client";

import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { store } from "@/lib/store";

/** Root client boundary: every app surface shares this one store instance. */
export function Providers({ children }: { children: ReactNode }) {
  return <Provider store={store}>{children}</Provider>;
}
