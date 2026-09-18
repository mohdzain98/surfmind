import { useState } from "react";
import { LoaderCircle, Plus, Tags, Trash2 } from "lucide-react";
import ConfirmationDialog from "./ConfirmationDialog";

const CategoriesSettings = ({ categorization }) => {
  const {
    enabled,
    categories,
    limit,
    loading,
    busyAction,
    message,
    classificationState,
    enable,
    disable,
    add,
    remove,
  } = categorization;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [addFormOpen, setAddFormOpen] = useState(false);

  const count = categories.length;
  const atLimit = Number.isFinite(limit) && count >= limit;
  const isBusy = Boolean(busyAction);
  const isSettingUp = busyAction === "enable";
  const isOrganizing = classificationState === "organizing";

  const handleSubmit = async (event) => {
    event.preventDefault();
    const created = await add({
      name: name.trim(),
      description: description.trim(),
    });
    if (created) {
      setName("");
      setDescription("");
      setAddFormOpen(false);
    }
  };

  const handleDelete = async () => {
    if (!categoryToDelete) return;
    const deleted = await remove(categoryToDelete.id);
    if (deleted) setCategoryToDelete(null);
  };

  return (
    <section
      className="categories-settings"
      aria-labelledby="categories-settings-title"
    >
      <div className="categories-heading">
        <div>
          <h2 id="categories-settings-title">Categories</h2>
          <p>Let SurfMind organize saved pages around topics you define.</p>
        </div>
        <label className="category-toggle">
          <input
            type="checkbox"
            role="switch"
            checked={enabled}
            onChange={() => (enabled ? disable() : enable())}
            disabled={loading || isBusy}
            aria-label="Enable categories"
          />
          <span aria-hidden="true" />
        </label>
      </div>

      {loading ? (
        <div className="category-loading" role="status">
          <LoaderCircle className="spin" size={16} aria-hidden="true" />
          Loading categories…
        </div>
      ) : null}

      {!loading && !enabled ? (
        <div className="category-off-card">
          <span className="category-off-icon" aria-hidden="true">
            <Tags size={19} />
          </span>
          <div>
            <h3>{isSettingUp ? "Setting up…" : "Categories are off"}</h3>
            <p>
              Turn this on to create four starter categories and organize pages
              when you open Settings. Turning it off later preserves your
              categories and page assignments.
            </p>
          </div>
        </div>
      ) : null}

      {!loading && enabled ? (
        <>
          <div className="category-usage-row">
            <strong>
              {count} {count === 1 ? "category" : "categories"}
            </strong>
            {isOrganizing ? (
              <span className="category-organizing" role="status">
                <LoaderCircle className="spin" size={13} aria-hidden="true" />
                Organizing your pages…
              </span>
            ) : null}
          </div>

          {categories.length ? (
            <ul className="category-list">
              {categories.map((category) => (
                <li key={category.id || category.name}>
                  <span className="category-list-icon" aria-hidden="true">
                    <Tags size={15} />
                  </span>
                  <div className="category-list-copy">
                    <div>
                      <strong>{category.name}</strong>
                      <span className="category-kind">
                        {category.isDefault ? "Default" : "Custom"}
                      </span>
                    </div>
                    <p>{category.description}</p>
                    {category.pageCount > 0 ? (
                      <small>
                        {category.pageCount}{" "}
                        {category.pageCount === 1 ? "page" : "pages"}
                      </small>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="category-delete-button"
                    onClick={() => setCategoryToDelete(category)}
                    disabled={isBusy}
                    aria-label={`Delete ${category.name} category`}
                    title={`Delete ${category.name}`}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="category-empty">
              No categories yet. Add one below to start organizing your pages.
            </p>
          )}

          {!atLimit ? (
            <div className="category-add-accordion">
              <button
                type="button"
                className="category-add-toggle"
                onClick={() => setAddFormOpen((open) => !open)}
                aria-expanded={addFormOpen}
                aria-controls="category-add-form"
              >
                <Plus
                  className={addFormOpen ? "is-open" : ""}
                  size={14}
                  aria-hidden="true"
                />
                Add a category
              </button>

              {addFormOpen ? (
                <form
                  id="category-add-form"
                  className="category-form"
                  onSubmit={handleSubmit}
                >
                  <label htmlFor="category-name">Name</label>
                  <input
                    id="category-name"
                    className="form-control form-control-sm"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. Travel planning"
                    maxLength={60}
                    required
                    disabled={isBusy}
                  />
                  <label htmlFor="category-description">Description</label>
                  <textarea
                    id="category-description"
                    className="form-control form-control-sm"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Pages about destinations, hotels, flights, and itineraries"
                    rows={3}
                    maxLength={300}
                    required
                    disabled={isBusy}
                    aria-describedby="category-description-help"
                  />
                  <small id="category-description-help">
                    This helps SurfMind sort your pages accurately—be specific.
                  </small>

                  <button
                    type="submit"
                    className="btn btn-sm btn-primary"
                    disabled={isBusy || !name.trim() || !description.trim()}
                  >
                    <Plus size={13} aria-hidden="true" />
                    {busyAction === "add" ? "Adding…" : "Add category"}
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {message ? (
        <div
          className={`alert alert-${message.tone} category-message`}
          role="status"
        >
          {message.text}
        </div>
      ) : null}

      {categoryToDelete ? (
        <ConfirmationDialog
          title={`Delete ${categoryToDelete.name}?`}
          description={
            <p>
              Pages currently assigned to this category will become
              uncategorized. Your saved pages themselves will not be deleted.
            </p>
          }
          busy={busyAction === `delete:${categoryToDelete.id}`}
          confirmLabel="Delete Category"
          busyLabel="Deleting…"
          ConfirmIcon={Trash2}
          onCancel={() => setCategoryToDelete(null)}
          onConfirm={handleDelete}
        />
      ) : null}
    </section>
  );
};

export default CategoriesSettings;
