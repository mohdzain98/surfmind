const Update = ({ handleShowUpdate }) => {
  return (
    <div>
      <div class="alert alert-success alert-dismissible fade show" role="alert">
        <h5 class="alert-heading">Whats New!</h5>
        <p style={{ fontSize: "14px", margin: "0" }}>Bookmarks Now Surf Able</p>
        <p className="text-muted" style={{ fontSize: "12px", margin: "0" }}>
          Find your Bookmarks without knowing exact URL, just by keywords.
        </p>
        <p style={{ fontSize: "14px", margin: "2px 0 0" }}>
          Clear History Option
        </p>
        <p className="text-muted" style={{ fontSize: "12px", margin: "0" }}>
          Want a fresh start? You can now clear all saved extension history.
        </p>
        <p style={{ fontSize: "14px", margin: "1px 0 0" }}>AI Model Upgraded</p>
        <p style={{ fontSize: "14px", margin: "0" }}>Enhanced Retrieval</p>
        <p style={{ fontSize: "14px", margin: "0" }}>Enhanced Storage</p>
        <button
          type="button"
          class="btn-close"
          data-bs-dismiss="alert"
          aria-label="Close"
          onClick={handleShowUpdate}
        ></button>
      </div>
    </div>
  );
};

export default Update;
