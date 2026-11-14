import { fireEvent, render, screen } from "@testing-library/react";
import SearchComposer from "../components/SearchComposer";

const renderComposer = (overrides = {}) => {
  const props = {
    id: "search-test",
    value: "find my saved article",
    onChange: jest.fn(),
    onSubmit: jest.fn(),
    placeholder: "Ask SurfMind…",
    ...overrides,
  };
  render(<SearchComposer {...props} />);
  return props;
};

test("uses a textarea and embedded send action without a search button", () => {
  renderComposer();

  const textarea = screen.getByRole("textbox");
  expect(textarea).toHaveAttribute("rows", "1");
  expect(textarea).toHaveStyle({ height: "64px", overflowY: "hidden" });
  expect(textarea.closest("form")).toHaveClass("mode-history");
  expect(
    screen.getByRole("button", { name: "Send search" })
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /^Search$/ })
  ).not.toBeInTheDocument();
});

test("submits on Enter and keeps Shift+Enter for multiline input", () => {
  const props = renderComposer();
  const textarea = screen.getByRole("textbox");

  fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
  expect(props.onSubmit).not.toHaveBeenCalled();

  fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
  expect(props.onSubmit).toHaveBeenCalledTimes(1);
});

test("disables send for an empty query", () => {
  renderComposer({ value: "   ", disabled: true });

  expect(screen.getByRole("textbox")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Send search" })).toBeDisabled();
});
