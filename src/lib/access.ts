import "server-only";
import { redirect, notFound } from "next/navigation";
import { createClient } from "./supabase/server";
import { uuidSchema } from "./validation";
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/auth/login");
  return { supabase, user };
}
export async function storeAccess(id: string) {
  const { supabase, user } = await requireUser();
  if (!uuidSchema.safeParse(id).success) notFound();
  const { data: member, error } = await supabase
    .from("store_members")
    .select("role")
    .eq("store_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error("Не вдалося перевірити доступ. Спробуйте ще раз.");
  if (!member) notFound();
  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id,name,slug,currency,status")
    .eq("id", id)
    .single();
  if (storeError) throw new Error("Не вдалося отримати магазин.");
  return { supabase, user, member, store };
}
