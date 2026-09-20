import { fireEvent, render, screen, within } from "@testing-library/react";
import SavedBookmarks from "../components/SavedBookmarks";

const createEvent = () => ({
  addListener: jest.fn(),
  removeListener: jest.fn(),
});

beforeEach(() => {
  global.chrome = {
    runtime: {},
    bookmarks: {
      getTree: jest.fn((callback) =>
        callback([
          {
            id: "0",
            title: "",
            children: [
              {
                id: "1",
                title: "Bookmarks bar",
                children: [
                  {
                    id: "2",
                    title: "Research",
                    children: [
                      {
                        id: "3",
                        title: "Private page title",
                        url: "https://private.example.com",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ])
      ),
      onCreated: createEvent(),
      onRemoved: createEvent(),
      onChanged: createEvent(),
      onMoved: createEvent(),
    },
  };
});

test("shows folder names and counts without listing bookmark details", async () => {
  render(<SavedBookmarks />);

  expect(
    await screen.findByText("Bookmarks bar", { selector: "strong" })
  ).toBeInTheDocument();
  expect(screen.getByText("Research")).not.toBeVisible();

  fireEvent.click(
    screen.getByText("Bookmarks bar", { selector: "strong" }).closest("summary")
  );

  expect(screen.getByText("Research")).toBeVisible();
  const researchRow = screen.getByText("Research").closest("li");
  expect(within(researchRow).getByText("1")).toBeInTheDocument();
  expect(screen.getByText("2 folders · 1 bookmark")).toBeInTheDocument();
  expect(screen.queryByText("Private page title")).not.toBeInTheDocument();
  expect(
    screen.queryByText("https://private.example.com")
  ).not.toBeInTheDocument();
});
