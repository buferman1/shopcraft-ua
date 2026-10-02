import Link from "next/link";
import { storeAccess } from "@/lib/access";
import { defaultDesign, designSchema } from "@/lib/design";
import { loadCatalog } from "@/lib/catalog";
import { canEditCatalog } from "@/lib/validation";
import { DesignEditor } from "@/components/design-editor";

export default async function DesignPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const { supabase, store, member } = await storeAccess(storeId);
  const [draft, published, catalog] = await Promise.all([
    supabase
      .from("store_designs")
      .select("config,revision")
      .eq("store_id", storeId)
      .maybeSingle(),
    supabase
      .from("storefronts")
      .select("revision")
      .eq("store_id", storeId)
      .maybeSingle(),
    loadCatalog(supabase, storeId),
  ]);
  if (draft.error || published.error)
    throw new Error("Не вдалося завантажити оформлення.");
  const parsed = designSchema.safeParse(draft.data?.config);
  if (draft.data && !parsed.success)
    throw new Error("Збережене оформлення має непідтримуваний формат.");
  return (
    <>
      <Link className="text-link" href={`/dashboard/stores/${storeId}`}>
        ← Каталог магазину
      </Link>
      <DesignEditor
        store={store}
        initialDesign={parsed.success ? parsed.data : defaultDesign(store.name)}
        initialRevision={Number(draft.data?.revision || 0)}
        initialPublishedRevision={
          published.data ? Number(published.data.revision) : null
        }
        products={catalog.products}
        categories={catalog.categories}
        editable={canEditCatalog(member.role) && store.status !== "suspended"}
        canPublish={
          ["owner", "admin"].includes(member.role) &&
          store.status !== "suspended"
        }
      />
    </>
  );
}
