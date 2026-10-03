import { Field } from "./action-form";
type Product = {
  name: string;
  slug: string;
  description: string | null;
  price: number;
  sku: string | null;
  status: string;
  category_id: string | null;
};
export function ProductFields({
  product,
  categories,
}: {
  product?: Product;
  categories: { id: string; name: string }[];
}) {
  return (
    <>
      <div className="two-col">
        <Field
          name="name"
          label="Назва товару"
          defaultValue={product?.name}
          maxLength={200}
        />
        <Field
          name="slug"
          label="SEO-адреса товару"
          defaultValue={product?.slug}
          maxLength={80}
        />
      </div>
      <label className="field">
        Опис
        <textarea
          name="description"
          maxLength={10000}
          defaultValue={product?.description || ""}
          rows={4}
        />
      </label>
      <div className="two-col">
        <Field
          name="price"
          label="Ціна у валюті магазину"
          type="number"
          min={0}
          step="0.01"
          defaultValue={product?.price}
        />
        <Field
          name="sku"
          label="Артикул (SKU)"
          required={false}
          maxLength={80}
          defaultValue={product?.sku || ""}
        />
      </div>
      <div className="two-col">
        <label className="field">
          Категорія
          <select name="category_id" defaultValue={product?.category_id || ""}>
            <option value="">Без категорії</option>
            {categories.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Статус
          <select name="status" defaultValue={product?.status || "draft"}>
            <option value="draft">Чернетка</option>
            <option value="active">Активний</option>
            <option value="archived">Архів</option>
          </select>
        </label>
      </div>
    </>
  );
}
