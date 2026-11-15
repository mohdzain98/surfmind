import { fireEvent, render, screen } from "@testing-library/react";
import CategoryBrowser from "../components/CategoryBrowser";
import {
  getCategoryPages,
  getCategorySearchAnalytics,
} from "../services/categoriesApi";

jest.mock("../services/categoriesApi", () => ({
  getCategoryPages: jest.fn(),
  getCategorySearchAnalytics: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  (getCategoryPages as jest.Mock).mockResolvedValue({
    categories: [
      {
        id: 1,
        name: "Work",
        description: "Professional pages",
        isDefault: true,
        deletable: true,
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
      },
    ],
    uncategorized: [
      {
        id: 456,
        url: "https://news.example.com",
        title: "Daily news",
        domain: "news.example.com",
        folder: "",
        flag: "history",
        categoryConfidence: null,
        visitedAt: "2026-09-17T10:00:00Z",
      },
    ],
  });
  (getCategorySearchAnalytics as jest.Mock).mockResolvedValue([
    { categoryId: 1, categoryName: "Work", searchCount: 13 },
    { categoryId: null, categoryName: "Uncategorized", searchCount: 2 },
  ]);
});

test("loads pages and analytics in parallel and expands one group", async () => {
  render(
    <CategoryBrowser
      host="https://api.example.com/v1"
      browserUuid="browser-123"
    />
  );

  const workGroup = await screen.findByRole("button", { name: /Work/ });
  expect(getCategoryPages).toHaveBeenCalledTimes(1);
  expect(getCategorySearchAnalytics).toHaveBeenCalledTimes(1);
  expect(
    screen.getByText((_, element) => element?.textContent === "2 saved pages")
  ).toBeInTheDocument();
  expect(
    screen.getByText((_, element) => element?.textContent === "15 searches")
  ).toBeInTheDocument();
  expect(screen.queryByText("Quarterly report")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Refresh categories" })
  ).not.toBeInTheDocument();

  expect(workGroup).toHaveTextContent("1 page");
  expect(workGroup).toHaveTextContent("13");
  fireEvent.click(workGroup);

  expect(workGroup.closest(".category-browser-group")).toHaveClass("is-open");
  expect(screen.getByText("Quarterly report")).toBeInTheDocument();
  expect(screen.getByText("92% match")).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: /Quarterly report/ })
  ).toHaveAttribute("href", "https://example.com/report");

  fireEvent.click(screen.getByRole("button", { name: /Uncategorized/ }));
  expect(workGroup.closest(".category-browser-group")).not.toHaveClass(
    "is-open"
  );
  expect(screen.queryByText("Quarterly report")).not.toBeInTheDocument();
  expect(screen.getByText("Daily news")).toBeInTheDocument();
});

test("shows the empty state when no pages are categorized", async () => {
  (getCategoryPages as jest.Mock).mockResolvedValue({
    categories: [],
    uncategorized: [],
  });
  (getCategorySearchAnalytics as jest.Mock).mockResolvedValue([]);

  render(
    <CategoryBrowser
      host="https://api.example.com/v1"
      browserUuid="browser-123"
    />
  );

  expect(
    await screen.findByRole("heading", { name: "No categorized pages yet" })
  ).toBeInTheDocument();
  expect(screen.getByText(/Enable Categories in Settings/)).toBeInTheDocument();
});
