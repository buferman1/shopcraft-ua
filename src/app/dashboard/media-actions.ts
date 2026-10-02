"use server";
import { revalidatePath } from "next/cache";
import { storeAccess } from "@/lib/access";
import { canEditCatalog, uuidSchema, type ActionState } from "@/lib/validation";
import { imageFormat, MAX_IMAGE_BYTES } from "@/lib/media";
export async function uploadProductImage(
  storeId: string,
  productId: string,
  _state: ActionState,
  data: FormData,
): Promise<ActionState> {
  const { supabase, member, store } = await storeAccess(storeId);
  if (!canEditCatalog(member.role) || store.status === "suspended")
    return { error: "Немає дозволу на завантаження." };
  if (!uuidSchema.safeParse(productId).success)
    return { error: "Некоректний товар." };
  const file = data.get("image");
  const alt = String(data.get("alt") || "").trim();
  if (
    !(file instanceof File) ||
    !file.size ||
    file.size > MAX_IMAGE_BYTES ||
    alt.length > 160
  )
    return {
      error: "Додайте PNG, JPEG або WebP до 5 МБ. Опис — до 160 символів.",
    };
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (productError || !product) return { error: "Товар не знайдено." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = imageFormat(bytes);
  if (!format || file.type !== format.mime)
    return { error: "Формат файлу не відповідає PNG, JPEG або WebP." };
  const path =
    storeId +
    "/" +
    productId +
    "/" +
    crypto.randomUUID() +
    "." +
    format.extension;
  const { error: uploadError } = await supabase.storage
    .from("store-media")
    .upload(path, bytes, { contentType: format.mime, upsert: false });
  if (uploadError)
    return { error: "Завантаження не вдалося. Спробуйте ще раз." };
  const { error } = await supabase
    .from("product_images")
    .insert({ store_id: storeId, product_id: productId, path, alt });
  if (error) {
    await supabase.storage.from("store-media").remove([path]);
    return { error: "Не вдалося прив’язати фото до товару." };
  }
  revalidatePath("/dashboard/stores/" + storeId);
  return { success: "Фото додано." };
}
export async function updateInventory(
  storeId: string,
  productId: string,
  variantId: string,
  _state: ActionState,
  data: FormData,
): Promise<ActionState> {
  const { supabase, member, store } = await storeAccess(storeId);
  if (!canEditCatalog(member.role) || store.status === "suspended")
    return { error: "Немає дозволу на редагування." };
  const quantity = String(data.get("quantity") || "");
  if (
    !/^\d{1,7}$/.test(quantity) ||
    !uuidSchema.safeParse(variantId).success ||
    !uuidSchema.safeParse(productId).success
  )
    return { error: "Перевірте залишок." };
  const { data: updated, error } = await supabase
    .from("product_variants")
    .update({ inventory_quantity: Number(quantity) })
    .eq("id", variantId)
    .eq("product_id", productId)
    .eq("store_id", storeId)
    .select("id")
    .maybeSingle();
  if (error || !updated) return { error: "Не вдалося оновити залишок." };
  revalidatePath("/dashboard/stores/" + storeId);
  return { success: "Залишок збережено." };
}
