import { describe, expect, it } from "vitest";
import {
  checkoutSchema,
  settingsSchema,
  defaultSettings,
  putCartItem,
  cartSchema,
  transitions,
  type CartItem,
} from "../src/lib/commerce";
const id = "11111111-1111-4111-8111-111111111111";
const item: CartItem = {
  productId: id,
  variantId: id,
  quantity: 1,
  name: "Футболка",
  variant: "M",
  price: 100,
  slug: "shirt",
};
const input = {
  token: id,
  name: "Покупець",
  phone: "+380 (67) 111-11-11",
  email: "",
  method: "delivery",
  address: "Львів, відділення 1",
  consent: true,
  items: [{ variantId: id, quantity: 1 }],
};
describe("commerce boundaries", () => {
  it("normalizes phone and discards shopper supplied price", () => {
    const data = checkoutSchema.parse({ ...input, price: 1 });
    expect(data.phone).toBe("380671111111");
    expect(data).not.toHaveProperty("price");
  });
  it("requires consent", () =>
    expect(checkoutSchema.safeParse({ ...input, consent: false }).success).toBe(
      false,
    ));
  it("rejects duplicate variants", () =>
    expect(
      checkoutSchema.safeParse({
        ...input,
        items: [input.items[0], input.items[0]],
      }).success,
    ).toBe(false));
  it("rejects oversized and fractional quantities", () => {
    for (const quantity of [0, -1, 1.5, 21])
      expect(
        checkoutSchema.safeParse({
          ...input,
          items: [{ variantId: id, quantity }],
        }).success,
      ).toBe(false);
  });
  it("requires delivery address", () =>
    expect(checkoutSchema.safeParse({ ...input, address: "" }).success).toBe(
      false,
    ));
  it("permits pickup without shipping address", () =>
    expect(
      checkoutSchema.safeParse({ ...input, method: "pickup", address: "" })
        .success,
    ).toBe(true));
  it("merges selected variant and caps quantity", () =>
    expect(putCartItem([{ ...item, quantity: 20 }], item)[0].quantity).toBe(
      20,
    ));
  it("rejects corrupt stored cart", () =>
    expect(
      cartSchema.safeParse([{ ...item, variantId: "other-store" }]).success,
    ).toBe(false));
  it("does not enable sales by default", () =>
    expect(defaultSettings.orders_enabled).toBe(false));
  it("requires a fulfillment method for enabled sales", () =>
    expect(
      settingsSchema.safeParse({
        ...defaultSettings,
        orders_enabled: true,
        delivery_enabled: false,
      }).success,
    ).toBe(false));
  it("requires pickup location", () =>
    expect(
      settingsSchema.safeParse({ ...defaultSettings, pickup_enabled: true })
        .success,
    ).toBe(false));
  it("terminal orders cannot be reopened", () => {
    expect(transitions.cancelled).toEqual([]);
    expect(transitions.returned).toEqual([]);
    expect(transitions.completed).toEqual(["returned"]);
  });
});
