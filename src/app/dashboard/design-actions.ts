"use server";
import { revalidatePath } from "next/cache";
import { storeAccess } from "@/lib/access";
import { canEditCatalog } from "@/lib/validation";
import { designSchema } from "@/lib/design";
import { imageFormat, MAX_IMAGE_BYTES } from "@/lib/media";

export async function loadDesignVersion(
  storeId: string,
  revision: number,
): Promise<{ error?: string; design?: import("@/lib/design").Design }> {
  const { supabase, store, member } = await storeAccess(storeId);
  if (
    !canEditCatalog(member.role) ||
    store.status === "suspended" ||
    !Number.isSafeInteger(revision) ||
    revision < 1
  )
    return { error: "Немає доступу до версії" };
  const { data, error } = await supabase
    .from("store_design_versions")
    .select("config")
    .eq("store_id", storeId)
    .eq("revision", revision)
    .maybeSingle();
  const parsed = designSchema.safeParse(data?.config);
  if (error || !parsed.success)
    return { error: "Версія недоступна або має непідтримуваний формат" };
  return { design: parsed.data };
}

export type DesignResult = {
  error?: string;
  success?: string;
  revision?: number;
  imageUrl?: string;
};
export async function saveDesign(
  storeId: string,
  input: unknown,
  expectedRevision: number,
): Promise<DesignResult> {
  const { supabase, store, member } = await storeAccess(storeId);
  if (!canEditCatalog(member.role) || store.status === "suspended")
    return { error: "Немає дозволу на редагування оформлення." };
  const parsed = designSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
    return { error: "Некоректна версія оформлення." };
  const { data, error } = await supabase.rpc("save_store_design", {
    target_store: storeId,
    new_config: parsed.data,
    expected_revision: expectedRevision,
  });
  if (error)
    return {
      error:
        error.code === "40001"
          ? "Оформлення вже змінено в іншій вкладці. Оновіть сторінку перед збереженням."
          : "Не вдалося зберегти оформлення. Спробуйте ще раз.",
    };
  return { success: "Чернетку збережено", revision: Number(data) };
}
export async function publishDesign(
  storeId: string,
  expectedRevision: number,
  publish: boolean,
): Promise<DesignResult> {
  const { supabase, store, member } = await storeAccess(storeId);
  if (!["owner", "admin"].includes(member.role) || store.status === "suspended")
    return { error: "Публікація доступна власнику й адміністратору." };
  if (
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 1 ||
    typeof publish !== "boolean"
  )
    return { error: "Спочатку збережіть оформлення." };
  const { error } = await supabase.rpc("publish_store_design", {
    target_store: storeId,
    expected_revision: expectedRevision,
    make_public: publish,
  });
  if (error)
    return {
      error:
        error.code === "40001"
          ? "Чернетка змінилася. Оновіть сторінку перед публікацією."
          : "Не вдалося змінити публікацію магазину.",
    };
  revalidatePath(`/shop/${store.slug}`, "layout");
  revalidatePath("/dashboard");
  return {
    success: publish ? "Магазин опубліковано" : "Магазин знято з публікації",
  };
}
export async function uploadDesignImage(
  storeId: string,
  data: FormData,
): Promise<DesignResult> {
  const { supabase, store, member } = await storeAccess(storeId);
  if (!canEditCatalog(member.role) || store.status === "suspended")
    return { error: "Немає дозволу на завантаження." };
  const file = data.get("image");
  if (!(file instanceof File) || !file.size || file.size > MAX_IMAGE_BYTES)
    return { error: "Додайте PNG, JPEG або WebP до 5 МБ." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = imageFormat(bytes);
  if (!format || file.type !== format.mime)
    return { error: "Формат файлу не відповідає PNG, JPEG або WebP." };
  const path = `${storeId}/design/${crypto.randomUUID()}.${format.extension}`;
  const { error } = await supabase.storage
    .from("store-media")
    .upload(path, bytes, { contentType: format.mime, upsert: false });
  if (error) return { error: "Не вдалося завантажити зображення." };
  return {
    imageUrl: supabase.storage.from("store-media").getPublicUrl(path).data
      .publicUrl,
  };
}
