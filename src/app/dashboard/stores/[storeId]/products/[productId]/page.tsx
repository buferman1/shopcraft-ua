import Image from "next/image";
import { uploadProductImage, updateInventory } from "../../../../media-actions";
import Link from "next/link";
import { notFound } from "next/navigation";
import { storeAccess } from "@/lib/access";
import { canEditCatalog, uuidSchema } from "@/lib/validation";
import { ActionForm, Field } from "@/components/action-form";
import { ProductFields } from "@/components/product-fields";
import { saveProduct, addVariant } from "../../../../actions";
export default async function ProductPage({
  params,
}: {
  params: Promise<{ storeId: string; productId: string }>;
}) {
  const { storeId, productId } = await params;
  if (!uuidSchema.safeParse(productId).success) notFound();
  const { supabase, store, member } = await storeAccess(storeId);
  const [
    { data: product, error: pe },
    { data: categories, error: ce },
    { data: variants, error: ve },
  ] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .eq("store_id", storeId)
      .maybeSingle(),
    supabase.from("categories").select("id,name").eq("store_id", storeId),
    supabase
      .from("product_variants")
      .select("id,title,sku,inventory_quantity,options")
      .eq("product_id", productId)
      .eq("store_id", storeId),
  ]);
  if (pe || ce || ve) throw new Error("Не вдалося отримати товар.");
  if (!product) notFound();
  const { data: images, error: imageError } = await supabase
    .from("product_images")
    .select("id,path,alt")
    .eq("product_id", productId)
    .eq("store_id", storeId)
    .order("created_at");
  if (imageError) throw new Error("Не вдалося завантажити фото.");
  const editable = canEditCatalog(member.role) && store.status !== "suspended";
  return (
    <>
      <Link className="text-link" href={"/dashboard/stores/" + storeId}>
        ← {store.name}
      </Link>
      <h1>{product.name}</h1>
      <section className="card">
        {editable ? (
          <ActionForm action={saveProduct.bind(null, storeId, productId)}>
            <ProductFields product={product} categories={categories || []} />
          </ActionForm>
        ) : (
          <p>
            Ваша роль дозволяє лише перегляд. Ціна: {product.price}{" "}
            {store.currency}
          </p>
        )}
      </section>
      <section className="card">
        <h2>Фотографії</h2>
        <div className="store-grid">
          {images?.map((image) => (
            <Image
              key={image.id}
              src={
                supabase.storage.from("store-media").getPublicUrl(image.path)
                  .data.publicUrl
              }
              alt={image.alt || product.name}
              width={240}
              height={300}
              unoptimized
              style={{ objectFit: "contain", maxWidth: "100%", height: 240 }}
            />
          ))}
        </div>
        {editable && (
          <ActionForm
            action={uploadProductImage.bind(null, storeId, productId)}
            label="Завантажити фото"
          >
            <label className="field">
              Фото до 5 МБ
              <input
                type="file"
                name="image"
                accept="image/png,image/jpeg,image/webp"
                required
              />
            </label>
            <Field
              name="alt"
              label="Опис фотографії"
              required={false}
              maxLength={160}
            />
          </ActionForm>
        )}
      </section>
      <section className="card">
        <h2>Варіанти та залишки</h2>
        {variants?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Варіант</th>
                  <th>SKU</th>
                  <th>Залишок</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v.id}>
                    <td>{v.title}</td>
                    <td>{v.sku}</td>
                    <td>
                      {editable ? (
                        <ActionForm
                          action={updateInventory.bind(
                            null,
                            storeId,
                            productId,
                            v.id,
                          )}
                          label="Оновити"
                        >
                          <Field
                            name="quantity"
                            label="Залишок"
                            type="number"
                            min={0}
                            step="1"
                            defaultValue={v.inventory_quantity}
                          />
                        </ActionForm>
                      ) : (
                        v.inventory_quantity
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">Додайте розміри й кольори товару.</p>
        )}
        {editable && (
          <ActionForm
            action={addVariant.bind(null, storeId, productId)}
            label="Додати варіант"
          >
            <div className="two-col">
              <Field name="title" label="Назва варіанта" maxLength={120} />
              <Field
                name="sku"
                label="Унікальний SKU варіанта"
                maxLength={80}
              />
              <Field
                name="size"
                label="Розмір"
                required={false}
                maxLength={30}
              />
              <Field
                name="color"
                label="Колір"
                required={false}
                maxLength={50}
              />
              <Field
                name="inventory_quantity"
                label="Залишок"
                type="number"
                min={0}
                step="1"
                defaultValue={0}
              />
            </div>
          </ActionForm>
        )}
      </section>
    </>
  );
}
