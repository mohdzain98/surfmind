import { fireEvent, render, screen } from "@testing-library/react";
import RatePromptBanner from "../components/RatePromptBanner";

test("stays visible until the user explicitly chooses an action", () => {
  jest.useFakeTimers();
  const onLater = jest.fn();

  render(
    <RatePromptBanner
      mode="history"
      onRate={jest.fn()}
      onLater={onLater}
      onDismiss={jest.fn()}
    />
  );

  jest.advanceTimersByTime(5 * 60 * 1000);

  expect(screen.getByText("Enjoying SurfMind?")).toBeInTheDocument();
  expect(onLater).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Maybe later" }));
  expect(onLater).toHaveBeenCalledTimes(1);

  jest.useRealTimers();
});
