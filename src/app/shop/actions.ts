"use server";
import { checkoutSchema } from "@/lib/commerce";
import { slugSchema } from "@/lib/validation";
import { createPublicClient } from "@/lib/supabase/public";
export async function placeOrder(
  slug: string,
  input: unknown,
): Promise<{
  error?: string;
  order?: { id: string; total: number; currency: string };
}> {
  if (!slugSchema.safeParse(slug).success)
    return { error: "Некоректний магазин" };
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { data, error } = await createPublicClient().rpc("checkout_order", {
    shop_slug: slug,
    payload: parsed.data,
  });
  if (error) {
    const messages: Record<string, string> = {
      SC_CLOSED: "Магазин зараз не приймає замовлення",
      SC_STOCK: "Залишки змінилися. Перевірте варіанти й кількість товарів",
      SC_DELIVERY: "Обраний спосіб отримання недоступний",
      SC_LIMIT: "Забагато запитів. Спробуйте пізніше",
      SC_RETRY: "Цей запит уже використано. Оновіть кошик",
    };
    return {
      error:
        messages[error.message] ||
        "Не вдалося оформити замовлення. Спробуйте ще раз",
    };
  }
  if (!data || typeof data.id !== "string")
    return { error: "Не отримано підтвердження замовлення" };
  return {
    order: { id: data.id, total: Number(data.total), currency: data.currency },
  };
}
