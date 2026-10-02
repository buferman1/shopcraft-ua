import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/price";
import type { CSSProperties, ReactNode } from "react";
import {
  accentText,
  type Design,
  type CatalogProduct,
  type CatalogCategory,
  type StoreSummary,
} from "@/lib/design";

export function StorefrontShell({
  design,
  store,
  children,
}: {
  design: Design;
  store: StoreSummary;
  children: ReactNode;
}) {
  const style = {
    "--sf-bg": design.background,
    "--sf-fg": design.foreground,
    "--sf-accent": design.accent,
    "--sf-button-text": accentText(design.accent),
    "--sf-font":
      design.font === "serif"
        ? "Georgia, 'Times New Roman', serif"
        : "Arial, Helvetica, sans-serif",
  } as CSSProperties;
  return (
    <div className={`storefront sf-${design.theme}`} style={style}>
      {design.announcement && (
        <div className="sf-announcement">{design.announcement}</div>
      )}
      <header className="sf-header">
        <a className="sf-brand" href={`/shop/${store.slug}`}>
          {design.brandName}
        </a>
        <nav aria-label="Навігація магазину">
          <a href={`/shop/${store.slug}#products`}>Колекція</a>
          {design.sections.some((s) => s.type === "contact" && s.enabled) && (
            <a href={`/shop/${store.slug}#contact`}>Контакти</a>
          )}
        </nav>
      </header>
      {children}
      <footer className="sf-footer">
        <span>
          © {new Date().getFullYear()} {design.brandName}
        </span>
        <Link href="/">Створено з ShopCraft</Link>
      </footer>
    </div>
  );
}

export function Storefront({
  design,
  store,
  products,
  categories,
  preview = false,
  selectedSection,
  onSelectSection,
}: {
  design: Design;
  store: StoreSummary;
  products: CatalogProduct[];
  categories: CatalogCategory[];
  preview?: boolean;
  selectedSection?: string;
  onSelectSection?: (id: string) => void;
}) {
  return (
    <StorefrontShell design={design} store={store}>
      <div
        onClickCapture={
          preview
            ? (event) => {
                const section = (
                  event.target as HTMLElement
                ).closest<HTMLElement>("[data-section]");
                event.preventDefault();
                if (section) onSelectSection?.(section.dataset.section!);
              }
            : undefined
        }
      >
        {design.sections
          .filter((section) => section.enabled)
          .map((section) => (
            <section
              key={section.id}
              id={
                section.type === "products"
                  ? "products"
                  : section.type === "contact"
                    ? "contact"
                    : undefined
              }
              data-section={section.id}
              className={`sf-section sf-section-${section.type} ${preview ? "sf-editable" : ""} ${selectedSection === section.id ? "sf-selected" : ""}`}
            >
              {preview && (
                <button
                  className="sf-edit-label"
                  type="button"
                  onClick={() => onSelectSection?.(section.id)}
                >
                  Редагувати: {section.title || section.type}
                </button>
              )}
              {section.type === "hero" ? (
                <div
                  className={`sf-hero ${section.imageUrl ? "sf-hero-with-image" : ""}`}
                >
                  <div className="sf-hero-copy">
                    <p className="sf-kicker">{design.brandName} · Колекція</p>
                    <h1>{section.title}</h1>
                    {section.text && <p className="sf-lead">{section.text}</p>}
                    <a className="sf-button" href="#products">
                      {section.buttonLabel || "Переглянути колекцію"}
                    </a>
                  </div>
                  {section.imageUrl && (
                    <div className="sf-hero-media">
                      <Image
                        src={section.imageUrl}
                        alt={section.title || design.brandName}
                        width={1000}
                        height={1200}
                        unoptimized
                        priority
                      />
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="sf-section-heading">
                    <h2>{section.title}</h2>
                    {section.text && <p>{section.text}</p>}
                  </div>
                  {section.type === "categories" &&
                    (categories.length ? (
                      <div className="sf-categories">
                        {categories.map((category, index) => (
                          <a
                            key={category.id}
                            href={`/shop/${store.slug}?category=${category.slug}#products`}
                          >
                            <span className="sf-category-number">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <span>{category.name}</span>
                            <span aria-hidden="true">↗</span>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="sf-empty">
                        Категорії з’являться тут після додавання в каталог.
                      </p>
                    ))}
                  {section.type === "products" &&
                    (products.length ? (
                      <div className="sf-products">
                        {products.map((product) => (
                          <a
                            className="sf-product"
                            key={product.id}
                            href={`/shop/${store.slug}/products/${product.slug}`}
                          >
                            <div className="sf-product-media">
                              {product.image ? (
                                <Image
                                  src={product.image}
                                  alt={product.imageAlt || product.name}
                                  width={600}
                                  height={800}
                                  unoptimized
                                />
                              ) : (
                                <span className="sf-no-image">
                                  Фото готується
                                </span>
                              )}
                            </div>
                            <div className="sf-product-caption">
                              <h3>{product.name}</h3>
                              <p>
                                {formatPrice(product.price, store.currency)}
                              </p>
                            </div>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="sf-empty">
                        Колекція готується. Завітайте згодом.
                      </p>
                    ))}
                  {section.type === "contact" && (
                    <div className="sf-contact">
                      {design.email && (
                        <a href={`mailto:${design.email}`}>{design.email}</a>
                      )}
                      {design.phone && (
                        <a href={`tel:${design.phone.replace(/[\s()]/g, "")}`}>
                          {design.phone}
                        </a>
                      )}
                      {!design.email && !design.phone && preview && (
                        <p>Додайте email або телефон у налаштуваннях бренду.</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>
          ))}
      </div>
    </StorefrontShell>
  );
}
