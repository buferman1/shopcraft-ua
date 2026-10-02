import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: database.getUser },
    from: database.from,
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error("TEST_REDIRECT:" + path);
  },
  notFound: vi.fn(),
}));
import { createStore } from "../src/app/dashboard/actions";

const ownerId = "00000000-0000-4000-8000-000000000001";
const form = () => {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    name: "My Store",
    slug: "my-store",
    currency: "UAH",
    locale: "uk",
    owner_id: "00000000-0000-4000-8000-000000000002",
    id: "untrusted-client-id",
  }))
    data.set(key, value);
  return data;
};

beforeEach(() => {
  vi.clearAllMocks();
  database.getUser.mockResolvedValue({
    data: { user: { id: ownerId } },
    error: null,
  });
  database.from.mockReturnValue({ insert: database.insert });
  // Supabase evaluates RETURNING before the AFTER INSERT membership trigger.
  // This models the actual 42501 failure from the hosted database.
  const request = Object.assign(Promise.resolve({ error: null }), {
    select: () => ({
      single: async () => ({ data: null, error: { code: "42501" } }),
    }),
  });
  database.insert.mockReturnValue(request);
});

describe("store creation regression", () => {
  it("creates a store when INSERT RETURNING would be denied and uses server-owned identifiers", async () => {
    await expect(createStore({}, form())).rejects.toThrow(
      /^TEST_REDIRECT:\/dashboard\/stores\//,
    );
    const row = database.insert.mock.calls[0][0];
    expect(row.owner_id).toBe(ownerId);
    expect(row.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(row.slug).toBe("my-store");
  });
  it("reports a duplicate store address without redirecting", async () => {
    database.insert.mockResolvedValueOnce({ error: { code: "23505" } });
    expect((await createStore({}, form())).error).toContain("вже зайнята");
  });
  it("does not write a store for a logged-out visitor", async () => {
    database.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });
    await expect(createStore({}, form())).rejects.toThrow(
      "TEST_REDIRECT:/auth/login",
    );
    expect(database.insert).not.toHaveBeenCalled();
  });
});
