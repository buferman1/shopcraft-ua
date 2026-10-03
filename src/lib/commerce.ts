import { z } from "zod";

export const cartItemSchema = z.object({
  productId: z.uuid(),
  variantId: z.uuid(),
  quantity: z.number().int().min(1).max(20),
  name: z.string().max(200),
  variant: z.string().max(200),
  price: z.number().finite().nonnegative().max(999999999),
  slug: z.string().max(160),
});
export type CartItem = z.infer<typeof cartItemSchema>;
export const cartSchema = z.array(cartItemSchema).max(30);
export const checkoutSchema = z
  .object({
    token: z.uuid(),
    name: z.string().trim().min(2, "Вкажіть ім’я покупця").max(120),
    phone: z
      .string()
      .transform((v) => v.replace(/[\s()+-]/g, ""))
      .pipe(z.string().regex(/^\d{10,15}$/, "Вкажіть телефон: 10–15 цифр")),
    email: z.union([z.literal(""), z.email()]).default(""),
    method: z.enum(["pickup", "delivery"]),
    address: z.string().trim().max(500).default(""),
    note: z.string().trim().max(1000).default(""),
    consent: z.literal(true, {
      error: "Потрібна згода на передачу даних продавцю",
    }),
    items: z
      .array(
        z.object({
          variantId: z.uuid(),
          quantity: z.number().int().min(1).max(20),
        }),
      )
      .min(1)
      .max(30),
  })
  .refine((v) => v.method !== "delivery" || v.address.length >= 5, {
    path: ["address"],
    message: "Вкажіть місто та адресу або відділення",
  })
  .refine(
    (v) => new Set(v.items.map((i) => i.variantId)).size === v.items.length,
    { message: "У кошику повторюються варіанти" },
  )
  .refine((v) => v.items.reduce((sum, i) => sum + i.quantity, 0) <= 100, {
    message: "Максимум 100 одиниць у замовленні",
  });
export const settingsSchema = z
  .object({
    orders_enabled: z.boolean(),
    pickup_enabled: z.boolean(),
    delivery_enabled: z.boolean(),
    shipping_fee: z.coerce.number().finite().min(0).max(99999),
    pickup_address: z.string().trim().max(500),
    seo_title: z.string().trim().max(70),
    seo_description: z.string().trim().max(160),
  })
  .refine((v) => !v.orders_enabled || v.pickup_enabled || v.delivery_enabled, {
    message: "Увімкніть хоча б один спосіб отримання",
  })
  .refine((v) => !v.pickup_enabled || v.pickup_address.length >= 5, {
    message: "Вкажіть адресу самовивозу",
  });
export type CommerceSettings = z.infer<typeof settingsSchema>;
export const defaultSettings: CommerceSettings = {
  orders_enabled: false,
  pickup_enabled: false,
  delivery_enabled: true,
  shipping_fee: 0,
  pickup_address: "",
  seo_title: "",
  seo_description: "",
};
export const orderLabels: Record<string, string> = {
  new: "Нове",
  confirmed: "Підтверджено",
  packing: "Комплектується",
  shipped: "Відправлено",
  completed: "Завершено",
  cancelled: "Скасовано",
  returned: "Повернено",
};
export const transitions: Record<string, string[]> = {
  new: ["confirmed", "cancelled"],
  confirmed: ["packing", "cancelled"],
  packing: ["shipped", "completed", "cancelled"],
  shipped: ["completed", "returned"],
  completed: ["returned"],
  cancelled: [],
  returned: [],
};
export function putCartItem(items: CartItem[], item: CartItem): CartItem[] {
  const current = items.find((i) => i.variantId === item.variantId);
  if (current)
    return items.map((i) =>
      i.variantId === item.variantId
        ? { ...item, quantity: Math.min(20, current.quantity + item.quantity) }
        : i,
    );
  return items.length < 30 ? [...items, item] : items;
}
