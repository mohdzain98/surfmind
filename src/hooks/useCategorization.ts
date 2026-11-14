import { useCallback, useEffect, useState } from "react";
import {
  createCategory,
  deleteCategory,
  disableCategories,
  enableCategories,
  getCategories,
  getClassificationStatus,
  triggerClassification,
} from "../services/categoriesApi";
import type {
  CategoriesOverview,
  CategorizationController,
  CategoryId,
  CategoryMessage,
  CategoryMutationInput,
  ClassificationResult,
  ClassificationState,
} from "../types";

const EMPTY_OVERVIEW: CategoriesOverview = {
  enabled: false,
  categories: [],
  tier: "free",
  limit: 4,
};

const getTaskId = (result: ClassificationResult): string =>
  result?.task_id || result?.taskId || "";

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Something went wrong";

interface UseCategorizationOptions {
  active: boolean;
  host: string;
  browserUuid: string;
}

const useCategorization = ({
  active,
  host,
  browserUuid,
}: UseCategorizationOptions): CategorizationController => {
  const [overview, setOverview] = useState<CategoriesOverview>(EMPTY_OVERVIEW);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [message, setMessage] = useState<CategoryMessage | null>(null);
  const [taskId, setTaskId] = useState("");
  const [classificationState, setClassificationState] =
    useState<ClassificationState>("idle");

  const loadOverview = useCallback(async (): Promise<CategoriesOverview> => {
    const nextOverview = await getCategories(host, browserUuid);
    setOverview(nextOverview);
    return nextOverview;
  }, [browserUuid, host]);

  const trackClassification = useCallback((result: ClassificationResult) => {
    const nextTaskId = getTaskId(result);
    if (nextTaskId) {
      setTaskId(nextTaskId);
      setClassificationState("organizing");
      return;
    }
    setTaskId("");
    setClassificationState("idle");
  }, []);

  useEffect(() => {
    if (!active || !host || !browserUuid) return undefined;

    let cancelled = false;
    const initialize = async () => {
      setLoading(true);
      setMessage(null);
      try {
        const nextOverview = await getCategories(host, browserUuid);
        if (cancelled) return;
        setOverview(nextOverview);

        if (nextOverview.enabled) {
          try {
            const result = await triggerClassification(host, browserUuid);
            if (!cancelled) trackClassification(result);
          } catch (error) {
            if (!cancelled) {
              setMessage({ tone: "warning", text: errorMessage(error) });
            }
          }
        } else {
          setTaskId("");
          setClassificationState("idle");
        }
      } catch (error) {
        if (!cancelled) {
          setMessage({ tone: "danger", text: errorMessage(error) });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    initialize();
    return () => {
      cancelled = true;
    };
  }, [active, browserUuid, host, trackClassification]);

  useEffect(() => {
    if (!active || !taskId) return undefined;

    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const result = await getClassificationStatus(host, taskId);
        if (cancelled) return;
        if (result.ready) {
          setTaskId("");
          setClassificationState("complete");
          await loadOverview();
          return;
        }
        setClassificationState("organizing");
        timerId = setTimeout(poll, 2500);
      } catch (error) {
        if (cancelled) return;
        setTaskId("");
        setClassificationState("error");
        setMessage({ tone: "warning", text: errorMessage(error) });
      }
    };

    poll();
    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [active, host, loadOverview, taskId]);

  const enable = useCallback(async () => {
    setBusyAction("enable");
    setMessage(null);
    setClassificationState("organizing");
    try {
      const result = await enableCategories(host, browserUuid);
      await loadOverview();
      trackClassification(result);
      setMessage({
        tone: "success",
        text: "Categories are ready. SurfMind is organizing your pages.",
      });
    } catch (error) {
      setClassificationState("idle");
      setMessage({ tone: "danger", text: errorMessage(error) });
    } finally {
      setBusyAction("");
    }
  }, [browserUuid, host, loadOverview, trackClassification]);

  const disable = useCallback(async () => {
    setBusyAction("disable");
    setMessage(null);
    try {
      await disableCategories(host, browserUuid);
      setOverview((current) => ({ ...current, enabled: false }));
      setTaskId("");
      setClassificationState("idle");
      setMessage({
        tone: "success",
        text: "Categories are off. Your existing category data is preserved.",
      });
    } catch (error) {
      setMessage({ tone: "danger", text: errorMessage(error) });
    } finally {
      setBusyAction("");
    }
  }, [browserUuid, host]);

  const add = useCallback(
    async ({ name, description }: CategoryMutationInput): Promise<boolean> => {
      setBusyAction("add");
      setMessage(null);
      try {
        await createCategory(host, browserUuid, { name, description });
        await loadOverview();
        setMessage({ tone: "success", text: "Category added." });
        return true;
      } catch (error) {
        setMessage({ tone: "danger", text: errorMessage(error) });
        return false;
      } finally {
        setBusyAction("");
      }
    },
    [browserUuid, host, loadOverview]
  );

  const remove = useCallback(
    async (categoryId: CategoryId): Promise<boolean> => {
      setBusyAction(`delete:${categoryId}`);
      setMessage(null);
      try {
        await deleteCategory(host, browserUuid, categoryId);
        await loadOverview();
        setMessage({
          tone: "success",
          text: "Category deleted. Its pages are now uncategorized.",
        });
        return true;
      } catch (error) {
        setMessage({ tone: "danger", text: errorMessage(error) });
        return false;
      } finally {
        setBusyAction("");
      }
    },
    [browserUuid, host, loadOverview]
  );

  const reclassifyAll = useCallback(async () => {
    setBusyAction("reclassify");
    setMessage(null);
    try {
      const result = await triggerClassification(host, browserUuid, true);
      trackClassification(result);
      if (!getTaskId(result)) {
        setMessage({
          tone: "success",
          text: "All pages are already organized.",
        });
      }
    } catch (error) {
      setMessage({ tone: "danger", text: errorMessage(error) });
    } finally {
      setBusyAction("");
    }
  }, [browserUuid, host, trackClassification]);

  return {
    ...overview,
    loading,
    busyAction,
    message,
    classificationState,
    enable,
    disable,
    add,
    remove,
    reclassifyAll,
  };
};

export default useCategorization;
