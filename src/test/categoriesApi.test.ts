import {
  createCategory,
  deleteCategory,
  disableCategories,
  enableCategories,
  getCategories,
  getCategoryPages,
  getCategorySearchAnalytics,
  getClassificationStatus,
  triggerClassification,
} from "../services/categoriesApi";

const jsonResponse = (payload: unknown, status = 200) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(payload),
  });

beforeEach(() => {
  global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;
});

test("loads and normalizes the category overview", async () => {
  (fetch as jest.Mock).mockReturnValue(
    jsonResponse({
      enabled: true,
      categories: [
        {
          id: 1,
          name: "Work",
          description: "Professional pages",
          is_default: true,
        },
      ],
    })
  );

  await expect(
    getCategories("https://api.example.com/v1", "browser-123")
  ).resolves.toEqual({
    enabled: true,
    tier: "free",
    limit: 4,
    categories: [
      {
        id: 1,
        name: "Work",
        description: "Professional pages",
        isDefault: true,
        pageCount: 0,
      },
    ],
  });
  expect(fetch).toHaveBeenCalledWith(
    "https://api.example.com/v1/categories/list",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ browser_uuid: "browser-123" }),
    }
  );
});

test("enables and disables categories with browser_uuid", async () => {
  (fetch as jest.Mock)
    .mockReturnValueOnce(jsonResponse({ status: "enabled", task_id: "task-1" }))
    .mockReturnValueOnce(jsonResponse({ status: "disabled" }));

  await enableCategories("https://api.example.com/v1", "browser-123");
  expect(fetch).toHaveBeenNthCalledWith(
    1,
    "https://api.example.com/v1/categories/enable",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ browser_uuid: "browser-123" }),
    })
  );

  await disableCategories("https://api.example.com/v1", "browser-123");
  expect(fetch).toHaveBeenNthCalledWith(
    2,
    "https://api.example.com/v1/categories/disable",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ browser_uuid: "browser-123" }),
    })
  );
});

test("creates and deletes categories with the stable browser identity", async () => {
  (fetch as jest.Mock).mockReturnValue(jsonResponse({ status: "ok" }));

  await createCategory("https://api.example.com/v1", "browser-123", {
    name: "Travel",
    description: "Flights and destinations",
  });
  expect(fetch).toHaveBeenLastCalledWith(
    "https://api.example.com/v1/categories/create",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        browser_uuid: "browser-123",
        name: "Travel",
        description: "Flights and destinations",
      }),
    })
  );

  await deleteCategory(
    "https://api.example.com/v1",
    "browser-123",
    "category/1"
  );
  expect(fetch).toHaveBeenLastCalledWith(
    "https://api.example.com/v1/categories/category%2F1?browser_uuid=browser-123",
    { method: "DELETE" }
  );
});

test("triggers full reclassification and reads task status", async () => {
  (fetch as jest.Mock)
    .mockReturnValueOnce(jsonResponse({ task_id: "task-1", status: "queued" }))
    .mockReturnValueOnce(jsonResponse({ status: "SUCCESS", ready: true }));

  await triggerClassification(
    "https://api.example.com/v1",
    "browser-123",
    true
  );
  expect(fetch).toHaveBeenNthCalledWith(
    1,
    "https://api.example.com/v1/categories/classify",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        browser_uuid: "browser-123",
        reclassify_all: true,
      }),
    })
  );

  await expect(
    getClassificationStatus("https://api.example.com/v1", "task-1")
  ).resolves.toEqual({ status: "success", ready: true });
  expect(fetch).toHaveBeenNthCalledWith(
    2,
    "https://api.example.com/v1/categories/classify-status",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: "task-1" }),
    }
  );
});

test("surfaces backend tier-limit messages", async () => {
  (fetch as jest.Mock).mockReturnValue(
    jsonResponse({ detail: "Category limit reached for your plan" }, 400)
  );

  await expect(
    createCategory("https://api.example.com/v1", "browser-123", {
      name: "Travel",
      description: "Flights and destinations",
    })
  ).rejects.toThrow("Category limit reached for your plan");
});

test("loads grouped category pages with full page metadata", async () => {
  (fetch as jest.Mock).mockReturnValue(
    jsonResponse({
      categories: [
        {
          id: 1,
          name: "Work",
          description: "Professional pages",
          is_default: true,
          pages: [
            {
              id: 123,
              url: "https://example.com/report",
              title: "Quarterly report",
              domain: "example.com",
              folder: "Bookmarks bar / Work",
              flag: "bookmark",
              category_confidence: 0.92,
              visited_at: "2026-09-18T10:00:00Z",
            },
          ],
        },
      ],
      uncategorized: [],
    })
  );

  const result = await getCategoryPages(
    "https://api.example.com/v1",
    "browser-123"
  );

  expect(fetch).toHaveBeenCalledWith(
    "https://api.example.com/v1/categories/pages",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ browser_uuid: "browser-123" }),
    }
  );
  expect(result.categories[0]).toEqual(
    expect.objectContaining({
      id: 1,
      name: "Work",
      isDefault: true,
      pages: [
        {
          id: 123,
          url: "https://example.com/report",
          title: "Quarterly report",
          domain: "example.com",
          folder: "Bookmarks bar / Work",
          flag: "bookmark",
          categoryConfidence: 0.92,
          visitedAt: "2026-09-18T10:00:00Z",
        },
      ],
    })
  );
});

test("loads search volume by category", async () => {
  (fetch as jest.Mock).mockReturnValue(
    jsonResponse({
      by_category: [
        { category_id: 1, category_name: "Work", search_count: 13 },
        {
          category_id: null,
          category_name: "Uncategorized",
          search_count: 2,
        },
      ],
    })
  );

  await expect(
    getCategorySearchAnalytics("https://api.example.com/v1", "browser-123")
  ).resolves.toEqual([
    { categoryId: 1, categoryName: "Work", searchCount: 13 },
    { categoryId: null, categoryName: "Uncategorized", searchCount: 2 },
  ]);
  expect(fetch).toHaveBeenCalledWith(
    "https://api.example.com/v1/categories/search-analytics",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ browser_uuid: "browser-123" }),
    }
  );
});
