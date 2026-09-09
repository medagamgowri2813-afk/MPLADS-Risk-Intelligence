import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [selectedProject, setSelectedProject] = useState(null);

  // =====================================================
  // FLEXIBLE FIELD READER
  // Handles different CSV / backend column naming styles
  // =====================================================

  const getField = (project, possibleNames, fallback = "") => {
    if (!project || typeof project !== "object") {
      return fallback;
    }

    const keys = Object.keys(project);

    for (const name of possibleNames) {
      if (
        Object.prototype.hasOwnProperty.call(
          project,
          name
        )
      ) {
        const value = project[name];

        if (
          value !== null &&
          value !== undefined &&
          String(value).trim() !== ""
        ) {
          return value;
        }
      }
    }

    // Case-insensitive + normalized matching
    const normalize = (value) =>
      String(value)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

    const normalizedTargets =
      possibleNames.map(normalize);

    const matchingKey = keys.find((key) =>
      normalizedTargets.includes(
        normalize(key)
      )
    );

    if (matchingKey) {
      const value = project[matchingKey];

      if (
        value !== null &&
        value !== undefined &&
        String(value).trim() !== ""
      ) {
        return value;
      }
    }

    return fallback;
  };

  // =====================================================
  // COMMON PROJECT FIELDS
  // =====================================================

  const getWorkId = (project) =>
    getField(
      project,
      [
        "work_id",
        "Work_ID",
        "Work ID",
        "WORK_ID",
        "id",
        "ID",
        "workid",
      ],
      "Not provided"
    );

  const getProjectName = (project) =>
    getField(
      project,
      [
        "work",
        "Work",
        "work_description",
        "Work_Description",
        "Work Description",
        "description",
        "Description",
        "project_name",
        "Project_Name",
        "Project Name",
      ],
      "MPLADS Project"
    );

  const getState = (project) =>
    getField(
      project,
      [
        "state",
        "State",
        "STATE",
      ],
      "Not provided"
    );

  const getDistrict = (project) =>
    getField(
      project,
      [
        "district",
        "District",
        "DISTRICT",
        "city",
        "City",
      ],
      "Not provided"
    );

  const getConstituency = (project) =>
    getField(
      project,
      [
        "constituency",
        "Constituency",
        "CONSTITUENCY",
      ],
      "Not provided"
    );

  const getWorkType = (project) =>
    getField(
      project,
      [
        "category",
        "Category",
        "work_type",
        "Work_Type",
        "Work Type",
        "worktype",
      ],
      "Not provided"
    );

  const getStatus = (project) =>
    getField(
      project,
      [
        "status",
        "Status",
        "STATUS",
      ],
      "Not provided"
    );

  const getExpenditure = (project) =>
    getField(
      project,
      [
        "expenditure",
        "Expenditure",
        "EXPENDITURE",
        "actual_expenditure",
        "Actual_Expenditure",
      ],
      0
    );

  const getAllocationAmount = (project) =>
    getField(
      project,
      [
        "allocation_amount",
        "Allocation_Amount",
        "Allocation Amount",
        "allocated_amount",
        "Allocated_Amount",
        "sanction_amount",
        "Sanction_Amount",
        "Sanction Amount",
      ],
      0
    );

  const getEstimatedCost = (project) =>
    getField(
      project,
      [
        "estimated_cost",
        "Estimated_Cost",
        "Estimated Cost",
      ],
      0
    );

  const getProgressValue = (project) =>
    getField(
      project,
      [
        "progress_percentage",
        "Progress_Percentage",
        "Progress %",
        "progress",
        "Progress",
        "progress_percent",
      ],
      null
    );

  const getDelayValue = (project) =>
    getField(
      project,
      [
        "days_since_recommendation",
        "Days_Since_Recommendation",
        "delay_days",
        "Delay_Days",
        "Delay Days",
        "delay",
        "Delay",
      ],
      null
    );

  // =====================================================
  // FETCH PROJECTS
  // =====================================================

  const fetchProjects = async () => {
    try {
      setLoading(true);

      const response = await axios.get(
        "http://localhost:5000/api/works"
      );

      console.log(
        "PROJECT API RESPONSE:",
        response.data
      );

      if (
        response.data &&
        Array.isArray(response.data.data)
      ) {
        setProjects(response.data.data);
      } else {
        setProjects([]);
      }
    } catch (error) {
      console.error(
        "Failed to fetch projects:",
        error
      );

      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // =====================================================
  // RISK CLASS
  // =====================================================

  const getRiskLevel = (project) =>
    String(
      getField(
        project,
        [
          "Risk_Level",
          "risk_level",
          "Risk Level",
          "riskLevel",
        ],
        "LOW"
      )
    ).toUpperCase();

  const getRiskClass = (risk) => {
    const value = String(
      risk || "LOW"
    ).toUpperCase();

    if (value === "CRITICAL") {
      return "critical";
    }

    if (value === "HIGH") {
      return "high";
    }

    if (value === "MEDIUM") {
      return "medium";
    }

    return "low";
  };

  // =====================================================
  // RISK SCORE
  // =====================================================

  const getRiskScore = (project) => {
    const value = getField(
      project,
      [
        "Risk_Score",
        "risk_score",
        "Risk Score",
        "riskScore",
      ],
      0
    );

    const score = Number(value);

    return Number.isFinite(score)
      ? score
      : 0;
  };

  // =====================================================
  // ANOMALY SCORE
  // =====================================================

  const getAnomalyScore = (project) => {
    const value = getField(
      project,
      [
        "Anomaly_Risk_Score",
        "anomaly_risk_score",
        "Anomaly Risk Score",
        "anomaly_score",
      ],
      0
    );

    const score = Number(value);

    return Number.isFinite(score)
      ? score
      : 0;
  };

  // =====================================================
  // PROGRESS
  // =====================================================

  const getProgress = (project) => {
    const directProgress =
      getProgressValue(project);

    if (
      directProgress !== null &&
      directProgress !== ""
    ) {
      const numeric = Number(
        String(directProgress)
          .replace("%", "")
          .trim()
      );

      if (Number.isFinite(numeric)) {
        return Math.max(
          0,
          Math.min(100, numeric)
        );
      }
    }

    const status = getStatus(project)
      .toString()
      .toUpperCase();

    if (
      status.includes("COMPLETED") ||
      status.includes("COMPLETE")
    ) {
      return 100;
    }

    if (
      status.includes("ONGOING") ||
      status.includes("IMPLEMENTATION") ||
      status.includes("PROGRESS")
    ) {
      return 60;
    }

    return 0;
  };

  // =====================================================
  // DELAY
  // =====================================================

  const getDelay = (project) => {
    const directDelay =
      getDelayValue(project);

    if (
      directDelay !== null &&
      directDelay !== ""
    ) {
      const numeric = Number(
        String(directDelay)
          .replace(/[^0-9.-]/g, "")
      );

      if (Number.isFinite(numeric)) {
        return Math.max(0, numeric);
      }
    }

    return 0;
  };

  // =====================================================
  // FORMAT AMOUNT
  // =====================================================

  const formatAmount = (value) => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "₹0";
    }

    let cleanValue = String(value)
      .replace(/₹/g, "")
      .replace(/,/g, "")
      .trim();

    const amount = Number(cleanValue);

    if (!Number.isFinite(amount)) {
      return "₹0";
    }

    return new Intl.NumberFormat(
      "en-IN",
      {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }
    ).format(amount);
  };

  // =====================================================
  // RISK COUNTS
  // =====================================================

  const riskCounts = useMemo(() => {
    return {
      all: projects.length,

      critical: projects.filter(
        (project) =>
          getRiskLevel(project) ===
          "CRITICAL"
      ).length,

      high: projects.filter(
        (project) =>
          getRiskLevel(project) ===
          "HIGH"
      ).length,

      medium: projects.filter(
        (project) =>
          getRiskLevel(project) ===
          "MEDIUM"
      ).length,

      low: projects.filter(
        (project) =>
          getRiskLevel(project) ===
          "LOW"
      ).length,
    };
  }, [projects]);

  // =====================================================
  // FILTER PROJECTS
  // =====================================================

  const filteredProjects = useMemo(() => {
    const searchValue =
      search.trim().toLowerCase();

    return projects.filter(
      (project) => {
        const risk =
          getRiskLevel(project);

        const searchableText = `
          ${getWorkId(project)}
          ${getProjectName(project)}
          ${getState(project)}
          ${getConstituency(project)}
          ${getDistrict(project)}
          ${getWorkType(project)}
          ${getStatus(project)}
        `.toLowerCase();

        const matchesSearch =
          searchValue === "" ||
          searchableText.includes(
            searchValue
          );

        const matchesRisk =
          riskFilter === "ALL" ||
          risk === riskFilter;

        return (
          matchesSearch &&
          matchesRisk
        );
      }
    );
  }, [
    projects,
    search,
    riskFilter,
  ]);

  // =====================================================
  // CLEAR FILTER
  // =====================================================

  const clearFilters = () => {
    setSearch("");
    setRiskFilter("ALL");
  };

  // =====================================================
  // RETURN
  // =====================================================

  return (
    <div className="projects-page">

      {/* PAGE HEADER */}

      <div className="page-header">

        <div>
          <p className="eyebrow">
            PROJECT MONITOR
          </p>

          <h1>
            MPLADS Projects
          </h1>

          <p>
            Explore MPLADS projects analyzed by
            the AI Risk Intelligence System.
          </p>
        </div>

        <button
          className="refresh-btn"
          onClick={fetchProjects}
        >
          ↻ Refresh Projects
        </button>

      </div>

      {/* PROJECT STATISTICS */}

      <div className="project-stats">

        <div className="project-stat-card">
          <span>Total Projects</span>
          <strong>
            {riskCounts.all}
          </strong>
        </div>

        <div className="project-stat-card critical-card">
          <span>Critical</span>
          <strong>
            {riskCounts.critical}
          </strong>
        </div>

        <div className="project-stat-card high-card">
          <span>High Risk</span>
          <strong>
            {riskCounts.high}
          </strong>
        </div>

        <div className="project-stat-card medium-card">
          <span>Medium Risk</span>
          <strong>
            {riskCounts.medium}
          </strong>
        </div>

        <div className="project-stat-card low-card">
          <span>Low Risk</span>
          <strong>
            {riskCounts.low}
          </strong>
        </div>

      </div>

      {/* SEARCH */}

      <div className="project-toolbar">

        <input
          type="text"
          value={search}
          placeholder="Search Work ID, project name, state, district..."
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
          style={{
            color: "#111827",
            backgroundColor: "#ffffff",
            WebkitTextFillColor: "#111827",
            caretColor: "#111827",
          }}
        />

        <select
          value={riskFilter}
          onChange={(event) =>
            setRiskFilter(
              event.target.value
            )
          }
          style={{
            color: "#111827",
            backgroundColor: "#ffffff",
          }}
        >
          <option value="ALL">
            All Risk Levels
          </option>

          <option value="CRITICAL">
            Critical
          </option>

          <option value="HIGH">
            High
          </option>

          <option value="MEDIUM">
            Medium
          </option>

          <option value="LOW">
            Low
          </option>
        </select>

        {(search ||
          riskFilter !== "ALL") && (
          <button
            type="button"
            onClick={clearFilters}
            style={{
              border: "1px solid #d1d5db",
              background: "#ffffff",
              color: "#374151",
              padding: "10px 14px",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Clear
          </button>
        )}

      </div>

      {/* TABLE */}

      <div className="projects-table-card">

        <div className="table-heading">

          <div>

            <p className="eyebrow">
              RISK-BASED PROJECT QUEUE
            </p>

            <h2>
              MPLADS Project Records
            </h2>

            <span>
              Showing{" "}
              {filteredProjects.length}{" "}
              of{" "}
              {projects.length}{" "}
              projects
            </span>

          </div>

        </div>

        {/* LOADING */}

        {loading ? (

          <div className="projects-loading">
            Loading project data...
          </div>

        ) : filteredProjects.length === 0 ? (

          <div className="projects-empty">

            <div className="empty-icon">
              📁
            </div>

            <h3>
              No Projects Found
            </h3>

            <p>
              Try changing the search text
              or risk filter.
            </p>

          </div>

        ) : (

          <div className="projects-table-wrapper">

            <table className="projects-table">

              <thead>

                <tr>

                  <th>Work ID</th>
                  <th>Project Name</th>
                  <th>State</th>
                  <th>Constituency</th>
                  <th>District</th>
                  <th>Work Type</th>
                  <th>Expenditure</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Delay</th>
                  <th>Risk Score</th>
                  <th>Risk Level</th>

                </tr>

              </thead>

              <tbody>

                {filteredProjects.map(
                  (project, index) => {

                    const risk =
                      getRiskLevel(project);

                    const score =
                      getRiskScore(project);

                    const progress =
                      getProgress(project);

                    const delay =
                      getDelay(project);

                    return (
                      <tr
                        key={
                          getWorkId(project) !==
                          "Not provided"
                            ? getWorkId(project)
                            : `project-${index}`
                        }
                        onClick={() =>
                          setSelectedProject(
                            project
                          )
                        }
                        style={{
                          cursor: "pointer",
                        }}
                      >

                        {/* WORK ID */}

                        <td>
                          <strong>
                            {getWorkId(project)}
                          </strong>
                        </td>

                        {/* PROJECT NAME */}

                        <td>
                          <strong>
                            {getProjectName(
                              project
                            )}
                          </strong>
                        </td>

                        {/* STATE */}

                        <td>
                          {getState(project)}
                        </td>

                        {/* CONSTITUENCY */}

                        <td>
                          {getConstituency(
                            project
                          )}
                        </td>

                        {/* DISTRICT */}

                        <td>
                          {getDistrict(project)}
                        </td>

                        {/* WORK TYPE */}

                        <td>
                          {getWorkType(project)}
                        </td>

                        {/* EXPENDITURE */}

                        <td>
                          {formatAmount(
                            getExpenditure(project)
                          )}
                        </td>

                        {/* STATUS */}

                        <td>
                          {getStatus(project)}
                        </td>

                        {/* PROGRESS */}

                        <td>

                          <div className="progress-cell">

                            <div className="progress-track">

                              <div
                                className="progress-fill"
                                style={{
                                  width:
                                    `${progress}%`,
                                }}
                              />

                            </div>

                            <span>
                              {progress}%
                            </span>

                          </div>

                        </td>

                        {/* DELAY */}

                        <td>
                          {delay} days
                        </td>

                        {/* RISK SCORE */}

                        <td>
                          <strong className="risk-score">
                            {score.toFixed(0)}
                          </strong>
                        </td>

                        {/* RISK LEVEL */}

                        <td>

                          <span
                            className={`project-risk-badge ${getRiskClass(
                              risk
                            )}`}
                          >
                            {risk}
                          </span>

                        </td>

                      </tr>
                    );
                  }
                )}

              </tbody>

            </table>

          </div>

        )}

      </div>

      {/* =====================================================
          PROJECT DETAILS MODAL
      ===================================================== */}

      {selectedProject && (

        <div
          className="project-modal-overlay"
          onClick={() =>
            setSelectedProject(null)
          }
        >

          <div
            className="project-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            {/* HEADER */}

            <div className="project-modal-header">

              <div>

                <span className="modal-label">
                  Project Risk Analysis
                </span>

                <h2>
                  {getWorkId(
                    selectedProject
                  )}
                </h2>

              </div>

              <button
                className="modal-close"
                onClick={() =>
                  setSelectedProject(null)
                }
              >
                ×
              </button>

            </div>

            {/* PROJECT NAME */}

            <div
              style={{
                marginBottom: "20px",
              }}
            >

              <span className="modal-label">
                Project Name
              </span>

              <h3>
                {getProjectName(
                  selectedProject
                )}
              </h3>

            </div>

            {/* LOCATION */}

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(2, 1fr)",
                gap: "16px",
                marginBottom: "20px",
              }}
            >

              <div>
                <span className="modal-label">
                  State
                </span>

                <h3>
                  {getState(
                    selectedProject
                  )}
                </h3>
              </div>

              <div>
                <span className="modal-label">
                  District
                </span>

                <h3>
                  {getDistrict(
                    selectedProject
                  )}
                </h3>
              </div>

              <div>
                <span className="modal-label">
                  Constituency
                </span>

                <h3>
                  {getConstituency(
                    selectedProject
                  )}
                </h3>
              </div>

              <div>
                <span className="modal-label">
                  Work Type
                </span>

                <h3>
                  {getWorkType(
                    selectedProject
                  )}
                </h3>
              </div>

            </div>

            {/* FINANCIAL INFORMATION */}

            <div
              style={{
                marginBottom: "20px",
              }}
            >

              <span className="modal-label">
                Financial Information
              </span>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(3, 1fr)",
                  gap: "12px",
                  marginTop: "10px",
                }}
              >

                <div>
                  <small>
                    Estimated Cost
                  </small>

                  <strong>
                    {formatAmount(
                      getEstimatedCost(
                        selectedProject
                      )
                    )}
                  </strong>
                </div>

                <div>
                  <small>
                    Expenditure
                  </small>

                  <strong>
                    {formatAmount(
                      getExpenditure(
                        selectedProject
                      )
                    )}
                  </strong>
                </div>

                <div>
                  <small>
                    Allocation / Sanction
                  </small>

                  <strong>
                    {formatAmount(
                      getAllocationAmount(
                        selectedProject
                      )
                    )}
                  </strong>
                </div>

              </div>

            </div>

            {/* PROJECT STATUS */}

            <div
              style={{
                marginBottom: "20px",
              }}
            >

              <span className="modal-label">
                Implementation
              </span>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(3, 1fr)",
                  gap: "12px",
                  marginTop: "10px",
                }}
              >

                <div>
                  <small>
                    Status
                  </small>

                  <strong>
                    {getStatus(
                      selectedProject
                    )}
                  </strong>
                </div>

                <div>
                  <small>
                    Progress
                  </small>

                  <strong>
                    {getProgress(
                      selectedProject
                    )}%
                  </strong>
                </div>

                <div>
                  <small>
                    Delay
                  </small>

                  <strong>
                    {getDelay(
                      selectedProject
                    )} days
                  </strong>
                </div>

              </div>

            </div>

            {/* RISK SECTION */}

            <div className="modal-risk-section">

              <div className="modal-risk-score">

                <span className="modal-label">
                  AI Risk Score
                </span>

                <strong>
                  {getRiskScore(
                    selectedProject
                  ).toFixed(0)}
                </strong>

              </div>

              <div>

                <span className="modal-label">
                  Risk Level
                </span>

                <div
                  style={{
                    marginTop: "8px",
                  }}
                >

                  <span
                    className={`project-risk-badge ${getRiskClass(
                      getRiskLevel(
                        selectedProject
                      )
                    )}`}
                  >
                    {getRiskLevel(
                      selectedProject
                    )}
                  </span>

                </div>

              </div>

            </div>

            {/* ANOMALY */}

            <div
              style={{
                marginTop: "20px",
              }}
            >

              <span className="modal-label">
                AI Anomaly Indicator
              </span>

              <p
                style={{
                  marginTop: "8px",
                  color: "#4b5563",
                }}
              >
                Anomaly score:{" "}
                <strong>
                  {getAnomalyScore(
                    selectedProject
                  ).toFixed(2)}
                </strong>
              </p>

            </div>

            {/* DISCLAIMER */}

            <div
              style={{
                marginTop: "20px",
                padding: "14px",
                borderRadius: "10px",
                background:
                  "#f8fafc",
                border:
                  "1px solid #e5e7eb",
              }}
            >

              <strong>
                AI Decision Support
              </strong>

              <p
                style={{
                  marginTop: "6px",
                  fontSize: "13px",
                  color: "#6b7280",
                }}
              >
                This risk indicator highlights
                unusual patterns that may require
                human verification. It does not
                independently establish fraud or
                wrongdoing.
              </p>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}

export default Projects;