import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Bookmarks from "../components/Bookmarks";
import { userContext } from "../context/userContext";

jest.mock("../components/BookmarkFolderPicker", () => ({
  BookmarkFolderPin: () => <div>Folder pin</div>,
}));

test("passes the pinned folder to bookmark search", async () => {
  const searchStream = jest.fn().mockResolvedValue(undefined);
  const value = {
    state: {
      userId: "browser-123",
      query: "deployment notes",
      selectedBookmarkFolder: "Bookmarks bar / Work",
    },
    setState: jest.fn(),
    searchStream,
    flushBookmarks: jest.fn().mockResolvedValue({ success: true }),
  };

  render(
    <userContext.Provider value={value}>
      <Bookmarks host="https://api.example.com/v1" />
    </userContext.Provider>
  );

  fireEvent.click(screen.getByRole("button", { name: "Send search" }));

  await waitFor(() =>
    expect(searchStream).toHaveBeenCalledWith({
      host: "https://api.example.com/v1",
      query: "deployment notes",
      userId: "browser-123",
      flag: "bookmark",
      folder: "Bookmarks bar / Work",
    })
  );
});
