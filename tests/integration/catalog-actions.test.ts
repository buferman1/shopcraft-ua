import { readFileSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, it, expect, vi } from "vitest";

const connection = vi.hoisted(() => ({
  client: null as SupabaseClient | null,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    if (!connection.client) throw new Error("No integration test client");
    return connection.client;
  },
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error("TEST_REDIRECT:" + path);
  },
  notFound: () => {
    throw new Error("TEST_NOT_FOUND");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  createStore,
  createCategory,
  saveProduct,
  addVariant,
} from "../../src/app/dashboard/actions";
import {
  updateInventory,
  uploadProductImage,
} from "../../src/app/dashboard/media-actions";

const fixturePath = process.env.SHOPCRAFT_API_FIXTURE_FILE;
const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};
async function redirected(action: () => Promise<unknown>) {
  try {
    const state = await action();
    throw new Error("Expected redirect, received " + JSON.stringify(state));
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.startsWith("TEST_REDIRECT:")
    )
      throw error;
    return error.message.slice("TEST_REDIRECT:".length);
  }
}

describe.skipIf(!fixturePath)("catalog actions against real Supabase", () => {
  it("creates a store and catalog, persists stock/photo, and blocks another account", async () => {
    const fixture = JSON.parse(readFileSync(fixturePath!, "utf8")) as {
      users: { id: string; email: string; password: string }[];
      stores: string[];
      objects: string[];
    };
    const checkpoint = () =>
      writeFileSync(fixturePath!, JSON.stringify(fixture), { mode: 0o600 });
    const client = () =>
      createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) =>
              fetch(input, { ...init, signal: AbortSignal.timeout(20000) }),
          },
        },
      );
    const owner = client(),
      other = client();
    connection.client = owner;
    try {
      for (const [index, supabase] of [owner, other].entries()) {
        const user = fixture.users[index];
        const { error } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: user.password,
        });
        expect(error).toBeNull();
      }
      const slug = "audit-" + crypto.randomUUID();
      const path = await redirected(() =>
        createStore(
          {},
          form({
            name: "Integration Store",
            slug,
            currency: "UAH",
            locale: "uk",
          }),
        ),
      );
      const storeId = path.split("/").at(-1)!;
      fixture.stores.push(storeId);
      checkpoint();
      const store = await owner
        .from("stores")
        .select("name")
        .eq("id", storeId)
        .single();
      expect(store.error).toBeNull();
      expect(store.data?.name).toBe("Integration Store");
      const member = await owner
        .from("store_members")
        .select("role")
        .eq("store_id", storeId)
        .single();
      expect(member.data?.role).toBe("owner");
      console.info("PASS store creation, redirect and owner membership");
      expect(
        (
          await createStore(
            {},
            form({
              name: "Duplicate Store",
              slug,
              currency: "UAH",
              locale: "uk",
            }),
          )
        ).error,
      ).toContain("вже зайнята");
      expect(
        (
          await createCategory(
            storeId,
            {},
            form({ name: "Shirts", slug: "shirts" }),
          )
        ).success,
      ).toBeTruthy();
      const category = await owner
        .from("categories")
        .select("id")
        .eq("store_id", storeId)
        .single();
      expect(category.error).toBeNull();
      const productValues = {
        name: "Audit Shirt",
        slug: "audit-shirt",
        price: "499",
        sku: "AUDIT",
        status: "draft",
        description: "Disposable integration item",
        category_id: category.data!.id,
      };
      const productPath = await redirected(() =>
        saveProduct(storeId, null, {}, form(productValues)),
      );
      const productId = productPath.split("/").at(-1)!;
      console.info("PASS category and product creation");
      expect(
        (
          await saveProduct(
            storeId,
            productId,
            {},
            form({ ...productValues, name: "Edited Shirt", price: "599" }),
          )
        ).success,
      ).toBeTruthy();
      expect(
        (
          await addVariant(
            storeId,
            productId,
            {},
            form({
              title: "M / black",
              sku: "AUDIT-M",
              size: "M",
              color: "black",
              inventory_quantity: "5",
            }),
          )
        ).success,
      ).toBeTruthy();
      const variant = await owner
        .from("product_variants")
        .select("id,options")
        .eq("product_id", productId)
        .single();
      expect(variant.data?.options).toEqual({ size: "M", color: "black" });
      expect(
        (
          await updateInventory(
            storeId,
            productId,
            variant.data!.id,
            {},
            form({ quantity: "7" }),
          )
        ).success,
      ).toBeTruthy();
      expect(
        (
          await updateInventory(
            storeId,
            productId,
            variant.data!.id,
            {},
            form({ quantity: "-1" }),
          )
        ).error,
      ).toBeTruthy();
      const stock = await owner
        .from("product_variants")
        .select("inventory_quantity")
        .eq("id", variant.data!.id)
        .single();
      expect(stock.data?.inventory_quantity).toBe(7);
      console.info("PASS product editing, variants and stock validation");
      const png = Uint8Array.from(
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9i8AAAAASUVORK5CYII=",
          "base64",
        ),
      );
      const upload = new FormData();
      upload.set("image", new File([png], "audit.png", { type: "image/png" }));
      upload.set("alt", "Audit image");
      expect(
        (await uploadProductImage(storeId, productId, {}, upload)).success,
      ).toBeTruthy();
      const image = await owner
        .from("product_images")
        .select("path,alt")
        .eq("product_id", productId)
        .single();
      expect(image.error).toBeNull();
      fixture.objects.push(image.data!.path);
      checkpoint();
      expect(image.data?.alt).toBe("Audit image");
      const publicUrl = owner.storage
        .from("store-media")
        .getPublicUrl(image.data!.path).data.publicUrl;
      const response = await fetch(publicUrl, {
        signal: AbortSignal.timeout(20000),
      });
      expect(response.status).toBe(200);
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(png);
      console.info("PASS actual photo upload and download");
      const wrongFile = new FormData();
      wrongFile.set(
        "image",
        new File(["<svg>bad</svg>"], "fake.png", { type: "image/png" }),
      );
      expect(
        (await uploadProductImage(storeId, productId, {}, wrongFile)).error,
      ).toContain("Формат");
      const otherRead = await other
        .from("products")
        .select("id")
        .eq("id", productId);
      expect(otherRead.error).toBeNull();
      expect(otherRead.data).toEqual([]);
      const otherUpload = await other.storage
        .from("store-media")
        .upload(storeId + "/" + productId + "/forbidden.png", png, {
          contentType: "image/png",
        });
      expect(otherUpload.error).toBeTruthy();
      connection.client = other;
      await expect(
        saveProduct(storeId, productId, {}, form(productValues)),
      ).rejects.toThrow("TEST_NOT_FOUND");
      console.info("PASS cross-account catalog and media protection");
      connection.client = owner;
      const logs = await owner
        .from("audit_logs")
        .select("id")
        .eq("store_id", storeId);
      expect(logs.error).toBeNull();
      expect(logs.data!.length).toBeGreaterThan(0);
      expect((await owner.auth.signOut()).error).toBeNull();
      await expect(
        createStore(
          {},
          form({
            name: "Logged out",
            slug: "logged-out",
            currency: "UAH",
            locale: "uk",
          }),
        ),
      ).rejects.toThrow("TEST_REDIRECT:/auth/login");
      expect(
        (
          await owner.auth.signInWithPassword({
            email: fixture.users[0].email,
            password: fixture.users[0].password,
          })
        ).error,
      ).toBeNull();
      const persisted = await owner
        .from("products")
        .select("name,price")
        .eq("id", productId)
        .single();
      expect(persisted.data).toMatchObject({
        name: "Edited Shirt",
        price: 599,
      });
      console.info("PASS sign-out, repeated sign-in and saved product");
    } finally {
      if (fixture.objects.length) {
        const removal = await owner.storage
          .from("store-media")
          .remove(fixture.objects);
        expect(removal.error).toBeNull();
      }
      await owner.auth.signOut();
      await other.auth.signOut();
      connection.client = null;
    }
  }, 480000);
});
