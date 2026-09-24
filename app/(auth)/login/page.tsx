import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Accedi" };

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const next = typeof searchParams.next === "string" ? searchParams.next : undefined;
  const linkError = searchParams.errore === "link";

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-2xl font-semibold tracking-tight">Milo Flow</p>
          <p className="mt-1 text-sm text-muted-foreground">Lavoro e vita, in ordine.</p>
        </div>
        <LoginForm next={next} linkError={linkError} />
      </div>
    </main>
  );
}
