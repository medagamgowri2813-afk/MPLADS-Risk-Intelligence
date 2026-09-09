import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import axios from "axios";
import "./App.css";

import Analytics from "./Analytics";
import RiskAlerts from "./RiskAlerts";
import MapView from "./MapView";

/* =========================================================
   API CONFIGURATION
   ========================================================= */

const API_BASE_URL =
  "https://mplads-risk-intelligence.onrender.com/api";

/* =========================================================
   DEFAULT DATA
   ========================================================= */

const DEFAULT_DASHBOARD = {
  totalWorks: 0,
  lowRisk: 0,
  mediumRisk: 0,
  highRisk: 0,
  criticalRisk: 0,
  anomalies: 0,
};

/* =========================================================
   HELPERS
   ========================================================= */

const filterWorks = (
  works = [],
  search = "",
  riskFilter = "ALL"
) => {
  const searchText = search.trim().toLowerCase();

  return works.filter((work) => {
    const matchesSearch =
      !searchText ||
      String(work.Work_ID || "")
        .toLowerCase()
        .includes(searchText) ||
      String(work.State || "")
        .toLowerCase()
        .includes(searchText) ||
      String(work.District || "")
        .toLowerCase()
        .includes(searchText) ||
      String(work.Work_Type || "")
        .toLowerCase()
        .includes(searchText);

    const matchesRisk =
      riskFilter === "ALL" ||
      String(work.Risk_Level || "").toUpperCase() ===
        riskFilter;

    return matchesSearch && matchesRisk;
  });
};

const formatCurrency = (value) => {
  const number = Number(value) || 0;

  return number.toLocaleString("en-IN");
};

const formatIndianAmount = (value) => {
  const number = Number(value) || 0;

  if (number >= 10000000) {
    return `₹${(number / 10000000).toFixed(2)} Cr`;
  }

  if (number >= 100000) {
    return `₹${(number / 100000).toFixed(2)} L`;
  }

  return `₹${number.toLocaleString("en-IN")}`;
};

const getRiskLevel = (work) => {
  return String(
    work?.Risk_Level || "LOW"
  ).toLowerCase();
};

/* =========================================================
   SIDEBAR ITEM
   ========================================================= */

function SidebarItem({
  icon,
  label,
  active,
  onClick,
  count,
}) {
  return (
    <div
      className={`sidebar-item ${
        active ? "active" : ""
      }`}
      onClick={onClick}
    >
      <div className="sidebar-item-icon">
        {icon}
      </div>

      <span className="sidebar-item-label">
        {label}
      </span>

      {count > 0 && (
        <span className="sidebar-count">
          {count}
        </span>
      )}
    </div>
  );
}

/* =========================================================
   RISK BAR
   ========================================================= */

function RiskBar({
  label,
  count,
  total,
  type,
}) {
  const percentage =
    total > 0
      ? (count / total) * 100
      : 0;

  return (
    <div className="risk-bar-row">
      <div className="risk-bar-label">
        <span
          className={`risk-dot ${type}`}
        />

        <span>{label}</span>
      </div>

      <div className="bar">
        <div
          className={type}
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>

      <b>{count}</b>

      <small>
        {percentage.toFixed(1)}%
      </small>
    </div>
  );
}

/* =========================================================
   KPI CARD
   ========================================================= */

function KpiCard({
  icon,
  label,
  value,
  description,
  type,
  progress,
}) {
  return (
    <div
      className={`card kpi-card ${type}`}
    >
      <div className="kpi-top">
        <div className="kpi-icon">
          {icon}
        </div>

        <span className="kpi-label">
          {label}
        </span>
      </div>

      <strong className="kpi-value">
        {value}
      </strong>

      <small>{description}</small>

      <div className="kpi-progress">
        <div
          style={{
            width: `${Math.min(
              progress || 0,
              100
            )}%`,
          }}
        />
      </div>
    </div>
  );
}

/* =========================================================
   UPLOAD DATA PAGE
   ========================================================= */

function UploadData({
  onUploadComplete,
}) {
  const [selectedFile, setSelectedFile] =
    useState(null);

  const [uploading, setUploading] =
    useState(false);

  const [uploadProgress, setUploadProgress] =
    useState(0);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [datasetType, setDatasetType] =
    useState("");

  const handleFileChange = (event) => {
    const file =
      event.target.files?.[0];

    setMessage("");
    setError("");
    setUploadProgress(0);
    setDatasetType("");

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const allowedExtensions = [
      ".csv",
      ".xlsx",
      ".xls",
    ];

    const fileName =
      file.name.toLowerCase();

    const isValid =
      allowedExtensions.some(
        (extension) =>
          fileName.endsWith(extension)
      );

    if (!isValid) {
      setSelectedFile(null);

      setError(
        "Invalid file format. Please upload CSV, XLSX or XLS file."
      );

      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError(
        "Please select a CSV or Excel file first."
      );

      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);
      setMessage("");
      setError("");
      setDatasetType("");

      const formData = new FormData();

      formData.append(
        "file",
        selectedFile
      );

      const response =
        await axios.post(
          `${API_BASE_URL}/upload`,
          formData,
          {
            headers: {
              "Content-Type":
                "multipart/form-data",
            },

            onUploadProgress:
              (progressEvent) => {
                if (
                  progressEvent.total
                ) {
                  const percent =
                    Math.round(
                      (progressEvent.loaded /
                        progressEvent.total) *
                        100
                    );

                  setUploadProgress(
                    percent
                  );
                }
              },
          }
        );

      console.log(
        "Upload response:",
        response.data
      );

      const result =
        response?.data || {};

      const uploadedType =
        String(
          result.datasetType || ""
        ).toUpperCase();

      setDatasetType(
        uploadedType
      );

      setUploadProgress(100);

      if (
        uploadedType ===
        "ALLOCATION"
      ) {
        const rows =
          result.rowsDetected ||
          result.analytics
            ?.totalRecords ||
          0;

        setMessage(
          `Allocation dataset uploaded successfully. ${rows} records were processed.`
        );
      } else {
        setMessage(
          "Project data uploaded successfully. Dashboard intelligence has been refreshed."
        );
      }

      setSelectedFile(null);

      if (onUploadComplete) {
        await onUploadComplete(
          result
        );
      }
    } catch (uploadError) {
      console.error(
        "Upload failed:",
        uploadError
      );

      const responseData =
        uploadError?.response?.data;

      const backendMessage =
        responseData?.message;

      if (backendMessage) {
        let detailedMessage =
          backendMessage;

        if (
          Array.isArray(
            responseData?.missingFields
          ) &&
          responseData.missingFields.length
        ) {
          detailedMessage +=
            ` Missing fields: ${responseData.missingFields.join(
              ", "
            )}.`;
        }

        if (
          Array.isArray(
            responseData?.missingAllocationFields
          ) &&
          responseData
            .missingAllocationFields
            .length
        ) {
          detailedMessage +=
            ` Required allocation fields: ${responseData.missingAllocationFields.join(
              ", "
            )}.`;
        }

        if (
          responseData?.hint
        ) {
          detailedMessage +=
            ` ${responseData.hint}`;
        }

        setError(
          detailedMessage
        );
      } else if (
        uploadError?.code ===
        "ERR_NETWORK"
      ) {
        setError(
          "Cannot connect to the backend server. Please check the Render backend."
        );
      } else {
        setError(
          "Upload failed. Please check the file and backend server."
        );
      }

      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setMessage("");
    setError("");
    setUploadProgress(0);
    setDatasetType("");
  };

  const formatFileSize = (
    bytes
  ) => {
    if (!bytes) {
      return "0 KB";
    }

    const kb = bytes / 1024;

    if (kb < 1024) {
      return `${kb.toFixed(1)} KB`;
    }

    return `${(
      kb / 1024
    ).toFixed(2)} MB`;
  };

  return (
    <>
      <header>
        <div>
          <p className="eyebrow">
            MPLADS DATA MANAGEMENT
          </p>

          <h2>
            Upload Data
          </h2>

          <p>
            Upload MPLADS project or allocation
            data for monitoring and intelligence.
          </p>
        </div>

        <div className="alerts-header-status">
          <span className="status-dot online" />

          <strong>
            DATA PIPELINE READY
          </strong>
        </div>
      </header>

      <section className="panel upload-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">
              DATA INGESTION
            </p>

            <h3>
              Upload MPLADS Dataset
            </h3>

            <p className="table-description">
              Supported formats: CSV, XLSX and
              XLS. The system automatically
              detects Project Data or Allocation
              Data.
            </p>
          </div>

          <div className="upload-status-badge">
            ● READY
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(2, minmax(0, 1fr))",
            gap: "14px",
            marginBottom: "18px",
          }}
        >
          <div
            style={{
              border:
                "1px solid #dbe3ef",
              borderRadius: "10px",
              padding: "15px",
              background:
                "#f8fafc",
            }}
          >
            <strong>
              📁 Project Dataset
            </strong>

            <p
              style={{
                margin:
                  "6px 0 0",
                fontSize: "12px",
                color:
                  "#64748b",
              }}
            >
              Work-level records used for AI
              anomaly and risk analysis.
            </p>
          </div>

          <div
            style={{
              border:
                "1px solid #dbe3ef",
              borderRadius: "10px",
              padding: "15px",
              background:
                "#f8fafc",
            }}
          >
            <strong>
              💰 Allocation Dataset
            </strong>

            <p
              style={{
                margin:
                  "6px 0 0",
                fontSize: "12px",
                color:
                  "#64748b",
              }}
            >
              MP, constituency and state allocation
              data used for fund distribution
              information.
            </p>
          </div>
        </div>

        <label
          className="upload-drop-zone"
          htmlFor="mplads-file-upload"
        >
          <div className="upload-icon">
            ⇧
          </div>

          <h3>
            Select MPLADS Data File
          </h3>

          <p>
            Click here to browse your computer
          </p>

          <span>
            CSV • XLSX • XLS
          </span>

          <input
            id="mplads-file-upload"
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={
              handleFileChange
            }
            disabled={uploading}
            style={{
              display: "none",
            }}
          />
        </label>

        {selectedFile && (
          <div className="selected-file-card">
            <div className="selected-file-icon">
              📄
            </div>

            <div className="selected-file-info">
              <strong>
                {selectedFile.name}
              </strong>

              <small>
                {formatFileSize(
                  selectedFile.size
                )}
              </small>
            </div>

            <button
              type="button"
              className="close-button"
              onClick={removeFile}
              disabled={uploading}
            >
              ✕
            </button>
          </div>
        )}

        {uploading && (
          <div className="upload-progress-section">
            <div className="upload-progress-header">
              <span>
                Processing dataset...
              </span>

              <strong>
                {uploadProgress}%
              </strong>
            </div>

            <div className="upload-progress-bar">
              <div
                style={{
                  width: `${uploadProgress}%`,
                }}
              />
            </div>
          </div>
        )}

        {message && (
          <div className="upload-message success">
            <span>✓</span>

            <div>
              <strong>
                Upload successful
              </strong>

              <p>
                {message}
              </p>

              {datasetType && (
                <small>
                  Dataset type detected:{" "}
                  <strong>
                    {datasetType}
                  </strong>
                </small>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="upload-message error">
            <span>⚠</span>

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

        <div className="upload-actions">
          <button
            className="primary-action"
            onClick={handleUpload}
            disabled={
              !selectedFile ||
              uploading
            }
          >
            {uploading
              ? "Processing..."
              : "Upload & Analyze →"}
          </button>

          {selectedFile &&
            !uploading && (
              <button
                className="secondary-action"
                onClick={removeFile}
              >
                Remove File
              </button>
            )}
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="panel">
          <p className="eyebrow">
            PROCESSING PIPELINE
          </p>

          <h3>
            What happens after upload?
          </h3>

          <p className="table-description">
            The system identifies the uploaded
            schema and routes it to the appropriate
            processing pipeline.
          </p>

          <div className="info-points upload-pipeline">
            <div>
              <strong>01</strong>

              <span>
                Dataset detection & validation
              </span>
            </div>

            <div>
              <strong>02</strong>

              <span>
                Data cleaning & normalization
              </span>
            </div>

            <div>
              <strong>03</strong>

              <span>
                Project AI risk analysis OR
                allocation data processing
              </span>
            </div>

            <div>
              <strong>04</strong>

              <span>
                Intelligence metrics generation
              </span>
            </div>

            <div>
              <strong>05</strong>

              <span>
                Dashboard update
              </span>
            </div>
          </div>
        </div>

        <div className="panel">
          <p className="eyebrow">
            DATA REQUIREMENTS
          </p>

          <h3>
            Supported Schemas
          </h3>

          <p className="table-description">
            Project datasets work best with project
            fields. Allocation datasets should contain
            MP, constituency, state and allocation
            amount information.
          </p>

          <div className="upload-fields-list">
            <span>Work ID</span>
            <span>State</span>
            <span>District</span>
            <span>Work Type</span>
            <span>Sanction Amount</span>
            <span>Estimated Cost</span>
            <span>Expenditure</span>
            <span>Progress %</span>
            <span>Status</span>
            <span>MP Name</span>
            <span>Constituency</span>
            <span>Allocated Amount</span>
          </div>
        </div>
      </section>

      <div className="dashboard-disclaimer">
        <span>⚠️</span>

        <p>
          <strong>
            Data processing notice:
          </strong>{" "}
          Uploaded datasets are processed for
          project monitoring and decision support.
          AI risk flags identify projects that may
          require human verification; they do not
          independently establish fraud or wrongdoing.
          Allocation data is treated separately from
          project-level AI risk scoring.
        </p>
      </div>
    </>
  );
}

/* =========================================================
   DASHBOARD
   ========================================================= */

function Dashboard({
  works,
  dashboard,
  search,
  setSearch,
  riskFilter,
  setRiskFilter,
  selectedWork,
  setSelectedWork,
  refreshData,
}) {
  const total =
    Number(
      dashboard?.totalWorks
    ) ||
    works.length ||
    0;

  const lowRisk =
    Number(
      dashboard?.lowRisk
    ) || 0;

  const mediumRisk =
    Number(
      dashboard?.mediumRisk
    ) || 0;

  const highRisk =
    Number(
      dashboard?.highRisk
    ) || 0;

  const criticalRisk =
    Number(
      dashboard?.criticalRisk
    ) || 0;

  const anomalies =
    Number(
      dashboard?.anomalies
    ) || 0;

  const highPriority =
    highRisk + criticalRisk;

  const priorityPercentage =
    total > 0
      ? (
          (highPriority /
            total) *
          100
        ).toFixed(1)
      : "0.0";

  const filteredWorks =
    useMemo(
      () =>
        filterWorks(
          works,
          search,
          riskFilter
        ),
      [
        works,
        search,
        riskFilter,
      ]
    );

  const attentionItems = [
    {
      icon: "🚨",
      title:
        "Critical risk projects",
      text:
        "Require immediate verification",
      value: criticalRisk,
    },
    {
      icon: "⚠️",
      title:
        "High risk projects",
      text:
        "Recommended for review",
      value: highRisk,
    },
    {
      icon: "🤖",
      title:
        "AI anomalies detected",
      text:
        "Unusual project patterns",
      value: anomalies,
    },
  ];

  return (
    <>
      <div className="dashboard-header">
        <div className="header-content">
          <div className="header-description">
            <p className="eyebrow">
              MPLADS • RISK INTELLIGENCE
            </p>

            <h2>
              Government Project Monitoring
            </h2>

            <p>
              AI-powered monitoring of MPLADS
              projects to identify anomalies,
              delays, cost risks and unusual
              implementation patterns.
            </p>
          </div>

          <div className="header-meta">
            <div className="live-indicator">
              <span className="live-dot" />
              SYSTEM LIVE
            </div>

            <span className="updated-text">
              {new Date().toLocaleTimeString()}
            </span>

            <button
              className="refresh-button"
              onClick={refreshData}
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      </div>

      <section className="dashboard-hero">
        <div className="hero-main">
          <div className="hero-eyebrow">
            AI-POWERED GOVERNMENT INTELLIGENCE

            <span className="hero-live">
              ● ACTIVE
            </span>
          </div>

          <h1>
            Detect risk before it becomes
            <span> a problem.</span>
          </h1>

          <p>
            The MPLADS Risk Intelligence System
            continuously analyzes project cost,
            expenditure, progress, delays and
            anomaly patterns to help authorities
            prioritize verification.
          </p>

          <div className="hero-actions">
            <button
              className="primary-action"
              onClick={() => {
                document
                  .querySelector(
                    ".project-monitor-panel"
                  )
                  ?.scrollIntoView({
                    behavior:
                      "smooth",
                  });
              }}
            >
              View Priority Projects →
            </button>

            <span className="hero-note">
              AI decision support • Human
              verification required
            </span>
          </div>
        </div>

        <div className="hero-score">
          <div className="score-ring">
            <div>
              <strong>
                {priorityPercentage}%
              </strong>

              <span>
                High priority
              </span>
            </div>
          </div>

          <small>
            {highPriority} projects require
            attention
          </small>
        </div>
      </section>

      <section className="cards">
        <KpiCard
          icon="📁"
          label="TOTAL PROJECTS"
          value={total}
          description="Projects monitored by the platform"
          type="blue"
          progress={100}
        />

        <KpiCard
          icon="🤖"
          label="AI ANOMALIES"
          value={anomalies}
          description="Projects with unusual patterns"
          type="purple"
          progress={
            total > 0
              ? (anomalies /
                  total) *
                100
              : 0
          }
        />

        <KpiCard
          icon="⚠️"
          label="HIGH RISK"
          value={highRisk}
          description="Projects recommended for review"
          type="orange"
          progress={
            total > 0
              ? (highRisk /
                  total) *
                100
              : 0
          }
        />

        <KpiCard
          icon="🚨"
          label="CRITICAL"
          value={criticalRisk}
          description="Projects requiring immediate attention"
          type="red"
          progress={
            total > 0
              ? (criticalRisk /
                  total) *
                100
              : 0
          }
        />
      </section>

      <section className="dashboard-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">
                RISK DISTRIBUTION
              </p>

              <h3>
                Current Project Risk Profile
              </h3>

              <p className="table-description">
                AI-generated risk classification
                across monitored MPLADS projects.
              </p>
            </div>

            <div className="risk-total">
              <strong>
                {total}
              </strong>

              <span>
                TOTAL PROJECTS
              </span>
            </div>
          </div>

          <div className="risk-bars">
            <RiskBar
              label="Low"
              count={lowRisk}
              total={total}
              type="low"
            />

            <RiskBar
              label="Medium"
              count={mediumRisk}
              total={total}
              type="medium"
            />

            <RiskBar
              label="High"
              count={highRisk}
              total={total}
              type="high"
            />

            <RiskBar
              label="Critical"
              count={criticalRisk}
              total={total}
              type="critical"
            />
          </div>

          <div className="dashboard-risk-summary">
            {[
              [
                "Low",
                lowRisk,
                "low",
              ],
              [
                "Medium",
                mediumRisk,
                "medium",
              ],
              [
                "High",
                highRisk,
                "high",
              ],
              [
                "Critical",
                criticalRisk,
                "critical",
              ],
            ].map(
              ([label, count, type]) => (
                <div
                  className={`risk-summary-item ${type}`}
                  key={label}
                >
                  <div className="risk-summary-label">
                    <span className="risk-summary-dot" />
                    {label}
                  </div>

                  <strong>
                    {count}
                  </strong>

                  <small>
                    {total > 0
                      ? `${(
                          (count /
                            total) *
                          100
                        ).toFixed(1)}%`
                      : "0%"}
                  </small>
                </div>
              )
            )}
          </div>
        </div>

        <div className="panel intelligence-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">
                AI INTELLIGENCE
              </p>

              <h3>
                Attention Required
              </h3>

              <p className="table-description">
                Priority signals generated from
                the current risk engine.
              </p>
            </div>
          </div>

          <div className="attention-list">
            {attentionItems.map(
              (item, index) => (
                <div
                  className="attention-item"
                  key={index}
                >
                  <div className="attention-icon">
                    {item.icon}
                  </div>

                  <div className="attention-content">
                    <strong>
                      {item.title}
                    </strong>

                    <small>
                      {item.text}
                    </small>
                  </div>

                  <b>
                    {item.value}
                  </b>
                </div>
              )
            )}
          </div>

          <div className="intelligence-footer">
            <span>
              ENGINE STATUS
            </span>

            <strong>
              ● OPERATIONAL
            </strong>
          </div>
        </div>
      </section>

      <section className="panel project-monitor-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">
              PROJECT MONITOR
            </p>

            <h3>
              Risk-Based Project Queue
            </h3>

            <p className="table-description">
              Select a project to inspect detailed
              AI-generated risk information.
            </p>
          </div>

          <div className="queue-count">
            <strong>
              {filteredWorks.length}
            </strong>

            <span>
              MATCHING PROJECTS
            </span>
          </div>
        </div>

        <div className="filters">
          <div className="search-wrapper">
            <span>⌕</span>

            <input
              type="text"
              placeholder="Search work ID, state, district or work type..."
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
            />
          </div>

          <select
            value={riskFilter}
            onChange={(e) =>
              setRiskFilter(
                e.target.value
              )
            }
          >
            <option value="ALL">
              All Risk Levels
            </option>

            <option value="LOW">
              Low Risk
            </option>

            <option value="MEDIUM">
              Medium Risk
            </option>

            <option value="HIGH">
              High Risk
            </option>

            <option value="CRITICAL">
              Critical Risk
            </option>
          </select>

          <button
            onClick={() => {
              setSearch("");
              setRiskFilter(
                "ALL"
              );
            }}
          >
            Clear
          </button>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Work ID</th>
                <th>State</th>
                <th>Work Type</th>
                <th>Expenditure</th>
                <th>Progress</th>
                <th>Delay</th>
                <th>Risk Score</th>
                <th>Risk Level</th>
              </tr>
            </thead>

            <tbody>
              {filteredWorks
                .slice(0, 12)
                .map((work) => {
                  const progress =
                    Number(
                      work.Progress_Percentage
                    ) || 0;

                  const delay =
                    Number(
                      work.Delay_Days
                    ) || 0;

                  const riskLevel =
                    getRiskLevel(work);

                  return (
                    <tr
                      key={
                        work.Work_ID
                      }
                      className="clickable-row"
                      onClick={() =>
                        setSelectedWork(
                          work
                        )
                      }
                    >
                      <td>
                        <div className="work-id-cell">
                          <div className="work-icon">
                            📄
                          </div>

                          <strong>
                            {
                              work.Work_ID
                            }
                          </strong>
                        </div>
                      </td>

                      <td>
                        {work.State ||
                          "—"}
                      </td>

                      <td>
                        {work.Work_Type ||
                          "—"}
                      </td>

                      <td>
                        ₹
                        {formatCurrency(
                          work.Expenditure
                        )}
                      </td>

                      <td>
                        <div className="progress-cell">
                          <div className="mini-progress">
                            <div
                              style={{
                                width: `${Math.min(
                                  progress,
                                  100
                                )}%`,
                              }}
                            />
                          </div>

                          <span>
                            {progress}%
                          </span>
                        </div>
                      </td>

                      <td>
                        <span
                          className={
                            delay > 30
                              ? "delay-danger"
                              : ""
                          }
                        >
                          {delay} days
                        </span>
                      </td>

                      <td>
                        <strong className="risk-score-number">
                          {Number(
                            work.Risk_Score ||
                              0
                          ).toFixed(0)}
                        </strong>
                      </td>

                      <td>
                        <span
                          className={`badge ${riskLevel}`}
                        >
                          {riskLevel.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>

          {filteredWorks.length ===
            0 && (
            <div className="no-results">
              <span>⌕</span>

              <strong>
                No projects found
              </strong>

              <p>
                Try changing the search or risk
                filter.
              </p>
            </div>
          )}

          {filteredWorks.length >
            12 && (
            <div className="table-footer">
              Showing first 12 matching
              projects. Use Projects or Risk
              Alerts for detailed investigation.
            </div>
          )}
        </div>
      </section>

      <section className="dashboard-info-grid">
        <div className="panel">
          <p className="eyebrow">
            DECISION SUPPORT
          </p>

          <h3>
            How the intelligence layer works
          </h3>

          <p>
            The system combines anomaly detection,
            project progress, expenditure patterns,
            delays and risk scoring to identify
            projects that may require verification.
          </p>

          <div className="info-points">
            <div>
              <strong>01</strong>

              <span>
                Detect unusual patterns
              </span>
            </div>

            <div>
              <strong>02</strong>

              <span>
                Calculate project risk
              </span>
            </div>

            <div>
              <strong>03</strong>

              <span>
                Prioritize investigation
              </span>
            </div>

            <div>
              <strong>04</strong>

              <span>
                Support human verification
              </span>
            </div>
          </div>
        </div>

        <div className="panel">
          <p className="eyebrow">
            PLATFORM STATUS
          </p>

          <h3>
            System Health
          </h3>

          <div className="status-list">
            {[
              [
                "Backend API",
                "ONLINE",
              ],
              [
                "AI Risk Engine",
                "ACTIVE",
              ],
              [
                "Data Pipeline",
                "READY",
              ],
              [
                "Dashboard",
                "OPERATIONAL",
              ],
            ].map(
              ([label, status]) => (
                <div
                  className="status-row"
                  key={label}
                >
                  <div>
                    <span className="status-dot online" />

                    <span>
                      {label}
                    </span>
                  </div>

                  <strong className="online-text">
                    {status}
                  </strong>
                </div>
              )
            )}
          </div>
        </div>
      </section>

      <div className="dashboard-disclaimer">
        <span>⚠️</span>

        <p>
          <strong>
            AI decision-support notice:
          </strong>{" "}
          Risk scores and anomaly flags indicate
          projects that may require further
          verification. They do not independently
          establish fraud or wrongdoing.
        </p>
      </div>

      {selectedWork && (
        <ProjectModal
          work={selectedWork}
          onClose={() =>
            setSelectedWork(null)
          }
        />
      )}
    </>
  );
}

/* =========================================================
   PROJECT MODAL
   ========================================================= */

function ProjectModal({
  work,
  onClose,
}) {
  const riskLevel =
    getRiskLevel(work);

  const reasons = String(
    work.Risk_Reasons || ""
  )
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
    >
      <div
        className="modal"
        onClick={(e) =>
          e.stopPropagation()
        }
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">
              PROJECT RISK PROFILE
            </p>

            <h2>
              {work.Work_ID}
            </h2>

            <p>
              AI-generated project assessment
            </p>
          </div>

          <button
            className="close-button"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="risk-summary">
          <div>
            <span>
              Risk Score
            </span>

            <strong>
              {Number(
                work.Risk_Score || 0
              ).toFixed(0)}
            </strong>
          </div>

          <div>
            <span>
              Risk Level
            </span>

            <strong>
              <span
                className={`badge ${riskLevel}`}
              >
                {riskLevel.toUpperCase()}
              </span>
            </strong>
          </div>

          <div>
            <span>
              Anomaly Status
            </span>

            <strong>
              {work.Anomaly_Status ||
                "Normal"}
            </strong>
          </div>
        </div>

        <div className="details-grid">
          {[
            [
              "State",
              work.State,
            ],
            [
              "District",
              work.District,
            ],
            [
              "Work Type",
              work.Work_Type,
            ],
            [
              "Implementing Agency",
              work.Implementing_Agency,
            ],
            [
              "Sanction Amount",
              `₹${formatCurrency(
                work.Sanction_Amount
              )}`,
            ],
            [
              "Estimated Cost",
              `₹${formatCurrency(
                work.Estimated_Cost
              )}`,
            ],
            [
              "Expenditure",
              `₹${formatCurrency(
                work.Expenditure
              )}`,
            ],
            [
              "Progress",
              `${work.Progress_Percentage || 0}%`,
            ],
            [
              "Delay",
              `${work.Delay_Days || 0} days`,
            ],
            [
              "Status",
              work.Status,
            ],
          ].map(
            ([label, value]) => (
              <div key={label}>
                <label>
                  {label}
                </label>

                <p>
                  {value || "—"}
                </p>
              </div>
            )
          )}
        </div>

        <div className="ai-reasons">
          <h3>
            🤖 AI Risk Explanation
          </h3>

          <p>
            The risk engine identified the
            following signals:
          </p>

          {reasons.length > 0 ? (
            <ul>
              {reasons.map(
                (
                  reason,
                  index
                ) => (
                  <li
                    key={index}
                  >
                    {reason}
                  </li>
                )
              )}
            </ul>
          ) : (
            <p>
              No specific risk reason was
              recorded for this project.
            </p>
          )}

          <div className="verification-note">
            <strong>
              ⚠️ Verification:
            </strong>

            <span>
              This is an AI-generated alert
              for decision support. Human
              verification is required before
              drawing conclusions.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   SETTINGS PAGE
   ========================================================= */

function SettingsPage() {
  return (
    <>
      <header>
        <div>
          <p className="eyebrow">
            SYSTEM CONFIGURATION
          </p>

          <h2>
            Settings
          </h2>

          <p>
            Platform configuration and AI risk
            engine information.
          </p>
        </div>
      </header>

      <div className="settings-grid">
        <div className="panel settings-card">
          <div className="settings-icon">
            ⚙️
          </div>

          <h3>
            System Status
          </h3>

          <p>
            Current platform connectivity and
            operational status.
          </p>

          <div className="settings-detail">
            <span>
              Backend API
            </span>

            <strong className="online-text">
              ONLINE
            </strong>
          </div>

          <div className="settings-detail">
            <span>
              Dashboard
            </span>

            <strong className="online-text">
              OPERATIONAL
            </strong>
          </div>
        </div>

        <div className="panel settings-card">
          <div className="settings-icon">
            🤖
          </div>

          <h3>
            AI Risk Engine
          </h3>

          <p>
            Machine learning configuration used
            for anomaly and risk detection.
          </p>

          <div className="settings-detail">
            <span>
              Detection Model
            </span>

            <strong>
              Isolation Forest
            </strong>
          </div>

          <div className="settings-detail">
            <span>
              Engine Status
            </span>

            <strong className="online-text">
              ACTIVE
            </strong>
          </div>
        </div>

        <div className="panel settings-card">
          <div className="settings-icon">
            🎯
          </div>

          <h3>
            Risk Classification
          </h3>

          <p>
            Current risk classification levels
            used by the intelligence system.
          </p>

          {[
            [
              "low",
              "LOW — Normal monitoring",
            ],
            [
              "medium",
              "MEDIUM — Review recommended",
            ],
            [
              "high",
              "HIGH — Priority review",
            ],
            [
              "critical",
              "CRITICAL — Immediate attention",
            ],
          ].map(
            ([type, text]) => (
              <div
                className="risk-setting"
                key={type}
              >
                <span
                  className={`risk-dot ${type}`}
                />

                <small>
                  {text}
                </small>
              </div>
            )
          )}
        </div>

        <div className="panel settings-card">
          <div className="settings-icon">
            🔄
          </div>

          <h3>
            Data Pipeline
          </h3>

          <p>
            Current data processing pipeline
            status.
          </p>

          {[
            [
              "1",
              "Data Collection",
              "MPLADS project and allocation records",
            ],
            [
              "2",
              "Data Cleaning",
              "Validation and preprocessing",
            ],
            [
              "3",
              "AI / Analytics",
              "Risk detection and project analytics",
            ],
            [
              "4",
              "Dashboard",
              "Decision-support visualization",
            ],
          ].map(
            ([number, title, text]) => (
              <div
                className="pipeline-step"
                key={number}
              >
                <span>
                  {number}
                </span>

                <div>
                  <strong>
                    {title}
                  </strong>

                  <small>
                    {text}
                  </small>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      <div className="panel">
        <p className="eyebrow">
          IMPORTANT
        </p>

        <h3>
          AI Decision Support Notice
        </h3>

        <p
          style={{
            color: "#64748b",
            fontSize: "12px",
            lineHeight: 1.7,
          }}
        >
          AI-generated risk scores and anomaly
          indicators are intended to prioritize
          projects for human verification. The
          system does not independently determine
          fraud, corruption or wrongdoing.
        </p>
      </div>
    </>
  );
}

/* =========================================================
   ADMIN PAGE
   ========================================================= */

function AdminPage({
  dashboard,
}) {
  const total =
    Number(
      dashboard?.totalWorks
    ) || 0;

  const low =
    Number(
      dashboard?.lowRisk
    ) || 0;

  const medium =
    Number(
      dashboard?.mediumRisk
    ) || 0;

  const high =
    Number(
      dashboard?.highRisk
    ) || 0;

  const critical =
    Number(
      dashboard?.criticalRisk
    ) || 0;

  return (
    <>
      <header>
        <div>
          <p className="eyebrow">
            PLATFORM MANAGEMENT
          </p>

          <h2>
            Admin Control Center
          </h2>

          <p>
            System health, risk engine and
            platform monitoring.
          </p>
        </div>
      </header>

      <div className="admin-grid">
        <div className="panel">
          <p className="eyebrow">
            PLATFORM HEALTH
          </p>

          <h3>
            Current System Status
          </h3>

          <div className="status-list">
            {[
              [
                "Node.js API",
                "ONLINE",
              ],
              [
                "AI Engine",
                "ACTIVE",
              ],
              [
                "Data Pipeline",
                "READY",
              ],
              [
                "Frontend",
                "ONLINE",
              ],
            ].map(
              ([label, status]) => (
                <div
                  className="status-row"
                  key={label}
                >
                  <div>
                    <span className="status-dot online" />

                    <span>
                      {label}
                    </span>
                  </div>

                  <strong className="online-text">
                    {status}
                  </strong>
                </div>
              )
            )}
          </div>
        </div>

        <div className="panel">
          <p className="eyebrow">
            RISK ENGINE
          </p>

          <h3>
            Risk Distribution
          </h3>

          <div className="admin-risk-grid">
            {[
              [
                "low",
                low,
              ],
              [
                "medium",
                medium,
              ],
              [
                "high",
                high,
              ],
              [
                "critical",
                critical,
              ],
            ].map(
              ([type, count]) => (
                <div key={type}>
                  <span
                    className={`risk-dot ${type}`}
                  />

                  <strong>
                    {count}
                  </strong>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      <div className="panel">
        <p className="eyebrow">
          SYSTEM ARCHITECTURE
        </p>

        <h3>
          Intelligence Pipeline
        </h3>

        <div className="admin-pipeline">
          {[
            [
              "01",
              "MPLADS Data",
              "Government project and allocation records",
            ],
            [
              "02",
              "Data Processing",
              "Cleaning and validation",
            ],
            [
              "03",
              "AI / ML",
              "Isolation Forest anomaly detection",
            ],
            [
              "04",
              "Risk Engine",
              "Risk scoring and classification",
            ],
            [
              "05",
              "Dashboard",
              "Officer decision support",
            ],
          ].map(
            ([number, title, text]) => (
              <div key={number}>
                <span>
                  {number}
                </span>

                <strong>
                  {title}
                </strong>

                <small>
                  {text}
                </small>
              </div>
            )
          )}
        </div>
      </div>

      <div className="panel admin-warning">
        <p className="eyebrow">
          ADMIN NOTICE
        </p>

        <h3>
          Demo Environment
        </h3>

        <p>
          This SIH prototype currently uses
          locally generated/sample project data
          and uploaded datasets. Production
          deployment would connect to authorized
          MPLADS data sources, authentication,
          role-based access and audit logging.
        </p>
      </div>
    </>
  );
}

/* =========================================================
   PROJECTS PAGE
   ========================================================= */

function ProjectsPage({
  works,
  setSelectedWork,
}) {
  const [search, setSearch] =
    useState("");

  const [riskFilter, setRiskFilter] =
    useState("ALL");

  const filteredWorks =
    useMemo(
      () =>
        filterWorks(
          works,
          search,
          riskFilter
        ),
      [
        works,
        search,
        riskFilter,
      ]
    );

  return (
    <>
      <header>
        <div>
          <p className="eyebrow">
            MPLADS PROJECT DATABASE
          </p>

          <h2>
            Projects
          </h2>

          <p>
            Search and inspect monitored MPLADS
            projects.
          </p>
        </div>
      </header>

      <div className="panel">
        <div className="filters">
          <div className="search-wrapper">
            <span>⌕</span>

            <input
              placeholder="Search projects..."
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
            />
          </div>

          <select
            value={riskFilter}
            onChange={(e) =>
              setRiskFilter(
                e.target.value
              )
            }
          >
            <option value="ALL">
              All Risk Levels
            </option>

            <option value="LOW">
              Low
            </option>

            <option value="MEDIUM">
              Medium
            </option>

            <option value="HIGH">
              High
            </option>

            <option value="CRITICAL">
              Critical
            </option>
          </select>

          <button
            onClick={() => {
              setSearch("");
              setRiskFilter(
                "ALL"
              );
            }}
          >
            Clear
          </button>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Work ID</th>
                <th>State</th>
                <th>District</th>
                <th>Work Type</th>
                <th>Progress</th>
                <th>Risk Score</th>
                <th>Risk Level</th>
              </tr>
            </thead>

            <tbody>
              {filteredWorks
                .slice(0, 30)
                .map((work) => {
                  const level =
                    getRiskLevel(work);

                  return (
                    <tr
                      key={
                        work.Work_ID
                      }
                      className="clickable-row"
                      onClick={() =>
                        setSelectedWork(
                          work
                        )
                      }
                    >
                      <td>
                        <strong>
                          {
                            work.Work_ID
                          }
                        </strong>
                      </td>

                      <td>
                        {
                          work.State
                        }
                      </td>

                      <td>
                        {
                          work.District
                        }
                      </td>

                      <td>
                        {
                          work.Work_Type
                        }
                      </td>

                      <td>
                        {work.Progress_Percentage ||
                          0}
                        %
                      </td>

                      <td>
                        <strong className="risk-score-number">
                          {Number(
                            work.Risk_Score ||
                              0
                          ).toFixed(0)}
                        </strong>
                      </td>

                      <td>
                        <span
                          className={`badge ${level}`}
                        >
                          {level.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>

          {filteredWorks.length ===
            0 && (
            <div className="no-results">
              <span>⌕</span>

              <strong>
                No projects found
              </strong>

              <p>
                Try another search.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* =========================================================
   APP
   ========================================================= */

function App() {
  const [works, setWorks] =
    useState([]);

  const [dashboard, setDashboard] =
    useState(
      DEFAULT_DASHBOARD
    );

  const [loading, setLoading] =
    useState(true);

  const [search, setSearch] =
    useState("");

  const [riskFilter, setRiskFilter] =
    useState("ALL");

  const [selectedWork, setSelectedWork] =
    useState(null);

  const [activePage, setActivePage] =
    useState("dashboard");

  /* =======================================================
     LOAD PROJECT DATA
     ======================================================= */

  const loadData =
    useCallback(async () => {
      try {
        setLoading(true);

        const [
          worksResponse,
          dashboardResponse,
        ] =
          await Promise.all([
            axios.get(
              `${API_BASE_URL}/works`
            ),

            axios.get(
              `${API_BASE_URL}/dashboard`
            ),
          ]);

        const worksData =
          worksResponse?.data?.data;

        const dashboardData =
          dashboardResponse?.data?.data;

        setWorks(
          Array.isArray(
            worksData
          )
            ? worksData
            : []
        );

        setDashboard(
          dashboardData &&
            typeof dashboardData ===
              "object"
            ? {
                ...DEFAULT_DASHBOARD,
                ...dashboardData,
              }
            : DEFAULT_DASHBOARD
        );
      } catch (error) {
        console.error(
          "Unable to load MPLADS data:",
          error
        );

        setWorks([]);
        setDashboard(
          DEFAULT_DASHBOARD
        );
      } finally {
        setLoading(false);
      }
    }, []);

  /* =======================================================
     INITIAL LOAD
     ======================================================= */

  useEffect(() => {
    loadData();
  }, [
    loadData,
  ]);

  /* =======================================================
     UPLOAD COMPLETE
     ======================================================= */

  const handleUploadComplete =
    useCallback(
      async (uploadResult) => {
        const type =
          String(
            uploadResult?.datasetType ||
              ""
          ).toUpperCase();

        /*
          Allocation uploads are still supported
          by the Upload Data page.

          Allocation Analytics page has been removed,
          so only project uploads refresh the project
          dashboard.
        */

        if (
          type !==
          "ALLOCATION"
        ) {
          await loadData();
        }
      },
      [
        loadData,
      ]
    );

  /* =======================================================
     LOADING
     ======================================================= */

  if (loading) {
    return (
      <div className="loading">
        <div>
          <div className="loading-icon">
            ◈
          </div>

          <h2>
            MPLADS Risk Intelligence
          </h2>

          <p>
            Loading AI project intelligence...
          </p>
        </div>
      </div>
    );
  }

  /* =======================================================
     PAGE ROUTER
     ======================================================= */

  const renderPage = () => {
    if (
      activePage ===
      "upload"
    ) {
      return (
        <UploadData
          onUploadComplete={
            handleUploadComplete
          }
        />
      );
    }

    if (
      activePage ===
      "alerts"
    ) {
      return (
        <RiskAlerts
          works={works}
        />
      );
    }

    if (
      activePage ===
      "analytics"
    ) {
      return (
        <Analytics
          works={works}
        />
      );
    }

    if (
      activePage ===
      "map"
    ) {
      return (
        <MapView
          works={works}
        />
      );
    }

    if (
      activePage ===
      "settings"
    ) {
      return (
        <SettingsPage />
      );
    }

    if (
      activePage ===
      "admin"
    ) {
      return (
        <AdminPage
          dashboard={
            dashboard
          }
        />
      );
    }

    if (
      activePage ===
      "projects"
    ) {
      return (
        <ProjectsPage
          works={works}
          setSelectedWork={
            setSelectedWork
          }
        />
      );
    }

    return (
      <Dashboard
        works={works}
        dashboard={
          dashboard
        }
        search={search}
        setSearch={
          setSearch
        }
        riskFilter={
          riskFilter
        }
        setRiskFilter={
          setRiskFilter
        }
        selectedWork={
          selectedWork
        }
        setSelectedWork={
          setSelectedWork
        }
        refreshData={
          loadData
        }
      />
    );
  };

  return (
    <div className="app">
      {/* =====================================================
          SIDEBAR
          ===================================================== */}

      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">
            ◈
          </div>

          <div>
            <h1>
              MPLADS
            </h1>

            <div className="subtitle">
              Risk Intelligence
            </div>
          </div>
        </div>

        <div className="sidebar-section-title">
          Main
        </div>

        <nav>
          <SidebarItem
            icon="▦"
            label="Dashboard"
            active={
              activePage ===
              "dashboard"
            }
            onClick={() =>
              setActivePage(
                "dashboard"
              )
            }
          />

          <SidebarItem
            icon="⚠"
            label="Risk Alerts"
            count={
              dashboard?.criticalRisk ||
              0
            }
            active={
              activePage ===
              "alerts"
            }
            onClick={() =>
              setActivePage(
                "alerts"
              )
            }
          />

          <SidebarItem
            icon="▣"
            label="Projects"
            active={
              activePage ===
              "projects"
            }
            onClick={() =>
              setActivePage(
                "projects"
              )
            }
          />

          <SidebarItem
            icon="▥"
            label="Analytics"
            active={
              activePage ===
              "analytics"
            }
            onClick={() =>
              setActivePage(
                "analytics"
              )
            }
          />

          <SidebarItem
            icon="⌖"
            label="Map View"
            active={
              activePage ===
              "map"
            }
            onClick={() =>
              setActivePage(
                "map"
              )
            }
          />

          <SidebarItem
            icon="⇧"
            label="Upload Data"
            active={
              activePage ===
              "upload"
            }
            onClick={() =>
              setActivePage(
                "upload"
              )
            }
          />
        </nav>

        <div className="sidebar-spacer" />

        <div className="sidebar-section-title">
          System
        </div>

        <div className="sidebar-bottom">
          <SidebarItem
            icon="⚙"
            label="Settings"
            active={
              activePage ===
              "settings"
            }
            onClick={() =>
              setActivePage(
                "settings"
              )
            }
          />

          <SidebarItem
            icon="♙"
            label="Admin"
            active={
              activePage ===
              "admin"
            }
            onClick={() =>
              setActivePage(
                "admin"
              )
            }
          />
        </div>

        <div className="sidebar-footer">
          <div className="footer-status">
            <span className="status-dot online" />

            <span>
              AI Risk Engine
            </span>

            <strong
              style={{
                marginLeft:
                  "auto",
                color:
                  "#22c55e",
                fontSize:
                  "9px",
              }}
            >
              ONLINE
            </strong>
          </div>

          <small>
            MPLADS Intelligence Platform
          </small>
        </div>
      </aside>

      {/* =====================================================
          MAIN CONTENT
          ===================================================== */}

      <main className="main">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;