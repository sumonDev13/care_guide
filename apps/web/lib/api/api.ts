import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { ApiEnvelope, LoginCredentials, SessionData } from "./types";

/**
 * The single typed RTK Query slice (decision #7). New data surfaces
 * (doctors/patients in Steps 9-10) register their endpoints and tags here.
 *
 * CSRF defense #3 is applied exactly once, centrally: every mutation carries
 * the `X-Requested-With` marker the API's gate pairs with the SameSite cookie
 * + Origin allowlist (decisions #10/#14).
 */
export const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    // Same-origin always: next.config.ts proxies /api/* to the API process,
    // so cookies are first-party and no CORS surface exists.
    baseUrl: "/api",
    credentials: "same-origin",
    prepareHeaders: (headers, { type }) => {
      if (type === "mutation") headers.set("X-Requested-With", "XMLHttpRequest");
      return headers;
    },
  }),
  tagTypes: ["Session"],
  endpoints: (builder) => ({
    me: builder.query<SessionData, void>({
      query: () => "auth/me",
      transformResponse: (raw: ApiEnvelope<SessionData>) => raw.data,
      providesTags: ["Session"],
    }),
    login: builder.mutation<SessionData, LoginCredentials>({
      query: (credentials) => ({ url: "auth/login", method: "POST", body: credentials }),
      transformResponse: (raw: ApiEnvelope<SessionData>) => raw.data,
      invalidatesTags: ["Session"],
    }),
    logout: builder.mutation<{ loggedOut: boolean }, void>({
      query: () => ({ url: "auth/logout", method: "POST" }),
      transformResponse: (raw: ApiEnvelope<{ loggedOut: boolean }>) => raw.data,
      invalidatesTags: ["Session"],
      // Cache hygiene lives on the endpoint lifecycle (the docs' logout
      // pattern): the ENTIRE RTK cache is dropped, not just the Session tag —
      // protected doctor/patient data must not outlive the session in Redux
      // memory. Components only navigate home.
      onQueryStarted: async (_arg, { queryFulfilled, dispatch }) => {
        await queryFulfilled;
        dispatch(api.util.resetApiState());
      },
    }),
  }),
});

export const { useLoginMutation, useLogoutMutation, useMeQuery } = api;
