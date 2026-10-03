"use client";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useCart, writeCart } from "@/lib/cart-store";
import { formatPrice } from "@/lib/price";
import type { CommerceSettings } from "@/lib/commerce";
import { placeOrder } from "@/app/shop/actions";

export function CartLink({ storeId, slug }: { storeId: string; slug: string }) {
  const cart = useCart(storeId);
  return (
    <Link href={`/shop/${slug}/cart`}>
      Кошик{cart.length ? ` (${cart.reduce((s, i) => s + i.quantity, 0)})` : ""}
    </Link>
  );
}
export function Cart({
  storeId,
  slug,
  currency,
  settings,
}: {
  storeId: string;
  slug: string;
  currency: string;
  settings: CommerceSettings;
}) {
  const cart = useCart(storeId);
  const [method, setMethod] = useState(
    settings.pickup_enabled ? "pickup" : "delivery",
  );
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{
    id: string;
    total: number;
    currency: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const request = useRef<{ signature: string; token: string } | null>(null);
  const shipping = method === "delivery" ? settings.shipping_fee : 0;
  const subtotal =
    cart.reduce((sum, i) => sum + Math.round(i.price * 100) * i.quantity, 0) /
    100;
  function submit(data: FormData) {
    setError("");
    if (data.get("website")) {
      setError("Не вдалося надіслати форму");
      return;
    }
    const input = {
      name: String(data.get("name") || ""),
      phone: String(data.get("phone") || ""),
      email: String(data.get("email") || ""),
      method,
      address: String(data.get("address") || ""),
      note: String(data.get("note") || ""),
      consent: data.get("consent") === "on",
      items: cart.map((i) => ({
        variantId: i.variantId,
        quantity: i.quantity,
      })),
    };
    const signature = JSON.stringify(input);
    if (!request.current || request.current.signature !== signature)
      request.current = { signature, token: crypto.randomUUID() };
    const token = request.current.token;
    startTransition(async () => {
      try {
        const result = await placeOrder(slug, { ...input, token });
        if (result.error) setError(result.error);
        if (result.order) {
          setSuccess(result.order);
          try {
            writeCart(storeId, []);
          } catch {}
        }
      } catch {
        setError(
          "З’єднання перервано. Спробуйте ще раз із тими самими даними — повторний запит не створить дублікат.",
        );
      }
    });
  }
  if (success)
    return (
      <section className="commerce-panel">
        <p className="eyebrow">ЗАМОВЛЕННЯ ПРИЙНЯТО</p>
        <h1>Дякуємо!</h1>
        <p>
          Номер: <strong>{success.id}</strong>
        </p>
        <p>Сума: {formatPrice(success.total, success.currency)}</p>
        <p>
          Продавець зв’яжеться з вами для підтвердження наявності, доставки та
          оплати. Оплата онлайн не проводилась.
        </p>
        <Link className="button" href={`/shop/${slug}`}>
          Повернутися до магазину
        </Link>
      </section>
    );
  return (
    <div className="commerce-panel">
      <h1>Кошик</h1>
      {!cart.length ? (
        <>
          <p>Кошик поки порожній.</p>
          <Link className="button" href={`/shop/${slug}#products`}>
            До колекції
          </Link>
        </>
      ) : (
        <div className="commerce-grid">
          <section aria-label="Товари в кошику">
            {cart.map((item) => (
              <article className="cart-row" key={item.variantId}>
                <div>
                  <Link href={`/shop/${slug}/products/${item.slug}`}>
                    {item.name}
                  </Link>
                  <p>{item.variant}</p>
                  <strong>{formatPrice(item.price, currency)}</strong>
                </div>
                <label>
                  Кількість
                  <input
                    aria-label={`Кількість: ${item.name} ${item.variant}`}
                    type="number"
                    min={1}
                    max={20}
                    value={item.quantity}
                    disabled={pending}
                    onChange={(e) => {
                      const quantity = Number(e.target.value);
                      if (
                        Number.isInteger(quantity) &&
                        quantity >= 1 &&
                        quantity <= 20
                      ) {
                        try {
                          writeCart(
                            storeId,
                            cart.map((i) =>
                              i.variantId === item.variantId
                                ? { ...i, quantity }
                                : i,
                            ),
                          );
                        } catch {
                          setError("Дозвольте збереження даних у браузері");
                        }
                      }
                    }}
                  />
                </label>
                <button
                  disabled={pending}
                  className="button secondary"
                  onClick={() => {
                    try {
                      writeCart(
                        storeId,
                        cart.filter((i) => i.variantId !== item.variantId),
                      );
                    } catch {
                      setError("Не вдалося оновити кошик");
                    }
                  }}
                >
                  Видалити
                </button>
              </article>
            ))}
            <p>Товари: {formatPrice(subtotal, currency)}</p>
            <p>Доставка: {formatPrice(shipping, currency)}</p>
            <h2>Орієнтовно: {formatPrice(subtotal + shipping, currency)}</h2>
            <p className="muted">
              Ціни та залишки перевіряються повторно під час оформлення. Товар
              резервується після підтвердження продавцем.
            </p>
          </section>
          <section>
            <h2>Оформлення</h2>
            {!settings.orders_enabled ? (
              <p role="status">
                Продавець ще не ввімкнув приймання замовлень. Кошик збережено.
              </p>
            ) : (
              <form action={submit} className="form-stack">
                <fieldset disabled={pending}>
                  <label className="field">
                    Ім’я
                    <input
                      name="name"
                      autoComplete="name"
                      required
                      minLength={2}
                      maxLength={120}
                    />
                  </label>
                  <label className="field">
                    Телефон
                    <input
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      required
                      maxLength={25}
                    />
                  </label>
                  <label className="field">
                    Email (необов’язково)
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      maxLength={254}
                    />
                  </label>
                  <label className="field">
                    Отримання
                    <select
                      value={method}
                      onChange={(e) => setMethod(e.target.value)}
                    >
                      {settings.pickup_enabled && (
                        <option value="pickup">Самовивіз</option>
                      )}
                      {settings.delivery_enabled && (
                        <option value="delivery">
                          Доставка — ручне узгодження
                        </option>
                      )}
                    </select>
                  </label>
                  {method === "pickup" ? (
                    <p>Самовивіз: {settings.pickup_address}</p>
                  ) : (
                    <label className="field">
                      Місто, адреса або відділення
                      <textarea
                        name="address"
                        required
                        minLength={5}
                        maxLength={500}
                      />
                    </label>
                  )}
                  <label className="field">
                    Коментар
                    <textarea name="note" maxLength={1000} />
                  </label>
                  <label className="honeypot" aria-hidden="true">
                    Website
                    <input name="website" tabIndex={-1} autoComplete="off" />
                  </label>
                  <label className="consent-label">
                    <input type="checkbox" name="consent" required />
                    Дозволяю передати мої контактні дані продавцю для обробки
                    цього замовлення.
                  </label>
                  <p>
                    Оплата після узгодження з продавцем. Дані картки не
                    потрібні.
                  </p>
                </fieldset>
                <button className="button" disabled={pending}>
                  {pending ? "Надсилання…" : "Надіслати замовлення"}
                </button>
              </form>
            )}
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
