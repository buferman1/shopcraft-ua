import "server-only";
import { notFound } from "next/navigation";
import { createPublicClient } from "./supabase/public";
import { designSchema } from "./design";
import { slugSchema } from "./validation";

export async function publishedStore(slug: string) {
  if (!slugSchema.safeParse(slug).success) notFound();
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("storefronts")
    .select("store_id,slug,name,currency,config")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error("Не вдалося відкрити магазин. Спробуйте ще раз.");
  if (!data) notFound();
  const design = designSchema.safeParse(data.config);
  if (!design.success) notFound();
  return {
    supabase,
    store: {
      id: data.store_id as string,
      name: data.name as string,
      slug: data.slug as string,
      currency: data.currency as string,
    },
    design: design.data,
  };
}
