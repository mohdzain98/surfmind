import { ArrowRight } from "lucide-react";

const Update = ({ handleShowUpdate }) => {
  return (
    <div>
      <div
        className="alert alert-success alert-dismissible fade show mt-3"
        role="alert"
      >
        <div className="d-flex flex-column justify-content-start mb-2">
          <h5
            className="alert-heading"
            style={{ padding: "0px", margin: "0px" }}
          >
            What's New!
          </h5>
          <span style={{ fontSize: "12px" }}>v1.75</span>
        </div>
        <p className="d-flex align-items-start gap-1" style={{ fontSize: "13px", margin: "0 0 4px" }}>
          <ArrowRight size={14} className="mt-1 flex-shrink-0 text-success" />
          <span><strong>Combined Mode — </strong>Search history <strong>and</strong> bookmarks at once</span>
        </p>
        <p className="d-flex align-items-start gap-1" style={{ fontSize: "13px", margin: "0" }}>
          <ArrowRight size={14} className="mt-1 flex-shrink-0 text-success" />
          <span>Faster search with smarter result filtering</span>
        </p>
        <button
          type="button"
          className="btn-close"
          aria-label="Close"
          onClick={handleShowUpdate}
        ></button>
      </div>
    </div>
  );
};

export default Update;
