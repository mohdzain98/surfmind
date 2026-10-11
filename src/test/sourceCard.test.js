import { render, screen } from "@testing-library/react";
import SourceCard from "../components/SourceCard";

const createDoc = (foundOnOtherBrowser) => ({
  metadata: {
    source: "https://example.com/article",
    domain: "example.com",
    title: "Useful article",
    ...(foundOnOtherBrowser === undefined
      ? {}
      : { found_on_other_browser: foundOnOtherBrowser }),
  },
});

test("labels results saved by another linked browser", () => {
  render(<SourceCard doc={createDoc(true)} />);

  expect(screen.getByText("Found on another browser")).toBeInTheDocument();
});

test.each([
  ["a result explicitly marked local", createDoc(false)],
  ["a response without the flag", createDoc()],
])("does not label results from %s", (_label, doc) => {
  render(<SourceCard doc={doc} />);

  expect(
    screen.queryByText("Found on another browser")
  ).not.toBeInTheDocument();
});

test("shows bookmark folders and uses matched content as the excerpt", () => {
  render(
    <SourceCard
      doc={{
        content:
          "The deployment guide explains how to configure production services.",
        metadata: {
          source: "https://example.com/deployment",
          domain: "example.com",
          title: "Deployment guide",
          type: "bookmark",
          folder: "Bookmarks bar / cellus / aws",
        },
      }}
    />
  );

  expect(screen.getByTitle("Bookmarks bar / cellus / aws")).toHaveTextContent(
    "Bookmarks bar / cellus / aws"
  );
  expect(
    screen.getByText(
      "The deployment guide explains how to configure production services."
    )
  ).toHaveClass("source-snippet");
});
