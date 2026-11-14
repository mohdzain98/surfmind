import { render, screen, waitFor } from "@testing-library/react";
import useCategorization from "../hooks/useCategorization";
import {
  getCategories,
  getClassificationStatus,
  triggerClassification,
} from "../services/categoriesApi";

jest.mock("../services/categoriesApi", () => ({
  createCategory: jest.fn(),
  deleteCategory: jest.fn(),
  disableCategories: jest.fn(),
  enableCategories: jest.fn(),
  getCategories: jest.fn(),
  getClassificationStatus: jest.fn(),
  triggerClassification: jest.fn(),
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
    </div>
  );
};

beforeEach(() => {
  jest.clearAllMocks();
});

test("does not trigger classification when categories are disabled", async () => {
  (getCategories as jest.Mock).mockResolvedValue({
    enabled: false,
    categories: [],
    tier: "free",
    limit: 4,
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
    limit: 4,
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
