"use server";
import { revalidatePath } from "next/cache";
import { storeAccess } from "@/lib/access";
import { settingsSchema, transitions } from "@/lib/commerce";
import { uuidSchema, type ActionState } from "@/lib/validation";
export async function saveCommerceSettings(
  storeId: string,
  _state: ActionState,
  data: FormData,
): Promise<ActionState> {
  const { supabase, member, store } = await storeAccess(storeId);
  if (!["owner", "admin"].includes(member.role) || store.status === "suspended")
    return { error: "Налаштування доступні власнику й адміністратору" };
  const parsed = settingsSchema.safeParse({
    ...Object.fromEntries(data),
    orders_enabled: data.get("orders_enabled") === "on",
    pickup_enabled: data.get("pickup_enabled") === "on",
    delivery_enabled: data.get("delivery_enabled") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { error } = await supabase
    .from("store_settings")
    .upsert({
      store_id: storeId,
      ...parsed.data,
      updated_at: new Date().toISOString(),
    });
  if (error) return { error: "Не вдалося зберегти налаштування" };
  revalidatePath(`/dashboard/stores/${storeId}/settings`);
  revalidatePath(`/shop/${store.slug}`, "layout");
  return { success: "Налаштування збережено" };
}
export async function updateOrderStatus(
  storeId: string,
  orderId: string,
  _state: ActionState,
  data: FormData,
): Promise<ActionState> {
  const { supabase, member, store } = await storeAccess(storeId);
  if (
    !["owner", "admin", "manager"].includes(member.role) ||
    store.status === "suspended"
  )
    return { error: "Недостатньо прав для зміни замовлення" };
  const status = String(data.get("status") || "");
  if (
    !uuidSchema.safeParse(orderId).success ||
    !Object.keys(transitions).includes(status)
  )
    return { error: "Некоректний статус" };
  const { error } = await supabase.rpc("change_order_status", {
    target_store: storeId,
    target_order: orderId,
    next_status: status,
  });
  if (error)
    return {
      error:
        error.message === "SC_STOCK"
          ? "Недостатньо залишків. Оновіть склад або скасуйте замовлення"
          : "Не вдалося змінити статус. Оновіть сторінку й перевірте доступний перехід",
    };
  revalidatePath(`/dashboard/stores/${storeId}/orders`);
  revalidatePath(`/dashboard/stores/${storeId}/orders/${orderId}`);
  revalidatePath(`/shop/${store.slug}`, "layout");
  return { success: "Статус і залишки оновлено" };
}
