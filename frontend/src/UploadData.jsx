import { useRef, useState } from "react";
import axios from "axios";
import "./App.css";

const API_BASE_URL = "http://localhost:5000";

function UploadData({ onUploadComplete }) {
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [pipelineStatus, setPipelineStatus] = useState("");

  const allowedTypes = [".csv", ".xlsx", ".xls"];

  // ============================================================
  // FILE VALIDATION
  // ============================================================

  const handleFile = (selectedFile) => {
    setError("");
    setResult(null);
    setPipelineStatus("");

    if (!selectedFile) {
      return;
    }

    const extension =
      "." +
      selectedFile.name.split(".").pop().toLowerCase();

    if (!allowedTypes.includes(extension)) {
      setFile(null);
      setError("Please select a CSV, XLSX or XLS file.");
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setFile(null);
      setError("File size must be less than 10 MB.");
      return;
    }

    setFile(selectedFile);
  };

  // ============================================================
  // DRAG & DROP
  // ============================================================

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);

    const droppedFile = event.dataTransfer.files?.[0];

    handleFile(droppedFile);
  };

  // ============================================================
  // WAIT FOR AI PIPELINE
  // ============================================================

  const waitForPipeline = async () => {
    const maxAttempts = 180;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await axios.get(
          `${API_BASE_URL}/api/pipeline/status`,
          {
            timeout: 10000,
          }
        );

        console.log(
          "Pipeline status response:",
          response.data
        );

        const pipeline =
          response.data?.pipeline ||
          response.data?.data ||
          response.data ||
          {};

        const status = String(
          pipeline.status || ""
        ).toUpperCase();

        setPipelineStatus(status);

        console.log(
          `AI Pipeline attempt ${attempt}:`,
          status
        );

        // ------------------------------------------------------
        // COMPLETED
        // ------------------------------------------------------

        if (
          status === "COMPLETED" ||
          status === "COMPLETE" ||
          status === "SUCCESS"
        ) {
          return true;
        }

        // ------------------------------------------------------
        // FAILED
        // ------------------------------------------------------

        if (
          status === "FAILED" ||
          status === "ERROR"
        ) {
          throw new Error(
            pipeline.error ||
              pipeline.message ||
              "AI analysis pipeline failed."
          );
        }

        // ------------------------------------------------------
        // STILL RUNNING
        // ------------------------------------------------------

        await new Promise((resolve) =>
          setTimeout(resolve, 1000)
        );
      } catch (err) {
        // If the server itself returned a pipeline failure,
        // stop immediately.
        if (
          err.response?.data?.pipeline?.status ===
            "FAILED" ||
          err.response?.data?.status === "FAILED"
        ) {
          throw new Error(
            err.response?.data?.message ||
              "AI pipeline failed."
          );
        }

        // Axios/network error
        if (!err.response) {
          throw new Error(
            "Unable to connect to the backend while checking AI pipeline status."
          );
        }

        throw err;
      }
    }

    throw new Error(
      "AI analysis is taking too long. Please check the backend terminal."
    );
  };

  // ============================================================
  // UPLOAD FILE
  // ============================================================

  const uploadFile = async () => {
    if (!file) {
      setError("Please select a file first.");
      return;
    }

    try {
      setUploading(true);
      setError("");
      setResult(null);
      setPipelineStatus("UPLOADING");

      const formData = new FormData();

      formData.append("file", file);

      // --------------------------------------------------------
      // STEP 1: UPLOAD DATASET
      // --------------------------------------------------------

      const response = await axios.post(
        `${API_BASE_URL}/api/upload`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          timeout: 120000,
        }
      );

      console.log(
        "Upload response:",
        response.data
      );

      if (!response.data?.success) {
        throw new Error(
          response.data?.message ||
            "Upload failed."
        );
      }

      // Show initial upload response
      setResult(response.data);

      // --------------------------------------------------------
      // STEP 2: CHECK WHETHER PIPELINE IS REQUIRED
      // --------------------------------------------------------

      const responsePipelineStatus = String(
        response.data?.pipeline?.status ||
          response.data?.pipelineStatus ||
          ""
      ).toUpperCase();

      // Project uploads in the current backend may not start
      // the AI pipeline automatically.
      //
      // If the backend says it is already running, wait for it.
      // If it is completed, refresh immediately.
      // Otherwise, check the pipeline endpoint once.
      // --------------------------------------------------------

      if (
        responsePipelineStatus === "COMPLETED" ||
        responsePipelineStatus === "COMPLETE" ||
        responsePipelineStatus === "SUCCESS"
      ) {
        setPipelineStatus("COMPLETED");

        await new Promise((resolve) =>
          setTimeout(resolve, 500)
        );

        if (onUploadComplete) {
          await onUploadComplete();
        }

        setResult((previous) => ({
          ...previous,
          message:
            "Dataset uploaded and AI analysis completed successfully.",
          pipelineStatus: "COMPLETED",
        }));

        return;
      }

      // --------------------------------------------------------
      // STEP 3: WAIT FOR PIPELINE
      // --------------------------------------------------------

      setPipelineStatus("RUNNING");

      const completed = await waitForPipeline();

      if (!completed) {
        throw new Error(
          "AI analysis did not complete."
        );
      }

      // --------------------------------------------------------
      // STEP 4: REFRESH DASHBOARD
      // --------------------------------------------------------

      setPipelineStatus("COMPLETED");

      // Small delay to ensure final risk CSV is written.
      await new Promise((resolve) =>
        setTimeout(resolve, 700)
      );

      console.log(
        "AI analysis completed. Refreshing dashboard..."
      );

      if (onUploadComplete) {
        await onUploadComplete();
      }

      // --------------------------------------------------------
      // STEP 5: SUCCESS MESSAGE
      // --------------------------------------------------------

      setResult((previous) => ({
        ...previous,
        success: true,
        message:
          "Dataset uploaded and AI analysis completed successfully. Dashboard data has been refreshed.",
        pipelineStatus: "COMPLETED",
      }));
    } catch (err) {
      console.error(
        "Upload error:",
        err
      );

      setPipelineStatus("FAILED");

      const serverMessage =
        err.response?.data?.message;

      const missingFields =
        err.response?.data?.missingFields;

      if (
        missingFields &&
        missingFields.length > 0
      ) {
        setError(
          `${serverMessage || "Dataset validation failed."} Missing fields: ${missingFields.join(
            ", "
          )}`
        );
      } else {
        setError(
          err.message ||
            serverMessage ||
            "Unable to upload the dataset. Make sure the backend server is running."
        );
      }
    } finally {
      setUploading(false);
    }
  };

  // ============================================================
  // CHOOSE ANOTHER FILE
  // ============================================================

  const chooseAnotherFile = () => {
    setFile(null);
    setResult(null);
    setError("");
    setPipelineStatus("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // ============================================================
  // PIPELINE DISPLAY TEXT
  // ============================================================

  const getPipelineText = () => {
    switch (pipelineStatus) {
      case "UPLOADING":
        return "Uploading dataset...";

      case "RUNNING":
        return "AI analysis in progress...";

      case "COMPLETED":
        return "AI analysis completed";

      case "FAILED":
        return "AI analysis failed";

      default:
        return "";
    }
  };

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="upload-page">

      {/* HEADER */}

      <header className="page-header">
        <div>
          <p className="eyebrow">
            DATA MANAGEMENT
          </p>

          <h2>
            Upload MPLADS Data
          </h2>

          <p>
            Upload a government project dataset
            and prepare it for AI-powered anomaly
            and risk analysis.
          </p>
        </div>

        <div className="upload-header-status">
          <span className="status-dot online" />

          <span>
            DATA PIPELINE READY
          </span>
        </div>
      </header>

      {/* MAIN GRID */}

      <div className="upload-grid">

        {/* LEFT */}

        <div className="panel upload-main-card">

          <div className="panel-header">
            <div>
              <p className="eyebrow">
                DATASET IMPORT
              </p>

              <h3>
                Upload project records
              </h3>

              <p className="table-description">
                Supported formats: CSV, Excel XLSX
                and XLS. Maximum file size: 10 MB.
              </p>
            </div>
          </div>

          {/* DROP AREA */}

          <div
            className={`upload-dropzone ${
              dragging ? "dragging" : ""
            } ${
              file ? "has-file" : ""
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => {
              setDragging(false);
            }}
            onDrop={handleDrop}
            onClick={() => {
              if (!file && !uploading) {
                fileInputRef.current?.click();
              }
            }}
          >

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              hidden
              onChange={(event) =>
                handleFile(
                  event.target.files?.[0]
                )
              }
            />

            {!file ? (
              <>
                <div className="upload-icon">
                  ↑
                </div>

                <h3>
                  Drop your dataset here
                </h3>

                <p>
                  or click to browse files
                </p>

                <span className="upload-formats">
                  CSV • XLSX • XLS
                </span>
              </>
            ) : (
              <>
                <div className="upload-file-icon">
                  ✓
                </div>

                <h3>
                  {file.name}
                </h3>

                <p>
                  {(
                    file.size / 1024
                  ).toFixed(1)}{" "}
                  KB
                </p>

                <span className="upload-formats">
                  File selected successfully
                </span>
              </>
            )}
          </div>

          {/* PIPELINE STATUS */}

          {uploading && (
            <div
              style={{
                marginTop: "16px",
                padding: "14px 16px",
                borderRadius: "10px",
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                color: "#1e40af",
              }}
            >
              <strong>
                {getPipelineText()}
              </strong>

              <p
                style={{
                  margin: "5px 0 0",
                  fontSize: "12px",
                }}
              >
                Please wait. The dashboard will
                refresh automatically after AI
                processing is complete.
              </p>
            </div>
          )}

          {/* ERROR */}

          {error && (
            <div className="upload-error">
              <span>
                ⚠
              </span>

              <div>
                <strong>
                  Upload failed
                </strong>

                <p>
                  {error}
                </p>
              </div>
            </div>
          )}

          {/* SUCCESS */}

          {result && !error && (
            <div className="upload-success">

              <div className="success-icon">
                ✓
              </div>

              <div className="success-content">

                <strong>
                  {pipelineStatus === "COMPLETED"
                    ? "Dataset uploaded successfully"
                    : "Dataset uploaded"}
                </strong>

                <p>
                  {result.message}
                </p>

                <div className="upload-result-grid">

                  <div>
                    <span>
                      FILE
                    </span>

                    <strong>
                      {result.fileName ||
                        file?.name ||
                        "Dataset"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      ROWS
                    </span>

                    <strong>
                      {result.rows ??
                        "N/A"}
                    </strong>
                  </div>

                </div>

                {pipelineStatus === "COMPLETED" && (
                  <p
                    style={{
                      marginTop: "10px",
                      fontWeight: "600",
                    }}
                  >
                    ✓ Dashboard data refreshed
                  </p>
                )}

              </div>
            </div>
          )}

          {/* ACTIONS */}

          <div className="upload-actions">

            {file && (
              <button
                className="secondary-upload-button"
                onClick={chooseAnotherFile}
                disabled={uploading}
              >
                Choose another
              </button>
            )}

            <button
              className="primary-upload-button"
              onClick={uploadFile}
              disabled={
                !file || uploading
              }
            >
              {uploading ? (
                <>
                  <span className="upload-spinner" />
                  Processing with AI...
                </>
              ) : (
                <>
                  ↑ Upload Dataset
                </>
              )}
            </button>

          </div>
        </div>

        {/* RIGHT */}

        <div className="panel upload-info-card">

          <p className="eyebrow">
            AI PIPELINE
          </p>

          <h3>
            What happens after upload?
          </h3>

          <p className="table-description">
            The uploaded dataset moves through
            the intelligence pipeline before appearing
            in the monitoring dashboard.
          </p>

          <div className="upload-pipeline">

            <div className="upload-pipeline-step">
              <div className="pipeline-number">
                01
              </div>

              <div>
                <strong>
                  Data Validation
                </strong>

                <small>
                  Check required fields and file
                  structure.
                </small>
              </div>
            </div>

            <div className="pipeline-line" />

            <div className="upload-pipeline-step">
              <div className="pipeline-number">
                02
              </div>

              <div>
                <strong>
                  Data Cleaning
                </strong>

                <small>
                  Prepare values for AI analysis.
                </small>
              </div>
            </div>

            <div className="pipeline-line" />

            <div className="upload-pipeline-step">
              <div className="pipeline-number">
                03
              </div>

              <div>
                <strong>
                  AI Anomaly Detection
                </strong>

                <small>
                  Identify unusual project patterns.
                </small>
              </div>
            </div>

            <div className="pipeline-line" />

            <div className="upload-pipeline-step">
              <div className="pipeline-number">
                04
              </div>

              <div>
                <strong>
                  Risk Scoring
                </strong>

                <small>
                  Calculate risk score and reasons.
                </small>
              </div>
            </div>

            <div className="pipeline-line" />

            <div className="upload-pipeline-step">
              <div className="pipeline-number">
                05
              </div>

              <div>
                <strong>
                  Dashboard Update
                </strong>

                <small>
                  Show results in alerts, analytics
                  and map.
                </small>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* REQUIRED FIELDS */}

      <div className="panel upload-fields-panel">

        <div className="panel-header">

          <div>
            <p className="eyebrow">
              DATA REQUIREMENTS
            </p>

            <h3>
              Required project fields
            </h3>

            <p className="table-description">
              Work-level records should contain
              these fields for complete AI analysis.
            </p>
          </div>

        </div>

        <div className="required-fields-grid">

          <div>
            <span>01</span>
            <strong>Work ID</strong>
          </div>

          <div>
            <span>02</span>
            <strong>State</strong>
          </div>

          <div>
            <span>03</span>
            <strong>District</strong>
          </div>

          <div>
            <span>04</span>
            <strong>Work Description</strong>
          </div>

          <div>
            <span>05</span>
            <strong>Work Type</strong>
          </div>

          <div>
            <span>06</span>
            <strong>Sanction Amount</strong>
          </div>

          <div>
            <span>07</span>
            <strong>Estimated Cost</strong>
          </div>

          <div>
            <span>08</span>
            <strong>Expenditure</strong>
          </div>

          <div>
            <span>09</span>
            <strong>Progress Percentage</strong>
          </div>

          <div>
            <span>10</span>
            <strong>Status</strong>
          </div>

        </div>
      </div>

      {/* NOTICE */}

      <div className="dashboard-disclaimer">

        <span>
          ⚠️
        </span>

        <p>
          <strong>
            Data quality notice:
          </strong>{" "}
          Upload work-level MPLADS project records
          whenever possible. Allocation-only data
          cannot provide the project-level fields
          required for complete anomaly and risk
          analysis.
        </p>

      </div>

    </div>
  );
}

export default UploadData;