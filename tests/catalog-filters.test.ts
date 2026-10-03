import { describe, expect, it } from "vitest";
import { catalogRange, parseCatalogFilters } from "../src/lib/catalog-filters";
import { defaultDesign, designSchema, newSection } from "../src/lib/design";
describe("expanded builder and catalog", () => {
  it("paginates 525 products exactly once without truncating at 100 or 500", () => {
    const products = Array.from({ length: 525 }, (_, i) => i);
    const read = Array.from(
      { length: Math.ceil(products.length / 24) },
      (_, i) => {
        const [start, end] = catalogRange(i + 1, 24);
        return products.slice(start, end + 1);
      },
    ).flat();
    expect(read).toEqual(products);
    expect(catalogRange(-1, 10000)).toEqual([0, 99]);
  });
  it("normalizes filter bounds and rejects invalid prices and sort injection", () => {
    expect(
      parseCatalogFilters({
        min: "800",
        max: "100",
        sort: "price-desc",
        stock: "1",
      }),
    ).toMatchObject({
      minPrice: 100,
      maxPrice: 800,
      sort: "price-desc",
      inStock: true,
    });
    expect(
      parseCatalogFilters({ min: "NaN", max: "-1", sort: "sql" }),
    ).toMatchObject({
      minPrice: undefined,
      maxPrice: undefined,
      sort: "newest",
    });
  });
  it("accepts 30 repeatable blocks, rejects 31 and executable links", () => {
    const design = defaultDesign("ShopCraft QA");
    const sections = Array.from({ length: 30 }, (_, i) => ({
      ...newSection("promo"),
      id: `promo-${i}`,
    }));
    expect(designSchema.safeParse({ ...design, sections }).success).toBe(true);
    expect(
      designSchema.safeParse({
        ...design,
        sections: [...sections, { ...sections[0], id: "31" }],
      }).success,
    ).toBe(false);
    for (const buttonUrl of [
      "javascript:alert(1)",
      "//evil.example",
      "/\\evil.example",
      "data:text/html,x",
    ])
      expect(
        designSchema.safeParse({
          ...design,
          sections: [{ ...sections[0], buttonUrl }],
        }).success,
      ).toBe(false);
    for (const buttonUrl of [
      "https://example.com/collection",
      "/shop/demo/catalog",
      "#products",
    ])
      expect(
        designSchema.safeParse({
          ...design,
          sections: [{ ...sections[0], buttonUrl }],
        }).success,
      ).toBe(true);
  });
});
