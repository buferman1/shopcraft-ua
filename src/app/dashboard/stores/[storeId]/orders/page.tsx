import Link from "next/link";
import { storeAccess } from "@/lib/access";
import { orderLabels } from "@/lib/commerce";
import { formatPrice } from "@/lib/price";
export default async function OrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { storeId } = await params;
  const { supabase, store, member } = await storeAccess(storeId);
  if (!["owner", "admin", "manager", "support"].includes(member.role))
    return <p>Немає доступу до замовлень.</p>;
  const search = await searchParams;
  const status = Object.keys(orderLabels).includes(search.status || "")
    ? search.status!
    : "";
  const pageInput = Number(search.page || 1);
  const page =
    Number.isInteger(pageInput) && pageInput > 0
      ? Math.min(pageInput, 100000)
      : 1;
  let query = supabase
    .from("orders")
    .select("id,status,total,currency,created_at", { count: "exact" })
    .eq("store_id", storeId);
  if (status) query = query.eq("status", status);
  const [{ data, error, count }, summary] = await Promise.all([
    query
      .order("created_at", { ascending: false })
      .order("id")
      .range((page - 1) * 25, page * 25 - 1),
    supabase.rpc("order_summary", { target_store: storeId }),
  ]);
  if (error || summary.error)
    throw new Error("Не вдалося завантажити замовлення");
  const stats = summary.data || {
    orders: 0,
    new_orders: 0,
    completed_total: 0,
  };
  const pages = Math.max(1, Math.ceil((count || 0) / 25));
  const url = (p: number) =>
    "?" + new URLSearchParams({ status, page: String(p) });
  return (
    <>
      <Link className="text-link" href={`/dashboard/stores/${storeId}`}>
        ← Каталог
      </Link>
      <div className="page-head">
        <div>
          <p className="eyebrow">ПРОДАЖІ</p>
          <h1>Замовлення · {store.name}</h1>
        </div>
      </div>
      <div className="sales-stats">
        <section className="card">
          <p>Усі замовлення</p>
          <h2>{stats.orders}</h2>
        </section>
        <section className="card">
          <p>Нові</p>
          <h2>{stats.new_orders}</h2>
        </section>
        <section className="card">
          <p>Сума завершених замовлень</p>
          <h2>{formatPrice(Number(stats.completed_total), store.currency)}</h2>
          <small>Не звіт про отриману оплату</small>
        </section>
      </div>
      <section className="card">
        <form method="get" className="design-toolbar-actions">
          <label className="field">
            Статус
            <select name="status" defaultValue={status}>
              <option value="">Усі</option>
              {Object.entries(orderLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button className="button secondary">Застосувати</button>
        </form>
        {data?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Номер</th>
                  <th>Дата</th>
                  <th>Статус</th>
                  <th>Сума</th>
                </tr>
              </thead>
              <tbody>
                {data.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link
                        className="text-link"
                        href={`/dashboard/stores/${storeId}/orders/${order.id}`}
                      >
                        {order.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td>
                      {new Date(order.created_at).toLocaleString("uk-UA", {
                        timeZone: "Europe/Kyiv",
                      })}
                    </td>
                    <td>{orderLabels[order.status] || order.status}</td>
                    <td>{formatPrice(Number(order.total), order.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">
            Замовлень поки немає. Опублікуйте вітрину й увімкніть приймання в
            налаштуваннях.
          </p>
        )}
        <p>
          Сторінка {page} з {pages}
        </p>
        <nav className="auth-links" aria-label="Сторінки замовлень">
          {page > 1 && <Link href={url(page - 1)}>← Попередня</Link>}
          {page < pages && <Link href={url(page + 1)}>Наступна →</Link>}
        </nav>
      </section>
    </>
  );
}
