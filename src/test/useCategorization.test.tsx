import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import useCategorization from "../hooks/useCategorization";
import {
  createCategory,
  deleteCategory,
  getCategories,
  getClassificationStatus,
  refreshCategories,
  triggerClassification,
  updateCategory,
} from "../services/categoriesApi";

jest.mock("../services/categoriesApi", () => ({
  createCategory: jest.fn(),
  deleteCategory: jest.fn(),
  disableCategories: jest.fn(),
  enableCategories: jest.fn(),
  getCategories: jest.fn(),
  getClassificationStatus: jest.fn(),
  refreshCategories: jest.fn(),
  triggerClassification: jest.fn(),
  updateCategory: jest.fn(),
}));

const Harness = ({ active = true }: { active?: boolean }) => {
  const state = useCategorization({
    active,
    host: "https://api.example.com/v1",
    browserUuid: "browser-123",
  });
  return (
    <div>
      <span data-testid="enabled">{String(state.enabled)}</span>
      <span data-testid="loading">{String(state.loading)}</span>
      <span data-testid="classification">{state.classificationState}</span>
      <span data-testid="refresh-available-at">
        {state.refreshAvailableAt || "available"}
      </span>
      <span data-testid="can-create">{String(state.canCreateCategory)}</span>
      <span data-testid="message">{state.message?.text || ""}</span>
      <button type="button" onClick={state.refresh}>
        Refresh
      </button>
      <button type="button" onClick={() => state.remove("work")}>
        Delete
      </button>
      <button
        type="button"
        onClick={() =>
          state.add({ name: "Travel", description: "Trip planning" })
        }
      >
        Add
      </button>
      <button
        type="button"
        onClick={() => state.updateDescription("work", "Updated description")}
      >
        Edit
      </button>
    </div>
  );
};

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

test("does not trigger classification when categories are disabled", async () => {
  (getCategories as jest.Mock).mockResolvedValue({
    enabled: false,
    categories: [],
    tier: "free",
    categoryCount: 0,
    categoryLimit: 4,
    canCreateCategory: true,
    refreshAvailableAt: null,
  });

  render(<Harness />);

  await waitFor(() => expect(getCategories).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(screen.getByTestId("loading")).toHaveTextContent("false")
  );
  expect(triggerClassification).not.toHaveBeenCalled();
});

test("queues and polls classification when Settings opens while enabled", async () => {
  (getCategories as jest.Mock).mockResolvedValue({
    enabled: true,
    categories: [],
    tier: "free",
    categoryCount: 0,
    categoryLimit: 4,
    canCreateCategory: true,
    refreshAvailableAt: null,
  });
  (triggerClassification as jest.Mock).mockResolvedValue({ task_id: "task-1" });
  (getClassificationStatus as jest.Mock).mockResolvedValue({
    status: "success",
    ready: true,
  });

  render(<Harness />);

  await waitFor(() =>
    expect(triggerClassification).toHaveBeenCalledWith(
      "https://api.example.com/v1",
      "browser-123"
    )
  );
  await waitFor(() =>
    expect(getClassificationStatus).toHaveBeenCalledWith(
      "https://api.example.com/v1",
      "task-1"
    )
  );
  await waitFor(() =>
    expect(screen.getByTestId("classification")).toHaveTextContent("complete")
  );
});

test("uses the refresh endpoint and polls the queued task", async () => {
  const refreshAvailableAt = "2026-11-15T09:15:59.250374+00:00";
  (getCategories as jest.Mock).mockResolvedValue({
    enabled: false,
    categories: [],
    tier: "free",
    categoryCount: 0,
    categoryLimit: 4,
    canCreateCategory: true,
    refreshAvailableAt: null,
  });
  (refreshCategories as jest.Mock).mockResolvedValue({
    status: "queued",
    task_id: "refresh-task-1",
    refresh_available_at: refreshAvailableAt,
  });
  (getClassificationStatus as jest.Mock).mockResolvedValue({
    status: "success",
    ready: true,
  });

  render(<Harness />);
  await waitFor(() => expect(getCategories).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

  await waitFor(() =>
    expect(refreshCategories).toHaveBeenCalledWith(
      "https://api.example.com/v1",
      "browser-123"
    )
  );
  await waitFor(() =>
    expect(getClassificationStatus).toHaveBeenCalledWith(
      "https://api.example.com/v1",
      "refresh-task-1"
    )
  );
  await waitFor(() =>
    expect(screen.getByTestId("message")).toHaveTextContent(
      "Categories refreshed."
    )
  );
});

test("trusts a cooldown response from a stale view", async () => {
  const refreshAvailableAt = "2026-11-15T09:15:59.250374+00:00";
  (getCategories as jest.Mock).mockResolvedValue({
    enabled: false,
    categories: [],
    tier: "free",
    categoryCount: 0,
    categoryLimit: 4,
    canCreateCategory: true,
    refreshAvailableAt: null,
  });
  (refreshCategories as jest.Mock).mockResolvedValue({
    status: "cooldown",
    refresh_available_at: refreshAvailableAt,
  });

  render(<Harness />);
  await waitFor(() => expect(getCategories).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

  await waitFor(() =>
    expect(screen.getByTestId("refresh-available-at")).toHaveTextContent(
      refreshAvailableAt
    )
  );
  expect(getClassificationStatus).not.toHaveBeenCalled();
});

test("reloads list after delete so a freed category slot appears", async () => {
  (getCategories as jest.Mock)
    .mockResolvedValueOnce({
      enabled: false,
      categories: [],
      tier: "free",
      categoryCount: 4,
      categoryLimit: 4,
      canCreateCategory: false,
      refreshAvailableAt: null,
    })
    .mockResolvedValueOnce({
      enabled: false,
      categories: [],
      tier: "free",
      categoryCount: 3,
      categoryLimit: 4,
      canCreateCategory: true,
      refreshAvailableAt: null,
    });
  (deleteCategory as jest.Mock).mockResolvedValue({ success: true });

  render(<Harness />);
  await waitFor(() =>
    expect(screen.getByTestId("can-create")).toHaveTextContent("false")
  );
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));

  await waitFor(() =>
    expect(deleteCategory).toHaveBeenCalledWith(
      "https://api.example.com/v1",
      "browser-123",
      "work"
    )
  );
  await waitFor(() => expect(getCategories).toHaveBeenCalledTimes(2));
  expect(screen.getByTestId("can-create")).toHaveTextContent("true");
});

test("creates a category and reloads list to consume the freed slot", async () => {
  (getCategories as jest.Mock)
    .mockResolvedValueOnce({
      enabled: false,
      categories: [],
      tier: "free",
      categoryCount: 3,
      categoryLimit: 4,
      canCreateCategory: true,
      refreshAvailableAt: null,
    })
    .mockResolvedValueOnce({
      enabled: false,
      categories: [],
      tier: "free",
      categoryCount: 4,
      categoryLimit: 4,
      canCreateCategory: false,
      refreshAvailableAt: null,
    });
  (createCategory as jest.Mock).mockResolvedValue({ id: 7, name: "Travel" });

  render(<Harness />);
  await waitFor(() =>
    expect(screen.getByTestId("can-create")).toHaveTextContent("true")
  );
  fireEvent.click(screen.getByRole("button", { name: "Add" }));

  await waitFor(() =>
    expect(createCategory).toHaveBeenCalledWith(
      "https://api.example.com/v1",
      "browser-123",
      { name: "Travel", description: "Trip planning" }
    )
  );
  await waitFor(() => expect(getCategories).toHaveBeenCalledTimes(2));
  expect(screen.getByTestId("can-create")).toHaveTextContent("false");
});

test("updates a description and reloads the category list", async () => {
  const overview = {
    enabled: false,
    categories: [],
    tier: "free",
    categoryCount: 1,
    categoryLimit: 4,
    canCreateCategory: true,
    refreshAvailableAt: null,
  };
  (getCategories as jest.Mock).mockResolvedValue(overview);
  (updateCategory as jest.Mock).mockResolvedValue({
    id: "work",
    name: "Work",
    description: "Updated description",
  });

  render(<Harness />);
  await waitFor(() => expect(getCategories).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));

  await waitFor(() =>
    expect(updateCategory).toHaveBeenCalledWith(
      "https://api.example.com/v1",
      "browser-123",
      "work",
      "Updated description"
    )
  );
  await waitFor(() => expect(getCategories).toHaveBeenCalledTimes(2));
});
