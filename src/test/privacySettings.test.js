import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import PrivacySettings from "../components/PrivacySettings";
import {
  clearAllDataLocal,
  clearHistoryLocal,
  deleteAllData,
  deleteHistoryData,
} from "../services/privacy";

jest.mock("../services/privacy", () => ({
  PRIVACY_POLICY_URL: "https://surfmind.docschat.in/privacy",
  TERMS_URL: "https://surfmind.docschat.in/terms",
  clearAllDataLocal: jest.fn(),
  clearHistoryLocal: jest.fn(),
  deleteAllData: jest.fn(),
  deleteHistoryData: jest.fn(),
}));

const renderPrivacy = ({ linked = false, ...props } = {}) => {
  global.chrome = {
    storage: {
      local: {
        get: jest.fn().mockResolvedValue({
          crossBrowserSyncStatus: { isLinked: linked },
        }),
      },
      onChanged: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
    },
  };
  return render(
    <PrivacySettings
      host="https://api.example.com/v1"
      browserUuid="browser-123"
      {...props}
    />
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  deleteHistoryData.mockResolvedValue({ status: "history_cleared" });
  deleteAllData.mockResolvedValue({ status: "all_data_cleared" });
  clearHistoryLocal.mockResolvedValue(undefined);
  clearAllDataLocal.mockResolvedValue("new-browser-uuid");
});

test("confirms scoped history deletion before clearing local history", async () => {
  const onHistoryCleared = jest.fn();
  renderPrivacy({ onHistoryCleared });

  fireEvent.click(screen.getByRole("button", { name: "Clear History" }));
  const dialog = screen.getByRole("dialog", { name: "Clear your history?" });
  expect(dialog).toHaveTextContent(
    "Bookmarks and recent searches are not affected"
  );
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Clear History" })
  );

  await waitFor(() => {
    expect(deleteHistoryData).toHaveBeenCalledTimes(1);
    expect(clearHistoryLocal).toHaveBeenCalledTimes(1);
    expect(onHistoryCleared).toHaveBeenCalledTimes(1);
  });
});

test("requires CLEAR and warns linked users before a full wipe", async () => {
  const onAllDataCleared = jest.fn();
  renderPrivacy({ linked: true, onAllDataCleared });

  await waitFor(() =>
    expect(chrome.storage.local.get).toHaveBeenCalledTimes(1)
  );
  fireEvent.click(screen.getByRole("button", { name: /Clear All Data/ }));
  const dialog = screen.getByRole("dialog", { name: "Clear all your data?" });
  const confirmButton = within(dialog).getByRole("button", {
    name: "Clear All Data",
  });
  expect(dialog).toHaveTextContent("every linked browser");
  expect(dialog).not.toHaveTextContent(/categories/i);
  expect(dialog).not.toHaveTextContent(/plan/i);
  expect(confirmButton).toBeDisabled();

  fireEvent.change(within(dialog).getByLabelText(/Type CLEAR to confirm/), {
    target: { value: "CLEAR" },
  });
  expect(confirmButton).toBeEnabled();
  fireEvent.click(confirmButton);

  await waitFor(() => expect(clearAllDataLocal).toHaveBeenCalledTimes(1));
  expect(onAllDataCleared).toHaveBeenCalledWith("new-browser-uuid");
});

test("does not clear local data when the backend deletion fails", async () => {
  deleteAllData.mockRejectedValue(new Error("Delete request failed"));
  renderPrivacy();

  fireEvent.click(screen.getByRole("button", { name: /Clear All Data/ }));
  const dialog = screen.getByRole("dialog", { name: "Clear all your data?" });
  fireEvent.change(within(dialog).getByLabelText(/Type CLEAR to confirm/), {
    target: { value: "CLEAR" },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Clear All Data" })
  );

  expect(await screen.findByText("Delete request failed")).toBeInTheDocument();
  expect(clearAllDataLocal).not.toHaveBeenCalled();
});

test("keeps legal links off the privacy detail page", () => {
  renderPrivacy();

  expect(
    screen.queryByRole("link", { name: "Privacy Policy" })
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Terms of Service" })
  ).not.toBeInTheDocument();
  expect(
    document.querySelector(".privacy-settings-icon")
  ).not.toBeInTheDocument();
});
