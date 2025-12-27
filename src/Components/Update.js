const Update = ({ handleShowUpdate }) => {
  return (
    <div>
      <div class="alert alert-success alert-dismissible fade show" role="alert">
        <div className="d-flex flex-column justify-content-start mb-2">
          <h5 class="alert-heading" style={{ padding: "0px", margin: "0px" }}>
            Whats New!
          </h5>
          <span style={{ fontSize: "12px" }}>v1.6</span>
        </div>
        <p style={{ fontSize: "14px", margin: "0" }}>
          Streaming and Faster Response
        </p>
        <p style={{ fontSize: "14px", margin: "0" }}>
          Surf Bookmarks and History
        </p>
        <p style={{ fontSize: "14px", margin: "0" }}>
          Enhanced Hybrid Retrieval
        </p>
        <p style={{ fontSize: "14px", margin: "1px 0 0" }}>AI Model Upgraded</p>
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
