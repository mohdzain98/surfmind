import { fireEvent, render, screen } from "@testing-library/react";
import SavedHistory, { groupSavedHistory } from "../components/SavedHistory";

beforeEach(() => {
  global.chrome = {
    storage: {
      local: {
        get: jest.fn().mockResolvedValue({
          navigationData: [
            {
              captureId: "section-1",
              url: "https://example.com/article",
              title: "Example article",
              content: "The first saved section.",
              heading_path: ["Article", "Introduction"],
              capturedAt: 1_700_000_000_000,
            },
            {
              captureId: "section-2",
              url: "https://example.com/article",
              title: "Example article",
              content: "The second saved section.",
              heading_path: ["Article", "Details"],
              capturedAt: 1_700_000_000_000,
            },
          ],
        }),
      },
      onChanged: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
    },
  };
});

test("groups locally saved sections into one page per URL", () => {
  expect(
    groupSavedHistory([
      { url: "https://example.com", content: "One" },
      { url: "https://example.com", content: "Two" },
      { url: "https://openai.com", content: "Three" },
    ])
  ).toHaveLength(2);
});

test("shows saved pages and reveals their locally stored sections", async () => {
  render(<SavedHistory />);

  expect(
    await screen.findByText("1–1 of 1 page stored locally")
  ).toBeInTheDocument();
  const page = screen.getByText("Example article");
  expect(page).toBeInTheDocument();
  expect(screen.queryByText("The first saved section.")).not.toBeVisible();

  fireEvent.click(page.closest("summary"));

  expect(screen.getByText("Article › Introduction")).toBeVisible();
  expect(screen.getByText("The first saved section.")).toBeVisible();
  expect(screen.getByText("The second saved section.")).toBeVisible();
});

test("paginates locally saved history at 50 pages", async () => {
  chrome.storage.local.get.mockResolvedValue({
    navigationData: Array.from({ length: 51 }, (_, index) => ({
      captureId: `page-${index}`,
      url: `https://example.com/page-${index}`,
      title: `Saved page ${index}`,
      content: `Content ${index}`,
      capturedAt: index + 1,
    })),
  });

  render(<SavedHistory />);

  expect(
    await screen.findByText("1–50 of 51 pages stored locally")
  ).toBeInTheDocument();
  expect(screen.getByText("Saved page 50")).toBeInTheDocument();
  expect(screen.queryByText("Saved page 0")).not.toBeInTheDocument();
  expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Next" }));

  expect(
    screen.getByText("51–51 of 51 pages stored locally")
  ).toBeInTheDocument();
  expect(screen.getByText("Saved page 0")).toBeInTheDocument();
  expect(screen.queryByText("Saved page 50")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
});
