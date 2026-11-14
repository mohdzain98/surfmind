import { fireEvent, render, screen } from "@testing-library/react";
import SearchModeToggle from "../components/SearchModeToggle";

test("defaults to Standard and opens the described mode menu", () => {
  const onChange = jest.fn();
  render(<SearchModeToggle value="standard" onChange={onChange} />);

  expect(
    screen.getByText("AI answers can make mistakes. Check important details.")
  ).toBeInTheDocument();
  const trigger = screen.getByRole("button", {
    name: "Choose response mode. Standard selected",
  });
  expect(trigger).toHaveTextContent("Standard");
  expect(trigger).toHaveAttribute("aria-expanded", "false");

  fireEvent.click(trigger);
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  expect(
    screen.getByText("Get an answer, written for you, with sources.")
  ).toBeInTheDocument();
  expect(
    screen.getByText("Jump straight to the matching pages.")
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole("menuitemradio", { name: /Fast/ }));
  expect(onChange).toHaveBeenCalledWith("fast");
});

test("switches back to Standard when Fast mode is active", () => {
  const onChange = jest.fn();
  render(<SearchModeToggle value="fast" onChange={onChange} />);

  const trigger = screen.getByRole("button", {
    name: "Choose response mode. Fast selected",
  });
  expect(trigger).toHaveTextContent("Fast");

  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("menuitemradio", { name: /Standard/ }));
  expect(onChange).toHaveBeenCalledWith("standard");
});
