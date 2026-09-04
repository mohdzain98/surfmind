import { fireEvent, render, screen } from "@testing-library/react";
import SearchThought from "../components/SearchThought";

test.each([
  ["Retrieved 4 sources...", "retrieval"],
  ["Validating results...", "validation"],
  ["Generating response...", "generation"],
])("maps %s to its related thought icon", (message, type) => {
  render(<SearchThought message={message} />);

  expect(screen.getByRole("status")).toHaveClass(`thought-${type}`);
  expect(screen.getByText(message)).toBeInTheDocument();
});

test.each([
  "Syncing recent history...",
  "Structuring output...",
  "No results found for this query",
])(
  "does not show the internal phase: %s",
  (message) => {
    const { container } = render(<SearchThought message={message} />);

    expect(container).toBeEmptyDOMElement();
  },
);

test("keeps previous messages and marks only the latest as current", () => {
  render(
    <SearchThought
      message="Generating response..."
      thoughts={[
        {
          id: "thought-1",
          message: "Retrieved 2 sources...",
          step: { step: "retrieved_parents" },
        },
        {
          id: "thought-2",
          message: "Generating response...",
          step: { step: "llm_response" },
        },
      ]}
    />,
  );

  expect(screen.getByText("Retrieved 2 sources...")).toBeInTheDocument();
  expect(screen.getByText("Generating response...")).toBeInTheDocument();
  expect(screen.getAllByRole("status")).toHaveLength(1);
  expect(screen.getByRole("status")).toHaveTextContent(
    "Generating response...",
  );
  expect(
    screen.getByRole("button", { name: "Searching history" }),
  ).toHaveAttribute("aria-expanded", "true");
});

test("collapses the completed sequence when the final answer is ready", () => {
  render(
    <SearchThought
      message=""
      complete={true}
      thoughts={[
        {
          id: "thought-1",
          message: "Retrieved 2 sources...",
          step: { step: "retrieved_parents" },
        },
        {
          id: "thought-2",
          message: "Validating results...",
          step: { step: "post_processing" },
        },
      ]}
    />,
  );

  expect(
    screen.getByRole("button", { name: "Searching history" }),
  ).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByText("Retrieved 2 sources...")).not.toBeInTheDocument();
  expect(screen.queryByText("Validating results...")).not.toBeInTheDocument();
});

test("uses a mode label and lets the sequence collapse", () => {
  render(
    <SearchThought
      mode="bookmark"
      message="Generating response..."
      thoughts={[
        {
          id: "thought-1",
          message: "Retrieved 2 sources...",
          step: { step: "retrieved_parents" },
        },
        {
          id: "thought-2",
          message: "Generating response...",
          step: { step: "llm_response" },
        },
      ]}
    />,
  );

  const toggle = screen.getByRole("button", { name: "Searching bookmarks" });
  fireEvent.click(toggle);

  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByText("Generating response...")).not.toBeInTheDocument();
});
