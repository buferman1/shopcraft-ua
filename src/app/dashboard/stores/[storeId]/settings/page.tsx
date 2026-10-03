import Link from "next/link";
import { storeAccess } from "@/lib/access";
import { defaultSettings } from "@/lib/commerce";
import { ActionForm, Field } from "@/components/action-form";
import { saveCommerceSettings } from "@/app/dashboard/commerce-actions";
export default async function SettingsPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const { supabase, store, member } = await storeAccess(storeId);
  if (!["owner", "admin"].includes(member.role))
    return <p>Налаштування доступні власнику й адміністратору.</p>;
  const { data, error } = await supabase
    .from("store_settings")
    .select(
      "orders_enabled,pickup_enabled,delivery_enabled,shipping_fee,pickup_address,seo_title,seo_description",
    )
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) throw new Error("Не вдалося завантажити налаштування");
  const settings = data || defaultSettings;
  return (
    <>
      <Link className="text-link" href={`/dashboard/stores/${storeId}`}>
        ← Каталог
      </Link>
      <div className="page-head">
        <div>
          <p className="eyebrow">НАЛАШТУВАННЯ</p>
          <h1>{store.name}</h1>
        </div>
      </div>
      <section className="card">
        <h2>Замовлення й отримання</h2>
        <p>
          Онлайн-оплата та інтеграції перевізників ще не підключені. Продавець
          узгоджує оплату й доставку вручну. Приймання замовлень працює тільки
          для опублікованого магазину.
        </p>
        <ActionForm action={saveCommerceSettings.bind(null, storeId)}>
          <label className="consent-label">
            <input
              type="checkbox"
              name="orders_enabled"
              defaultChecked={settings.orders_enabled}
            />
            Приймати замовлення
          </label>
          <label className="consent-label">
            <input
              type="checkbox"
              name="pickup_enabled"
              defaultChecked={settings.pickup_enabled}
            />
            Самовивіз
          </label>
          <Field
            label="Адреса самовивозу"
            name="pickup_address"
            defaultValue={settings.pickup_address}
            required={false}
            maxLength={500}
          />
          <label className="consent-label">
            <input
              type="checkbox"
              name="delivery_enabled"
              defaultChecked={settings.delivery_enabled}
            />
            Доставка з ручним узгодженням
          </label>
          <Field
            label={`Фіксована доставка (${store.currency})`}
            name="shipping_fee"
            type="number"
            min={0}
            step="0.01"
            defaultValue={settings.shipping_fee}
          />
          <h2>Метадані вітрини</h2>
          <p className="muted">
            Заголовок і опис сторінки. Preview поки закритий від індексації;
            повний SEO-запуск потребує production-адреси.
          </p>
          <Field
            label="SEO-заголовок"
            name="seo_title"
            required={false}
            maxLength={70}
            defaultValue={settings.seo_title}
          />
          <Field
            label="SEO-опис"
            name="seo_description"
            required={false}
            maxLength={160}
            defaultValue={settings.seo_description}
          />
        </ActionForm>
      </section>
    </>
  );
}
