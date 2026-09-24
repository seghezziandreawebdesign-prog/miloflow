import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "./database.types";
import { supabaseAnonKey, supabaseUrl } from "./env";

// Client per Server Components, Server Actions e Route Handlers: agisce come
// l'utente loggato, quindi tutte le query passano dalle policy RLS.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Chiamato da un Server Component: i cookie si possono scrivere solo
          // in actions e route handler. Il proxy rinnova comunque la sessione.
        }
      },
    },
  });
}
