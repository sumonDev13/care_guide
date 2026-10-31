import { configureStore } from "@reduxjs/toolkit";
import { api } from "./api/api";

/**
 * One store, one slice today: the RTK Query api. Session-scoped cache
 * hygiene (drop everything on logout) lives on the logout endpoint's
 * `onQueryStarted` lifecycle in lib/api/api.ts, so no extra middleware is
 * needed here.
 */
export function makeStore() {
  return configureStore({
    reducer: {
      [api.reducerPath]: api.reducer,
    },
  });
}

/** There is exactly one store; `Providers` hands it to react-redux. */
export const store = makeStore();

export type AppStore = typeof store;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
