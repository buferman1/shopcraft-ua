"use client";
import Image from "next/image";
import { useState } from "react";
import { formatPrice } from "@/lib/price";
import type { CatalogProduct } from "@/lib/design";

export type PublicVariant = {
  id: string;
  title: string;
  price: number | null;
  inventory_quantity: number;
  options: { size?: string; color?: string };
};
export function StorefrontProduct({
  product,
  images,
  variants,
  currency,
}: {
  product: CatalogProduct;
  images: { path: string; alt: string }[];
  variants: PublicVariant[];
  currency: string;
}) {
  const [selected, setSelected] = useState(variants[0]?.id || "");
  const [imageIndex, setImageIndex] = useState(0);
  const variant = variants.find((v) => v.id === selected);
  const image = images[imageIndex];
  return (
    <div className="sf-product-detail">
      <div>
        <div className="sf-detail-image">
          {image ? (
            <Image
              src={image.path}
              alt={image.alt || product.name}
              width={1000}
              height={1200}
              unoptimized
              priority
            />
          ) : (
            <span>Фото готується</span>
          )}
        </div>
        {images.length > 1 && (
          <div className="sf-gallery">
            {images.map((item, index) => (
              <button
                key={item.path}
                aria-label={`Фото ${index + 1}`}
                aria-pressed={imageIndex === index}
                onClick={() => setImageIndex(index)}
              >
                <Image
                  src={item.path}
                  alt={item.alt || product.name}
                  width={100}
                  height={120}
                  unoptimized
                />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="sf-detail-copy">
        <p className="sf-kicker">Колекція</p>
        <h1>{product.name}</h1>
        <p className="sf-detail-price">
          {formatPrice(variant?.price ?? product.price, currency)}
        </p>
        <p className="sf-description">{product.description}</p>
        {variants.length > 0 && (
          <label className="sf-variant-label">
            Розмір і колір
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title}
                  {v.inventory_quantity === 0 ? " · Немає в наявності" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        {variant && (
          <p role="status">
            {variant.inventory_quantity > 0
              ? "Є в наявності"
              : "Немає в наявності"}
          </p>
        )}
        <p className="sf-catalog-note">
          Вітрина каталогу. Онлайн-замовлення ще не доступне.
        </p>
      </div>
    </div>
  );
}
