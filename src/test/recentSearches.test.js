import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import RecentSearches from "../components/RecentSearches";
import { fetchRecentSearches } from "../services/recentSearches";

jest.mock("../services/recentSearches", () => ({
  fetchRecentSearches: jest.fn(),
}));

const searches = [
  {
    id: "search-1",
    query: "First query",
    mode: "history",
    answer: "First stored answer",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000 - 1000).toISOString(),
    sources: [
      {
        url: "https://example.com/first",
        title: "First source",
        heading_path: ["Docs", "First"],
      },
    ],
  },
  {
    id: "search-2",
    query: "Second query",
    mode: "combined",
    answer: "Second stored answer",
    sources: [],
  },
];

beforeEach(() => {
  fetchRecentSearches.mockResolvedValue(searches);
});

afterEach(() => {
  jest.clearAllMocks();
});

test("loads on mount and expands only one stored result without refetching", async () => {
  render(
    <RecentSearches
      host="https://api.example.com/v1"
      browserUuid="browser-123"
    />,
  );

  const firstTrigger = await screen.findByRole("button", {
    name: /First query/i,
  });
  const secondTrigger = screen.getByRole("button", { name: /Second query/i });
  expect(screen.queryByText("First stored answer")).not.toBeInTheDocument();

  fireEvent.click(firstTrigger);
  expect(screen.getByText("First stored answer")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "example.com" })).toBeInTheDocument();
  expect(screen.getByText("2h ago")).toBeInTheDocument();
  expect(firstTrigger.closest("article")).toHaveClass("mode-history");

  fireEvent.click(secondTrigger);
  expect(screen.queryByText("First stored answer")).not.toBeInTheDocument();
  expect(screen.getByText("Second stored answer")).toBeInTheDocument();
  expect(secondTrigger.closest("article")).toHaveClass("mode-combined");
  expect(fetchRecentSearches).toHaveBeenCalledTimes(1);
});

test("renders a useful empty state and fails silently", async () => {
  fetchRecentSearches.mockRejectedValue(new Error("offline"));

  render(
    <RecentSearches
      host="https://api.example.com/v1"
      browserUuid="browser-123"
    />,
  );

  await waitFor(() => {
    expect(screen.getByText("No recent searches yet.")).toBeInTheDocument();
  });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("fetches fresh data when the side panel remounts", async () => {
  const props = {
    host: "https://api.example.com/v1",
    browserUuid: "browser-123",
  };
  const firstMount = render(<RecentSearches {...props} />);
  await screen.findByText("First query");
  firstMount.unmount();

  render(<RecentSearches {...props} />);
  await screen.findByText("First query");

  expect(fetchRecentSearches).toHaveBeenCalledTimes(2);
});
