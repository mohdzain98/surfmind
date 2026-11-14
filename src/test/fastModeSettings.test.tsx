import { fireEvent, render, screen } from "@testing-library/react";
import FastModeSettings from "../components/FastModeSettings";

test("shows Fast Mode controls and reports preference changes", () => {
  const onStrictnessChange = jest.fn();
  const onMaxResultsChange = jest.fn();

  render(
    <FastModeSettings
      strictness="balanced"
      maxResults={5}
      onStrictnessChange={onStrictnessChange}
      onMaxResultsChange={onMaxResultsChange}
    />
  );

  expect(
    screen.getByText(
      "Fast Mode returns matching links without an AI-written answer."
    )
  ).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: /Balanced/ })).toBeChecked();
  expect(
    screen.getByText("Usually shows up to 5 results.")
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole("radio", { name: /Precise/ }));
  expect(onStrictnessChange).toHaveBeenCalledWith("precise");

  fireEvent.click(screen.getByRole("radio", { name: "8" }));
  expect(onMaxResultsChange).toHaveBeenCalledWith(8);
});
