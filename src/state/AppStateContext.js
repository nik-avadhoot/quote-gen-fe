// ═══════════════════════════════════════════════════════════════════════════
// src/state/AppStateContext.js
//
// The context object and its accessor hook. Kept OUT of AppStateProvider.jsx
// so that file exports a component and nothing else - mixing component and
// non-component exports breaks React Fast Refresh
// (react-refresh/only-export-components).
// ═══════════════════════════════════════════════════════════════════════════
import { createContext, useContext } from "react";

export const AppStateContext = createContext(null);

export function useAppState(){
  const st = useContext(AppStateContext);
  if(!st) throw new Error("useAppState() called outside <AppStateProvider>");
  return st;
}
