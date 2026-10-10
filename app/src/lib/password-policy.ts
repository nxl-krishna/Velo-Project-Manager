import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Must be at least 8 characters")
  .max(128)
  .regex(/[A-Z]/, "Must contain uppercase")
  .regex(/[0-9]/, "Must contain a number");
