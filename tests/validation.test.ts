import { describe, it, expect } from "vitest";
import {
  moneySchema,
  slugSchema,
  productSchema,
  variantSchema,
  passwordSchema,
  loginPasswordSchema,
  callbackDestination,
  canEditCatalog,
} from "../src/lib/validation";
import { imageFormat } from "../src/lib/media";
describe("catalog validation", () => {
  it.each(["-1", "1.001", "Infinity", "NaN", "1e3", "100000000"])(
    "rejects invalid price %s",
    (v) => expect(moneySchema.safeParse(v).success).toBe(false),
  );
  it.each(["0", "12.99", "99999999.99"])("accepts decimal price %s", (v) =>
    expect(moneySchema.parse(v)).toBe(Number(v)),
  );
  it.each(["../store", "UPPER", "a--b", "-abc", "abc/def"])(
    "rejects invalid slug %s",
    (v) => expect(slugSchema.safeParse(v).success).toBe(false),
  );
  it("refuses extra price precision in product", () =>
    expect(
      productSchema.safeParse({
        name: "Товар",
        slug: "new-item",
        price: "0.001",
        description: "",
        sku: "",
        status: "active",
        category_id: "",
      }).success,
    ).toBe(false));
  it("rejects fractional and negative inventory", () => {
    for (const qty of ["-1", "1.5", "NaN"])
      expect(
        variantSchema.safeParse({
          title: "M",
          sku: "M01",
          size: "M",
          color: "",
          inventory_quantity: qty,
        }).success,
      ).toBe(false);
  });
});
describe("auth boundaries", () => {
  it("uses fixed callback destinations", () => {
    for (const v of [
      "https://evil.example",
      "//evil.example",
      "/dashboard/../../evil",
      "/auth/update?evil",
      null,
    ])
      expect(callbackDestination(v)).toBe("/dashboard");
    expect(callbackDestination("/auth/update")).toBe("/auth/update");
  });
  it("keeps support out of catalog writes", () => {
    expect(canEditCatalog("support")).toBe(false);
    expect(canEditCatalog("unknown")).toBe(false);
    expect(canEditCatalog("editor")).toBe(true);
  });
  it("accepts existing shorter login password but not new weak passwords", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(loginPasswordSchema.safeParse("short").success).toBe(true);
  });
});
describe("image content", () => {
  it("rejects HTML and SVG payloads", () => {
    expect(
      imageFormat(new TextEncoder().encode('<svg onload="x()">')),
    ).toBeNull();
    expect(imageFormat(new TextEncoder().encode("<html>"))).toBeNull();
  });
  it("identifies png magic bytes", () =>
    expect(
      imageFormat(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))?.mime,
    ).toBe("image/png"));
});
