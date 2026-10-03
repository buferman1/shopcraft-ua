import { z } from "zod";
export const passwordSchema = z
  .string()
  .min(12, "Пароль має містити щонайменше 12 символів")
  .max(128);
export const loginPasswordSchema = z.string().min(1).max(128);
export const emailSchema = z
  .string()
  .trim()
  .email("Вкажіть коректний email")
  .max(254);
export const slugSchema = z
  .string()
  .trim()
  .min(3)
  .max(80)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Лише малі латинські літери, цифри та дефіси",
  );
export const uuidSchema = z.string().uuid();
export const storeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: slugSchema,
  currency: z.enum(["UAH", "USD", "EUR", "PLN"]),
  locale: z.enum(["uk", "en", "pl", "de"]),
});
export const moneySchema = z
  .string()
  .regex(
    /^\d{1,8}(?:\.\d{1,2})?$/,
    "Вкажіть невід’ємну суму, максимум 2 знаки після крапки",
  )
  .transform(Number);
export const productSchema = z.object({
  name: z.string().trim().min(2).max(200),
  slug: slugSchema,
  description: z.string().max(10000),
  price: moneySchema,
  sku: z.string().trim().max(80),
  status: z.enum(["draft", "active", "archived"]),
  category_id: z.union([uuidSchema, z.literal("")]).transform((v) => v || null),
});
export const variantSchema = z.object({
  title: z.string().trim().min(1).max(120),
  sku: z.string().trim().min(1).max(80),
  size: z.string().trim().max(30),
  color: z.string().trim().max(50),
  inventory_quantity: z
    .string()
    .regex(/^\d{1,7}$/)
    .transform(Number),
});
export const categorySchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: slugSchema,
});
export const catalogRoles = ["owner", "admin", "manager", "editor"];
export function canEditCatalog(role: string) {
  return catalogRoles.includes(role);
}
export function callbackDestination(value: string | null) {
  return value === "/auth/update" ? value : "/dashboard";
}
export type ActionState = { error?: string; success?: string };
