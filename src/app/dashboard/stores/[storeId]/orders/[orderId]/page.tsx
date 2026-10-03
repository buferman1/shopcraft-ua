import Link from "next/link";
import { notFound } from "next/navigation";
import { storeAccess } from "@/lib/access";
import { uuidSchema } from "@/lib/validation";
import { orderLabels, transitions } from "@/lib/commerce";
import { formatPrice } from "@/lib/price";
import { ActionForm } from "@/components/action-form";
import { updateOrderStatus } from "@/app/dashboard/commerce-actions";
export default async function OrderPage({
  params,
}: {
  params: Promise<{ storeId: string; orderId: string }>;
}) {
  const { storeId, orderId } = await params;
  const { supabase, member } = await storeAccess(storeId);
  if (
    !uuidSchema.safeParse(orderId).success ||
    !["owner", "admin", "manager", "support"].includes(member.role)
  )
    notFound();
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id,status,currency,subtotal,shipping_total,total,buyer_name,buyer_phone,buyer_email,shipping_method,shipping_address,buyer_note,inventory_reserved",
    )
    .eq("store_id", storeId)
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error("Не вдалося отримати замовлення");
  if (!order) notFound();
  const [items, events] = await Promise.all([
    supabase
      .from("order_items")
      .select("id,title,quantity,unit_price,line_total")
      .eq("store_id", storeId)
      .eq("order_id", orderId),
    supabase
      .from("order_events")
      .select("id,status,created_at")
      .eq("store_id", storeId)
      .eq("order_id", orderId)
      .order("created_at"),
  ]);
  if (items.error || events.error)
    throw new Error("Не вдалося отримати позиції замовлення");
  const allowed = transitions[order.status] || [];
  return (
    <>
      <Link className="text-link" href={`/dashboard/stores/${storeId}/orders`}>
        ← Замовлення
      </Link>
      <div className="page-head">
        <div>
          <p className="eyebrow">{orderLabels[order.status]}</p>
          <h1>Замовлення {order.id.slice(0, 8)}</h1>
        </div>
      </div>
      <div className="commerce-grid">
        <section className="card">
          <h2>Покупець</h2>
          <p>{order.buyer_name}</p>
          <p>{order.buyer_phone}</p>
          <p>{order.buyer_email}</p>
          <h2>Отримання</h2>
          <p>
            {order.shipping_method === "pickup" ? "Самовивіз" : "Доставка"}:{" "}
            {order.shipping_address}
          </p>
          <p>{order.buyer_note}</p>
          <p className="notice">
            Оплата узгоджується вручну. Цей статус не підтверджує отримання
            коштів.
          </p>
          <h2>Залишки</h2>
          <p>
            {order.inventory_reserved
              ? "Списано під час підтвердження"
              : "Не списані або вже повернуті"}
          </p>
          <p className="muted">Для друку використайте меню браузера.</p>
        </section>
        <section className="card">
          <h2>Товари</h2>
          {items.data?.map((item) => (
            <div className="cart-row" key={item.id}>
              <div>
                {item.title}
                <p>
                  {item.quantity} ×{" "}
                  {formatPrice(Number(item.unit_price), order.currency)}
                </p>
              </div>
              <strong>
                {formatPrice(Number(item.line_total), order.currency)}
              </strong>
            </div>
          ))}
          <p>
            Доставка:{" "}
            {formatPrice(Number(order.shipping_total), order.currency)}
          </p>
          <h2>Разом: {formatPrice(Number(order.total), order.currency)}</h2>
          {allowed.length > 0 &&
            ["owner", "admin", "manager"].includes(member.role) && (
              <ActionForm
                action={updateOrderStatus.bind(null, storeId, orderId)}
                label="Змінити статус"
              >
                <label className="field">
                  Наступний статус
                  <select name="status">
                    {allowed.map((s) => (
                      <option key={s} value={s}>
                        {orderLabels[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <p>
                  Підтвердження списує залишки. Скасування та повернення
                  відновлюють їх один раз.
                </p>
              </ActionForm>
            )}
          <h2>Історія</h2>
          <ol>
            {events.data?.map((event) => (
              <li key={event.id}>
                {orderLabels[event.status]} ·{" "}
                {new Date(event.created_at).toLocaleString("uk-UA", {
                  timeZone: "Europe/Kyiv",
                })}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
