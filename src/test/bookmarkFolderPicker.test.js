import { fireEvent, render, screen } from "@testing-library/react";
import BookmarkFolderPicker, {
  BookmarkFolderPin,
} from "../components/BookmarkFolderPicker";

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
                    title: "Work",
                    children: [
                      {
                        id: "3",
                        title: "Deployment guide",
                        url: "https://example.com/deploy",
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

test("defaults to all bookmarks and returns the exact selected path", async () => {
  const onSelect = jest.fn();
  render(<BookmarkFolderPicker selectedFolder={null} onSelect={onSelect} />);

  const picker = await screen.findByRole("combobox", {
    name: "Choose a bookmark folder",
  });
  expect(screen.queryByText("Search in")).not.toBeInTheDocument();
  expect(picker).toHaveValue("");
  expect(
    await screen.findByRole("option", { name: "Entire bookmarks" })
  ).toBeVisible();

  fireEvent.change(picker, {
    target: { value: "Bookmarks bar / Work" },
  });
  expect(onSelect).toHaveBeenCalledWith("Bookmarks bar / Work");
});

test("shows and clears a pinned folder", async () => {
  const onSelect = jest.fn();
  render(
    <BookmarkFolderPin
      selectedFolder="Bookmarks bar / Work"
      onClear={() => onSelect(null)}
    />
  );

  expect(await screen.findByText("Bookmarks bar / Work")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Search all bookmarks" }));
  expect(onSelect).toHaveBeenCalledWith(null);
});
