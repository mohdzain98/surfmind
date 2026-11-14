export type CategoryId = string | number;

export interface Category {
  id: CategoryId;
  name: string;
  description: string;
  isDefault: boolean;
  pageCount: number;
}

export interface CategoryPage {
  id: CategoryId;
  url: string;
  title: string;
  domain: string;
  folder: string;
  flag: string;
  categoryConfidence: number | null;
  visitedAt: string;
}

export interface CategoryWithPages extends Category {
  pages: CategoryPage[];
}

export interface CategoriesOverview {
  enabled: boolean;
  categories: Category[];
  tier: string;
  limit: number;
}

export interface CategoryPagesOverview {
  categories: CategoryWithPages[];
  uncategorized: CategoryPage[];
}

export interface CategorySearchAnalytics {
  categoryId: CategoryId | null;
  categoryName: string;
  searchCount: number;
}

export type ClassificationState = "idle" | "organizing" | "complete" | "error";

export interface CategoryMessage {
  tone: "success" | "warning" | "danger";
  text: string;
}

export interface CategoryMutationInput {
  name: string;
  description: string;
}

export interface ClassificationResult {
  task_id?: string;
  taskId?: string;
  status?: string;
  ready?: boolean;
}

export interface CategorizationController extends CategoriesOverview {
  loading: boolean;
  busyAction: string;
  message: CategoryMessage | null;
  classificationState: ClassificationState;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  add: (input: CategoryMutationInput) => Promise<boolean>;
  remove: (categoryId: CategoryId) => Promise<boolean>;
  reclassifyAll: () => Promise<void>;
}
