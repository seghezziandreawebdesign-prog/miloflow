import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Email non valida"),
  password: z.string().min(1, "Inserisci la password"),
  next: z.string().optional(),
});

export const magicLinkSchema = z.object({
  email: z.email("Email non valida"),
  next: z.string().optional(),
});
