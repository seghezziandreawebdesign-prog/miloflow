"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { sendMagicLink, signInWithPassword } from "@/lib/actions/auth";

export function LoginForm({ next, linkError }: { next?: string; linkError: boolean }) {
  const [passwordState, passwordAction, passwordPending] = useActionState(
    signInWithPassword,
    undefined,
  );
  const [linkState, linkAction, linkPending] = useActionState(sendMagicLink, undefined);
  // Controllata e condivisa tra le due schede: React azzera i form dopo l'invio.
  const [email, setEmail] = useState("");

  return (
    <Card>
      <CardContent>
        {linkError && (
          <p role="alert" className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Il link non è valido o è scaduto. Richiedine uno nuovo.
          </p>
        )}
        <Tabs defaultValue="password">
          <TabsList className="w-full">
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="link">Link via email</TabsTrigger>
          </TabsList>

          <TabsContent value="password">
            <form action={passwordAction} className="mt-4 space-y-4">
              <input type="hidden" name="next" value={next ?? ""} />
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              {passwordState?.error && (
                <p role="alert" className="text-sm text-destructive">
                  {passwordState.error}
                </p>
              )}
              <Button type="submit" className="w-full" size="lg" disabled={passwordPending}>
                {passwordPending ? "Accesso…" : "Accedi"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="link">
            <form action={linkAction} className="mt-4 space-y-4">
              <input type="hidden" name="next" value={next ?? ""} />
              <div className="space-y-2">
                <Label htmlFor="email-link">Email</Label>
                <Input
                  id="email-link"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {linkState?.error && (
                <p role="alert" className="text-sm text-destructive">
                  {linkState.error}
                </p>
              )}
              {linkState?.message && (
                <p role="status" className="text-sm text-muted-foreground">
                  {linkState.message}
                </p>
              )}
              <Button type="submit" className="w-full" size="lg" disabled={linkPending}>
                {linkPending ? "Invio…" : "Inviami il link"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
