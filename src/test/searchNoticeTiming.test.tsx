import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Popup from "../components/Popup";
import UserState from "../context/UserState";

jest.mock("../components/RecentSearches", () => () => (
  <div data-testid="recent-searches">Recent searches</div>
));

function createSseResponse(events: Array<{ step: string; data: unknown }>) {
  const payload = events
    .map((event) => `data: ${JSON.stringify(event)}\n\n`)
    .join("");
  const bytes = Buffer.from(payload, "utf8");
  let readDone = false;

  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: jest.fn(async () => {
          if (readDone) {
            return { value: undefined, done: true };
          }
          readDone = true;
          return { value: bytes, done: false };
        }),
      }),
    },
  };
}

function createPendingSseResponse() {
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: jest.fn(() => new Promise(() => {})),
      }),
    },
  };
}

function mockSearchStreamQueue(responses: unknown[]) {
  const queue = [...responses];
  (global.fetch as jest.Mock).mockImplementation(async (input: RequestInfo) => {
    const url = typeof input === "string" ? input : input.url;
    if (url.includes("/search-stream")) {
      return queue.shift();
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ history: 0, bookmarks: 0 }),
    };
  });
}

const originalTextDecoder = global.TextDecoder;

beforeAll(() => {
  if (typeof global.TextDecoder === "undefined") {
    global.TextDecoder = class {
      decode(value?: Uint8Array) {
        return value ? Buffer.from(value).toString("utf8") : "";
      }
    } as unknown as typeof TextDecoder;
  }
});

afterAll(() => {
  global.TextDecoder = originalTextDecoder;
});

beforeEach(() => {
  global.fetch = jest.fn();
  global.chrome = {
    runtime: {
      getManifest: jest.fn(() => ({ version: "1.10.1" })),
      sendMessage: jest.fn().mockResolvedValue({ success: true }),
    },
    tabs: {
      create: jest.fn(),
    },
    storage: {
      local: {
        get: jest.fn(async (keys?: unknown) => {
          const defaults =
            keys && typeof keys === "object" && !Array.isArray(keys)
              ? (keys as Record<string, unknown>)
              : {};
          return {
            ...defaults,
            "sm-last-seen-version": "1.10.1",
            userId: "browser-123",
            navigationData: [],
          };
        }),
        set: jest.fn().mockResolvedValue(undefined),
        remove: jest.fn().mockResolvedValue(undefined),
      },
      onChanged: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
    },
  } as unknown as typeof chrome;
});

afterEach(() => {
  jest.restoreAllMocks();
});

const renderApp = () =>
  render(
    <UserState>
      <Popup prop={{ host: "https://api.example.com/v1" }} />
    </UserState>
  );

async function submitSearch(query: string) {
  const input = await screen.findByPlaceholderText(
    "Ask SurfMind about your history…"
  );
  fireEvent.change(input, { target: { value: query } });
  fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
}

test("displays backend notice verbatim in Standard mode even with no results", async () => {
  mockSearchStreamQueue([
    createSseResponse([
      {
        step: "final",
        data: {
          mode: "standard",
          result: "No relevant data found",
          docs: [],
          notice:
            "Showing matches from your linked laptop while sync finishes.",
        },
      },
    ]),
  ]);

  renderApp();
  await submitSearch("kubernetes notes");

  const notice = await screen.findByRole("status");
  expect(notice).toHaveTextContent(
    "Showing matches from your linked laptop while sync finishes."
  );
  expect(screen.queryByText(/Found in /)).not.toBeInTheDocument();
});

test("formats duration_ms as Found in 9.7s in Standard and Fast modes", async () => {
  mockSearchStreamQueue([
    createSseResponse([
      {
        step: "final",
        data: {
          mode: "standard",
          result: "Summary from Standard search",
          docs: [{ metadata: { source: "https://example.com/a" } }],
          duration_ms: 9700,
        },
      },
    ]),
    createSseResponse([
      {
        step: "final",
        data: {
          mode: "fast",
          results: [{ url: "https://example.com/b", title: "Fast Hit" }],
          duration_ms: 9700,
        },
      },
    ]),
  ]);

  renderApp();
  await submitSearch("first query");
  expect(await screen.findByText("Found in 9.7s")).toBeInTheDocument();

  fireEvent.click(
    screen.getByRole("button", {
      name: "Choose response mode. Standard selected",
    })
  );
  fireEvent.click(screen.getByRole("menuitemradio", { name: /Fast/ }));

  await submitSearch("second query");
  expect(await screen.findByText(/Fast Hit/)).toBeInTheDocument();
  expect(await screen.findByText("Found in 9.7s")).toBeInTheDocument();
});

test("omits timing line when response does not include duration_ms", async () => {
  mockSearchStreamQueue([
    createSseResponse([
      {
        step: "final",
        data: {
          mode: "standard",
          result: "Answer without timing",
          docs: [{ metadata: { source: "https://example.com/no-timing" } }],
        },
      },
    ]),
  ]);

  renderApp();
  await submitSearch("query without timing");

  expect(await screen.findByText("Answer without timing")).toBeInTheDocument();
  expect(screen.queryByText(/Found in /)).not.toBeInTheDocument();
});

test("clears previous notice and timing as soon as a new search starts", async () => {
  mockSearchStreamQueue([
    createSseResponse([
      {
        step: "final",
        data: {
          mode: "standard",
          result: "Initial answer",
          docs: [{ metadata: { source: "https://example.com/first" } }],
          notice: "First search notice",
          duration_ms: 9700,
        },
      },
    ]),
    createPendingSseResponse(),
  ]);

  renderApp();
  await submitSearch("initial query");

  expect(await screen.findByText("First search notice")).toBeInTheDocument();
  expect(screen.getByText("Found in 9.7s")).toBeInTheDocument();

  await submitSearch("follow-up query");

  await waitFor(() =>
    expect(screen.queryByText("First search notice")).not.toBeInTheDocument()
  );
  expect(screen.queryByText("Found in 9.7s")).not.toBeInTheDocument();
});
