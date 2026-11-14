import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CategoriesSettings from "../components/CategoriesSettings";
import type { CategorizationController } from "../types";

const createCategorization = (
  overrides: Partial<CategorizationController> = {}
): CategorizationController => ({
  enabled: false,
  categories: [],
  tier: "free",
  limit: 4,
  loading: false,
  busyAction: "",
  message: null,
  classificationState: "idle",
  enable: jest.fn(),
  disable: jest.fn(),
  add: jest.fn().mockResolvedValue(true),
  remove: jest.fn().mockResolvedValue(true),
  reclassifyAll: jest.fn(),
  ...overrides,
});

test("shows a collapsed off state and enables categorization from the switch", () => {
  const categorization = createCategorization();
  render(<CategoriesSettings categorization={categorization} />);

  expect(screen.getByText("Categories are off")).toBeInTheDocument();
  expect(screen.queryByText("Add a category")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("switch", { name: "Enable categories" }));
  expect(categorization.enable).toHaveBeenCalledTimes(1);
});

test("shows category usage and hides creation while all slots are filled", () => {
  const categorization = createCategorization({
    enabled: true,
    classificationState: "organizing",
    categories: [
      {
        id: "work",
        name: "Work",
        description: "Professional pages",
        isDefault: true,
        pageCount: 5,
      },
      {
        id: "travel",
        name: "Travel",
        description: "Trips and destinations",
        isDefault: false,
        pageCount: 0,
      },
      {
        id: "learn",
        name: "Learning",
        description: "Courses",
        isDefault: false,
        pageCount: 0,
      },
      {
        id: "shop",
        name: "Shopping",
        description: "Products",
        isDefault: false,
        pageCount: 0,
      },
    ],
  });
  render(<CategoriesSettings categorization={categorization} />);

  expect(screen.getByText("4 categories")).toBeInTheDocument();
  expect(screen.getByText("Default")).toBeInTheDocument();
  expect(screen.getAllByText("Custom").length).toBeGreaterThan(0);
  expect(screen.getByText("Organizing your pages…")).toBeInTheDocument();
  expect(screen.queryByText(/tier|Upgrade to Pro/i)).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Add a category" })
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Reclassify all" })
  ).not.toBeInTheDocument();
});

test("warns that deleting a category uncategorizes pages without deleting them", async () => {
  const categorization = createCategorization({
    enabled: true,
    categories: [
      {
        id: "work",
        name: "Work",
        description: "Professional pages",
        isDefault: true,
        pageCount: 5,
      },
    ],
  });
  render(<CategoriesSettings categorization={categorization} />);

  fireEvent.click(screen.getByRole("button", { name: "Delete Work category" }));
  expect(screen.getByRole("dialog")).toHaveTextContent(
    "Pages currently assigned to this category will become uncategorized"
  );
  expect(screen.getByRole("dialog")).toHaveTextContent(
    "saved pages themselves will not be deleted"
  );

  fireEvent.click(screen.getByRole("button", { name: "Delete Category" }));
  await waitFor(() =>
    expect(categorization.remove).toHaveBeenCalledWith("work")
  );
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  );
});

test("submits a category name and required description", async () => {
  const categorization = createCategorization({ enabled: true });
  render(<CategoriesSettings categorization={categorization} />);

  expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Add a category" }));
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Travel" },
  });
  fireEvent.change(screen.getByLabelText("Description"), {
    target: { value: "Flights, hotels, and destinations" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add category" }));

  await waitFor(() =>
    expect(categorization.add).toHaveBeenCalledWith({
      name: "Travel",
      description: "Flights, hotels, and destinations",
    })
  );
  await waitFor(() =>
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument()
  );
});
