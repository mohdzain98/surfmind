const DEFAULT_LIMITS = { free: 4, pro: 20 };

const getResponseData = (payload) => payload?.data ?? payload ?? {};

const getErrorMessage = (payload, fallback) => {
  const detail = payload?.detail;
  if (typeof detail === "string") return detail;
  if (typeof detail?.message === "string") return detail.message;
  if (Array.isArray(detail) && typeof detail[0]?.msg === "string") {
    return detail[0].msg;
  }
  if (typeof payload?.message === "string") return payload.message;
  return fallback;
};

const requestJson = async (url, options, fallbackMessage) => {
  const response = await fetch(url, options);
  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, fallbackMessage));
  }
  return getResponseData(payload);
};

const identityQuery = (browserUuid) =>
  new URLSearchParams({ browser_uuid: browserUuid }).toString();

const identityBody = (browserUuid, extra = {}) => ({
  browser_uuid: browserUuid,
  ...extra,
});

export const normalizeCategory = (category = {}) => ({
  id: category.id || category.category_id || "",
  name: category.name || "Untitled category",
  description: category.description || "",
  isDefault: Boolean(category.is_default ?? category.isDefault),
  pageCount: Number(category.page_count ?? category.pageCount ?? 0),
});

export const normalizeCategoryPage = (page = {}) => ({
  id: page.id ?? page.page_id ?? "",
  url: page.url || "",
  title: page.title || page.domain || page.url || "Untitled page",
  domain: page.domain || "",
  folder: page.folder || "",
  flag: page.flag || "history",
  categoryConfidence:
    page.category_confidence == null ? null : Number(page.category_confidence),
  visitedAt: page.visited_at || page.visitedAt || "",
});

export const normalizeCategoriesOverview = (payload) => {
  const data = getResponseData(payload);
  const rawCategories = Array.isArray(data)
    ? data
    : data.categories || data.items || [];
  const categories = rawCategories.map(normalizeCategory);
  const tier = data.tier || data.plan || "free";
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

export const getCategories = async (host, browserUuid) => {
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

export const enableCategories = async (host, browserUuid) =>
  requestJson(
    `${host}/categories/enable`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(identityBody(browserUuid)),
    },
    "Could not enable categories"
  );

export const disableCategories = async (host, browserUuid) =>
  requestJson(
    `${host}/categories/disable`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(identityBody(browserUuid)),
    },
    "Could not disable categories"
  );

export const createCategory = async (
  host,
  browserUuid,
  { name, description }
) =>
  requestJson(
    `${host}/categories/create`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(identityBody(browserUuid, { name, description })),
    },
    "Could not create this category"
  );

export const deleteCategory = async (host, browserUuid, categoryId) =>
  requestJson(
    `${host}/categories/${encodeURIComponent(categoryId)}?${identityQuery(browserUuid)}`,
    { method: "DELETE" },
    "Could not delete this category"
  );

export const triggerClassification = async (
  host,
  browserUuid,
  reclassifyAll = false
) =>
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

export const getClassificationStatus = async (host, taskId) => {
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

export const getCategoryPages = async (host, browserUuid) => {
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
    categories: (data.categories || []).map((category) => ({
      ...normalizeCategory(category),
      pages: (category.pages || []).map(normalizeCategoryPage),
    })),
    uncategorized: (data.uncategorized || []).map(normalizeCategoryPage),
  };
};

export const getCategorySearchAnalytics = async (host, browserUuid) => {
  const data = await requestJson(
    `${host}/categories/search-analytics`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(identityBody(browserUuid)),
    },
    "Could not load category search activity"
  );

  return (data.by_category || []).map((item) => ({
    categoryId: item.category_id ?? null,
    categoryName: item.category_name || "Uncategorized",
    searchCount: Number(item.search_count || 0),
  }));
};
