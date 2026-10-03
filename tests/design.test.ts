import { describe, expect, it } from "vitest";
import { formatPrice } from "../src/lib/price";
import {
  defaultDesign,
  designSchema,
  themeIds,
  applyTheme,
  moveSection,
} from "../src/lib/design";

describe("store designs", () => {
  it("formats Ukrainian prices without runtime-dependent currency labels", () => {
    expect(formatPrice(790, "UAH")).toBe("790,00\u00a0₴");
    expect(formatPrice(12450.5, "EUR")).toBe("12\u00a0450,50\u00a0€");
  });
  it("creates ten valid distinct themes and preserves merchant content when switching", () => {
    const designs = themeIds.map((theme) => defaultDesign("Мій бренд", theme));
    designs.forEach((design) =>
      expect(designSchema.safeParse(design).success).toBe(true),
    );
    expect(new Set(designs.map((d) => d.background)).size).toBe(10);
    const original = designs[0];
    original.sections[0].title = "Моя колекція";
    const switched = applyTheme(original, "boutique");
    expect(switched.sections).toEqual(original.sections);
    expect(switched.brandName).toBe("Мій бренд");
    expect(switched.font).toBe("serif");
  });
  it("moves blocks without losing their content", () => {
    const sections = defaultDesign("Магазин").sections;
    const reordered = moveSection(sections, "contact", 0);
    expect(reordered[0]).toEqual(sections[4]);
    expect(reordered).toHaveLength(5);
    expect(sections[0].id).toBe("hero");
  });
  it("refuses executable URLs, unknown themes, duplicate blocks and unreadable colors", () => {
    const design = defaultDesign("Магазин");
    expect(
      designSchema.safeParse({ ...design, theme: "injected" }).success,
    ).toBe(false);
    expect(
      designSchema.safeParse({
        ...design,
        sections: [design.sections[0], design.sections[0]],
      }).success,
    ).toBe(false);
    expect(
      designSchema.safeParse({ ...design, foreground: design.background })
        .success,
    ).toBe(false);
    const sections = [
      { ...design.sections[0], imageUrl: "javascript:alert(1)" },
    ];
    expect(designSchema.safeParse({ ...design, sections }).success).toBe(false);
    expect(
      designSchema.safeParse({ ...design, phone: '1"onclick="alert(1)' })
        .success,
    ).toBe(false);
  });
});
