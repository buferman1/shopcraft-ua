import { z } from "zod";

export const themeIds = ["minimal", "street", "boutique"] as const;
export type ThemeId = (typeof themeIds)[number];
export const themes = {
  minimal: {
    name: "Minimal",
    description: "Світлий каталог, чітка сітка й багато простору",
    background: "#ffffff",
    foreground: "#192125",
    accent: "#205443",
  },
  street: {
    name: "Street",
    description: "Темна вітрина, великі заголовки й контрастні акценти",
    background: "#151515",
    foreground: "#fafafa",
    accent: "#d8ff3e",
  },
  boutique: {
    name: "Boutique",
    description: "Редакційна композиція, виразна типографіка й колекції",
    background: "#fff8f5",
    foreground: "#42232e",
    accent: "#953756",
  },
} satisfies Record<
  ThemeId,
  {
    name: string;
    description: string;
    background: string;
    foreground: string;
    accent: string;
  }
>;
export const sectionTypes = [
  "hero",
  "categories",
  "products",
  "about",
  "contact",
] as const;
export type SectionType = (typeof sectionTypes)[number];
export const sectionNames: Record<SectionType, string> = {
  hero: "Банер",
  categories: "Категорії",
  products: "Товари",
  about: "Про бренд",
  contact: "Контакти",
};
const hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Колір має бути у форматі #RRGGBB");
const imageUrl = z.union([
  z.literal(""),
  z
    .string()
    .url()
    .max(2048)
    .refine(
      (value) => new URL(value).protocol === "https:",
      "Потрібна HTTPS-адреса зображення",
    ),
]);
export const sectionSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9-]{1,40}$/),
    type: z.enum(sectionTypes),
    enabled: z.boolean(),
    title: z.string().max(120),
    text: z.string().max(1200),
    buttonLabel: z.string().max(40),
    imageUrl,
  })
  .strict();
export const designSchema = z
  .object({
    version: z.literal(1),
    theme: z.enum(themeIds),
    brandName: z.string().trim().min(2).max(120),
    announcement: z.string().max(180),
    background: hex,
    foreground: hex,
    accent: hex,
    font: z.enum(["sans", "serif"]),
    email: z.union([z.literal(""), z.string().email().max(254)]),
    phone: z
      .string()
      .max(40)
      .regex(/^[+\d\s()\-]*$/, "Вкажіть телефон без сторонніх символів"),
    sections: z
      .array(sectionSchema)
      .min(1)
      .max(5)
      .refine(
        (items) =>
          new Set(items.map((s) => s.id)).size === items.length &&
          new Set(items.map((s) => s.type)).size === items.length,
        "Блоки не повинні повторюватися",
      ),
  })
  .strict()
  .refine(
    (d) => contrast(d.background, d.foreground) >= 4.5,
    "Оберіть контрастні кольори тексту й фону (щонайменше 4,5:1)",
  );
export type Design = z.infer<typeof designSchema>;
export type DesignSection = z.infer<typeof sectionSchema>;
export type StoreSummary = {
  id: string;
  name: string;
  slug: string;
  currency: string;
};
export type CatalogProduct = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  category_id: string | null;
  image?: string;
  imageAlt?: string;
};
export type CatalogCategory = { id: string; name: string; slug: string };
export function contrast(a: string, b: string) {
  const luminance = (hex: string) => {
    const rgb = [1, 3, 5]
      .map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const l = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l[0] + 0.05) / (l[1] + 0.05);
}
export function accentText(color: string) {
  return contrast(color, "#ffffff") >= contrast(color, "#111111")
    ? "#ffffff"
    : "#111111";
}
export function newSection(type: SectionType): DesignSection {
  const content: Record<SectionType, [string, string]> = {
    hero: ["Стиль, який обираєш ти", "Відкрий колекцію та знайди своє."],
    products: ["Наша колекція", "Речі для твого щоденного стилю."],
    categories: ["Обери свій напрям", ""],
    about: [
      "Про наш бренд",
      "Розкажіть про себе, свої цінності та особливості колекції.",
    ],
    contact: ["Залишаймося на зв’язку", "Звертайтеся — допоможемо з вибором."],
  };
  return {
    id: type,
    type,
    enabled: true,
    title: content[type][0],
    text: content[type][1],
    buttonLabel: "Переглянути колекцію",
    imageUrl: "",
  };
}
export function defaultDesign(
  name: string,
  theme: ThemeId = "minimal",
): Design {
  return {
    version: 1,
    theme,
    brandName: name,
    announcement: "",
    background: themes[theme].background,
    foreground: themes[theme].foreground,
    accent: themes[theme].accent,
    font: theme === "boutique" ? "serif" : "sans",
    email: "",
    phone: "",
    sections: (theme === "boutique"
      ? ["hero", "about", "categories", "products", "contact"]
      : ["hero", "categories", "products", "about", "contact"]
    ).map((type) => newSection(type as SectionType)),
  };
}
export function applyTheme(design: Design, theme: ThemeId): Design {
  return {
    ...design,
    theme,
    background: themes[theme].background,
    foreground: themes[theme].foreground,
    accent: themes[theme].accent,
    font: theme === "boutique" ? "serif" : "sans",
  };
}
export function moveSection(
  sections: DesignSection[],
  id: string,
  target: number,
) {
  const from = sections.findIndex((section) => section.id === id);
  if (from < 0 || target < 0 || target >= sections.length) return sections;
  const result = [...sections];
  const [section] = result.splice(from, 1);
  result.splice(target, 0, section);
  return result;
}
