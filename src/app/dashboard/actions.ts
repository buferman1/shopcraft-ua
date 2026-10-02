"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser, storeAccess } from "@/lib/access";
import {
  storeSchema,
  productSchema,
  categorySchema,
  variantSchema,
  uuidSchema,
  canEditCatalog,
  type ActionState,
} from "@/lib/validation";
const values = (data: FormData) => Object.fromEntries(data.entries());
export async function createStore(
  _state: ActionState,
  data: FormData,
): Promise<ActionState> {
  const parsed = storeSchema.safeParse(values(data));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase, user } = await requireUser();
  const { data: store, error } = await supabase
    .from("stores")
    .insert({ ...parsed.data, owner_id: user.id })
    .select("id")
    .single();
  if (error)
    return {
      error:
        error.code === "23505"
          ? "Ця адреса вже зайнята. Оберіть іншу."
          : "Не вдалося створити магазин.",
    };
  revalidatePath("/dashboard");
  redirect("/dashboard/stores/" + store.id);
}
export async function saveProduct(
  storeId: string,
  productId: string | null,
  _state: ActionState,
  data: FormData,
): Promise<ActionState> {
  const { supabase, member, store } = await storeAccess(storeId);
  if (!canEditCatalog(member.role) || store.status === "suspended")
    return { error: "Немає дозволу на редагування." };
  const parsed = productSchema.safeParse(values(data));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (productId && !uuidSchema.safeParse(productId).success)
    return { error: "Некоректний товар." };
  const query = productId
    ? supabase
        .from("products")
        .update({ ...parsed.data, updated_at: new Date().toISOString() })
        .eq("id", productId)
        .eq("store_id", storeId)
    : supabase.from("products").insert({ ...parsed.data, store_id: storeId });
  const { data: product, error } = await query.select("id").single();
  if (error)
    return {
      error:
        error.code === "23505"
          ? "Така адреса товару вже є в магазині."
          : "Не вдалося зберегти товар. Перевірте категорію й дані.",
    };
  revalidatePath("/dashboard/stores/" + storeId);
  if (!productId)
    redirect("/dashboard/stores/" + storeId + "/products/" + product.id);
  return { success: "Товар збережено." };
}
export async function createCategory(
  storeId: string,
  _state: ActionState,
  data: FormData,
): Promise<ActionState> {
  const { supabase, member, store } = await storeAccess(storeId);
  if (!canEditCatalog(member.role) || store.status === "suspended")
    return { error: "Немає дозволу на редагування." };
  const parsed = categorySchema.safeParse(values(data));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { error } = await supabase
    .from("categories")
    .insert({ ...parsed.data, store_id: storeId });
  if (error)
    return {
      error:
        error.code === "23505"
          ? "Така адреса категорії вже є."
          : "Не вдалося додати категорію.",
    };
  revalidatePath("/dashboard/stores/" + storeId);
  return { success: "Категорію додано." };
}
export async function addVariant(
  storeId: string,
  productId: string,
  _state: ActionState,
  data: FormData,
): Promise<ActionState> {
  const { supabase, member, store } = await storeAccess(storeId);
  if (!canEditCatalog(member.role) || store.status === "suspended")
    return { error: "Немає дозволу на редагування." };
  const parsed = variantSchema.safeParse(values(data));
  if (!parsed.success || !uuidSchema.safeParse(productId).success)
    return { error: "Перевірте назву, SKU й цілий невід’ємний залишок." };
  const { size, color, ...variant } = parsed.data;
  const { error } = await supabase
    .from("product_variants")
    .insert({
      ...variant,
      product_id: productId,
      store_id: storeId,
      options: { size, color },
    });
  if (error)
    return {
      error:
        error.code === "23505"
          ? "SKU вже використовується у цьому магазині."
          : "Не вдалося додати варіант.",
    };
  revalidatePath("/dashboard/stores/" + storeId);
  return { success: "Варіант додано." };
}
export async function saveProfile(
  _state: ActionState,
  data: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const name = String(data.get("display_name") || "").trim();
  if (name.length < 2 || name.length > 120)
    return { error: "Ім’я має містити 2–120 символів." };
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: name, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return { error: "Не вдалося зберегти профіль." };
  revalidatePath("/dashboard/profile");
  return { success: "Профіль збережено." };
}
