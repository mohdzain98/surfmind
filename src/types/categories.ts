export type CategoryId = string | number;

export interface Category {
  id: CategoryId;
  name: string;
  description: string;
  isDefault: boolean;
  deletable: boolean;
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
  categoryCount: number;
  categoryLimit: number | null;
  canCreateCategory: boolean;
  refreshAvailableAt: string | null;
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

export interface CategoryRefreshResult extends ClassificationResult {
  refresh_available_at?: string | null;
  refreshAvailableAt?: string | null;
}

export interface CategorizationController extends CategoriesOverview {
  loading: boolean;
  busyAction: string;
  message: CategoryMessage | null;
  classificationState: ClassificationState;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  add: (input: CategoryMutationInput) => Promise<boolean>;
  updateDescription: (
    categoryId: CategoryId,
    description: string
  ) => Promise<boolean>;
  remove: (categoryId: CategoryId) => Promise<boolean>;
  refresh: () => Promise<void>;
}
