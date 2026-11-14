import type {
  CategoriesOverview,
  Category,
  CategoryId,
  CategoryMutationInput,
  CategoryPage,
  CategoryPagesOverview,
  CategorySearchAnalytics,
  ClassificationResult,
} from "../types";

type JsonRecord = Record<string, any>;

const DEFAULT_LIMITS: Record<string, number> = { free: 4, pro: 20 };

const asRecord = (value: unknown): JsonRecord =>
  value && typeof value === "object" ? (value as JsonRecord) : {};

const getResponseData = (payload: unknown): JsonRecord => {
  const record = asRecord(payload);
  return asRecord(record.data ?? record);
};

const getErrorMessage = (payload: unknown, fallback: string): string => {
  const record = asRecord(payload);
  const detail = record.detail;
  if (typeof detail === "string") return detail;
  if (typeof detail?.message === "string") return detail.message;
  if (Array.isArray(detail) && typeof detail[0]?.msg === "string") {
    return detail[0].msg;
  }
  if (typeof record.message === "string") return record.message;
  return fallback;
};

const requestJson = async (
  url: string,
  options: RequestInit,
  fallbackMessage: string
): Promise<JsonRecord> => {
  const response = await fetch(url, options);
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) throw new Error(getErrorMessage(payload, fallbackMessage));
  return getResponseData(payload);
};

const identityQuery = (browserUuid: string): string =>
  new URLSearchParams({ browser_uuid: browserUuid }).toString();

const identityBody = (
  browserUuid: string,
  extra: JsonRecord = {}
): JsonRecord => ({ browser_uuid: browserUuid, ...extra });

export const normalizeCategory = (value: unknown = {}): Category => {
  const category = asRecord(value);
  return {
    id: category.id ?? category.category_id ?? "",
    name: category.name || "Untitled category",
    description: category.description || "",
    isDefault: Boolean(category.is_default ?? category.isDefault),
    pageCount: Number(category.page_count ?? category.pageCount ?? 0),
  };
};

export const normalizeCategoryPage = (value: unknown = {}): CategoryPage => {
  const page = asRecord(value);
  return {
    id: page.id ?? page.page_id ?? "",
    url: page.url || "",
    title: page.title || page.domain || page.url || "Untitled page",
    domain: page.domain || "",
    folder: page.folder || "",
    flag: page.flag || "history",
    categoryConfidence:
      page.category_confidence == null
        ? null
        : Number(page.category_confidence),
    visitedAt: page.visited_at || page.visitedAt || "",
  };
};

export const normalizeCategoriesOverview = (
  payload: unknown
): CategoriesOverview => {
  const data = getResponseData(payload);
  const rawCategories = Array.isArray(data)
    ? data
    : data.categories || data.items || [];
  const categories = (rawCategories as unknown[]).map(normalizeCategory);
  const tier = String(data.tier || data.plan || "free");
  const suppliedLimit = Number(
    data.category_limit ?? data.categories_limit ?? data.limit
  );
  const limit = Number.isFinite(suppliedLimit)
    ? suppliedLimit
    : (DEFAULT_LIMITS[tier] ?? DEFAULT_LIMITS.free);

  return {
    enabled: Boolean(
      data.categorization_enabled ?? data.enabled ?? data.is_enabled
    ),
    categories,
    tier,
    limit,
  };
};

export const getCategories = async (
  host: string,
  browserUuid: string
): Promise<CategoriesOverview> => {
  const data = await requestJson(
    `${host}/categories/list`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(identityBody(browserUuid)),
    },
    "Could not load categories"
  );
  return normalizeCategoriesOverview(data);
};

export const enableCategories = (
  host: string,
  browserUuid: string
): Promise<ClassificationResult> =>
  requestJson(
    `${host}/categories/enable`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(identityBody(browserUuid)),
    },
    "Could not enable categories"
  );

export const disableCategories = (
  host: string,
  browserUuid: string
): Promise<JsonRecord> =>
  requestJson(
    `${host}/categories/disable`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(identityBody(browserUuid)),
    },
    "Could not disable categories"
  );

export const createCategory = (
  host: string,
  browserUuid: string,
  { name, description }: CategoryMutationInput
): Promise<JsonRecord> =>
  requestJson(
    `${host}/categories/create`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(identityBody(browserUuid, { name, description })),
    },
    "Could not create this category"
  );

export const deleteCategory = (
  host: string,
  browserUuid: string,
  categoryId: CategoryId
): Promise<JsonRecord> =>
  requestJson(
    `${host}/categories/${encodeURIComponent(categoryId)}?${identityQuery(browserUuid)}`,
    { method: "DELETE" },
    "Could not delete this category"
  );

export const triggerClassification = (
  host: string,
  browserUuid: string,
  reclassifyAll = false
): Promise<ClassificationResult> =>
  requestJson(
    `${host}/categories/classify`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        identityBody(browserUuid, { reclassify_all: reclassifyAll })
      ),
    },
    "Could not organize your pages"
  );

export const getClassificationStatus = async (
  host: string,
  taskId: string
): Promise<{ status: string; ready: boolean }> => {
  const data = await requestJson(
    `${host}/categories/classify-status`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: taskId }),
    },
    "Could not check category progress"
  );
  return {
    status: String(data.status || "pending").toLowerCase(),
    ready: Boolean(data.ready),
  };
};

export const getCategoryPages = async (
  host: string,
  browserUuid: string
): Promise<CategoryPagesOverview> => {
  const data = await requestJson(
    `${host}/categories/pages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(identityBody(browserUuid)),
    },
    "Could not load categorized pages"
  );

  return {
    categories: (data.categories || []).map((category: JsonRecord) => ({
      ...normalizeCategory(category),
      pages: (category.pages || []).map(normalizeCategoryPage),
    })),
    uncategorized: (data.uncategorized || []).map(normalizeCategoryPage),
  };
};

export const getCategorySearchAnalytics = async (
  host: string,
  browserUuid: string
): Promise<CategorySearchAnalytics[]> => {
  const data = await requestJson(
    `${host}/categories/search-analytics`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(identityBody(browserUuid)),
    },
    "Could not load category search activity"
  );

  return (data.by_category || []).map((item: JsonRecord) => ({
    categoryId: item.category_id ?? null,
    categoryName: item.category_name || "Uncategorized",
    searchCount: Number(item.search_count || 0),
  }));
};
