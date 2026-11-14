import { normalizeFastResults } from "../services/fastSearch";

test("normalizes the backend's flat Fast response without losing result context", () => {
  expect(
    normalizeFastResults(
      {
        results: [
          {
            url: "https://bookmark.example/article",
            title: "Saved article",
            type: "bookmark",
            score: 0.73,
            heading_path: ["Deployment", "Production"],
            snippet: "The best-matching section.",
            source_device_name: "Work Laptop",
          },
        ],
      },
      "combined"
    )
  ).toEqual([
    expect.objectContaining({
      url: "https://bookmark.example/article",
      type: "bookmark",
      score: 0.73,
      heading_path: ["Deployment", "Production"],
      snippet: "The best-matching section.",
      source_device_name: "Work Laptop",
      metadata: expect.objectContaining({ type: "bookmark" }),
    }),
  ]);
});

test("normalizes split combined results and preserves their source type", () => {
  expect(
    normalizeFastResults(
      {
        results: {
          history: [{ url: "https://history.example" }],
          bookmarks: [{ url: "https://bookmark.example" }],
        },
      },
      "combined"
    )
  ).toEqual([
    expect.objectContaining({
      url: "https://history.example",
      type: "history",
      metadata: expect.objectContaining({ type: "history" }),
    }),
    expect.objectContaining({
      url: "https://bookmark.example",
      type: "bookmark",
      metadata: expect.objectContaining({ type: "bookmark" }),
    }),
  ]);
});
