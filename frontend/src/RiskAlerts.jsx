import { useMemo, useState } from "react";
import "./App.css";

function RiskAlerts({ works = [] }) {
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selectedWork, setSelectedWork] = useState(null);

  const stats = useMemo(() => {
    return {
      critical: works.filter(
        (w) => w.Risk_Level === "CRITICAL"
      ).length,

      high: works.filter(
        (w) => w.Risk_Level === "HIGH"
      ).length,

      medium: works.filter(
        (w) => w.Risk_Level === "MEDIUM"
      ).length,

      anomalies: works.filter(
        (w) =>
          w.Anomaly_Status === "Anomaly" ||
          String(w.Anomaly) === "1"
      ).length,
    };
  }, [works]);

  const filteredAlerts = useMemo(() => {
    return works
      .filter((work) => {
        const level = String(
          work.Risk_Level || ""
        ).toUpperCase();

        const searchText =
          search.trim().toLowerCase();

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
          level === riskFilter;

        return (
          matchesSearch &&
          matchesRisk &&
          (level === "CRITICAL" ||
            level === "HIGH" ||
            level === "MEDIUM")
        );
      })
      .sort(
        (a, b) =>
          Number(b.Risk_Score || 0) -
          Number(a.Risk_Score || 0)
      );
  }, [works, riskFilter, search]);

  return (
    <>
      {/* =====================================================
          PAGE HEADER
          ===================================================== */}

      <header className="page-header">
        <div>
          <p className="eyebrow">
            AI RISK MONITORING
          </p>

          <h2>
            Risk Alerts
          </h2>

          <p>
            Review AI-generated alerts and
            prioritize MPLADS projects that may
            require further verification.
          </p>
        </div>

        <div className="alerts-header-status">
          <span className="status-dot online" />
          <span>
            AI ENGINE ACTIVE
          </span>
        </div>
      </header>

      {/* =====================================================
          ALERT SUMMARY CARDS
          ===================================================== */}

      <section className="cards alerts-summary-cards">
        <AlertStatCard
          icon="🚨"
          label="CRITICAL ALERTS"
          value={stats.critical}
          description="Immediate verification recommended"
          type="critical"
        />

        <AlertStatCard
          icon="⚠️"
          label="HIGH RISK"
          value={stats.high}
          description="Priority review recommended"
          type="high"
        />

        <AlertStatCard
          icon="◈"
          label="MEDIUM RISK"
          value={stats.medium}
          description="Enhanced monitoring recommended"
          type="medium"
        />

        <AlertStatCard
          icon="🤖"
          label="AI ANOMALIES"
          value={stats.anomalies}
          description="Unusual project patterns detected"
          type="anomaly"
        />
      </section>

      {/* =====================================================
          PRIORITY BANNER
          ===================================================== */}

      <section className="alert-priority-banner">
        <div className="priority-banner-icon">
          ⚡
        </div>

        <div className="priority-banner-content">
          <span>
            PRIORITY QUEUE
          </span>

          <strong>
            {stats.critical + stats.high} projects
            currently require attention
          </strong>

          <p>
            These alerts are ranked using the AI
            risk score and should be reviewed by
            authorized officials.
          </p>
        </div>

        <div className="priority-banner-score">
          <strong>
            {stats.critical}
          </strong>

          <span>
            CRITICAL
          </span>
        </div>
      </section>

      {/* =====================================================
          ALERT MANAGEMENT
          ===================================================== */}

      <section className="panel alerts-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">
              ALERT QUEUE
            </p>

            <h3>
              AI-Generated Risk Alerts
            </h3>

            <p className="table-description">
              Projects are ranked from highest to
              lowest risk score.
            </p>
          </div>

          <div className="alert-queue-count">
            <strong>
              {filteredAlerts.length}
            </strong>

            <span>
              ALERTS
            </span>
          </div>
        </div>

        {/* ===================================================
            SEARCH + FILTER
            =================================================== */}

        <div className="filters alert-filters">
          <div className="search-wrapper">
            <span>
              ⌕
            </span>

            <input
              type="text"
              placeholder="Search Work ID, State, District..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
            />
          </div>

          <select
            value={riskFilter}
            onChange={(e) =>
              setRiskFilter(e.target.value)
            }
          >
            <option value="ALL">
              All Alerts
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
          </select>

          <button
            onClick={() => {
              setSearch("");
              setRiskFilter("ALL");
            }}
          >
            Clear
          </button>
        </div>

        {/* ===================================================
            ALERT LIST
            =================================================== */}

        <div className="alert-list">
          {filteredAlerts.map(
            (work, index) => (
              <AlertRow
                key={
                  work.Work_ID ||
                  `${index}-${work.State}`
                }
                work={work}
                onClick={() =>
                  setSelectedWork(work)
                }
              />
            )
          )}

          {filteredAlerts.length === 0 && (
            <div className="no-results">
              <span>
                ✓
              </span>

              <strong>
                No matching alerts
              </strong>

              <p>
                Try changing the search or risk
                filter.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* =====================================================
          AI EXPLANATION
          ===================================================== */}

      <section className="alerts-explanation-grid">
        <div className="panel">
          <p className="eyebrow">
            HOW ALERTS ARE GENERATED
          </p>

          <h3>
            AI Risk Detection Pipeline
          </h3>

          <p className="explanation-text">
            The system evaluates multiple project
            signals to identify patterns that may
            deserve additional scrutiny.
          </p>

          <div className="alert-signal-list">
            <SignalItem
              icon="◉"
              title="Cost deviation"
              text="Compares sanctioned amount, estimated cost and expenditure."
            />

            <SignalItem
              icon="◷"
              title="Project delays"
              text="Identifies projects with unusually high delay periods."
            />

            <SignalItem
              icon="◈"
              title="Progress anomalies"
              text="Checks whether reported progress matches project activity."
            />

            <SignalItem
              icon="⊙"
              title="Pattern anomalies"
              text="Machine learning detects unusual combinations of project attributes."
            />
          </div>
        </div>

        {/* ===================================================
            RISK LEVEL GUIDE
            =================================================== */}

        <div className="panel">
          <p className="eyebrow">
            RISK CLASSIFICATION
          </p>

          <h3>
            What Each Alert Means
          </h3>

          <div className="risk-guide">
            <RiskGuide
              type="critical"
              title="Critical"
              text="Highest priority. Immediate human verification recommended."
            />

            <RiskGuide
              type="high"
              title="High"
              text="Significant risk indicators detected. Review recommended."
            />

            <RiskGuide
              type="medium"
              title="Medium"
              text="Some unusual indicators detected. Monitor closely."
            />

            <RiskGuide
              type="low"
              title="Low"
              text="No major risk indicators currently identified."
            />
          </div>
        </div>
      </section>

      {/* =====================================================
          DECISION SUPPORT NOTICE
          ===================================================== */}

      <div className="dashboard-disclaimer">
        <span>
          ⚠️
        </span>

        <p>
          <strong>
            Important:
          </strong>{" "}
          An AI alert does not prove fraud,
          corruption or wrongdoing. Alerts are
          decision-support signals intended to
          help authorized officials prioritize
          projects for human verification.
        </p>
      </div>

      {/* =====================================================
          PROJECT DETAIL MODAL
          ===================================================== */}

      {selectedWork && (
        <AlertDetailModal
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
   ALERT STAT CARD
   ========================================================= */

function AlertStatCard({
  icon,
  label,
  value,
  description,
  type,
}) {
  return (
    <div
      className={`card alert-stat-card ${type}`}
    >
      <div className="alert-stat-top">
        <div className="alert-stat-icon">
          {icon}
        </div>

        <span>
          {label}
        </span>
      </div>

      <strong className="alert-stat-value">
        {value}
      </strong>

      <small>
        {description}
      </small>
    </div>
  );
}

/* =========================================================
   ALERT ROW
   ========================================================= */

function AlertRow({
  work,
  onClick,
}) {
  const risk =
    String(
      work.Risk_Level || "MEDIUM"
    ).toLowerCase();

  const riskScore =
    Number(
      work.Risk_Score || 0
    );

  const progress =
    Number(
      work.Progress_Percentage || 0
    );

  const delay =
    Number(
      work.Delay_Days || 0
    );

  const reasons = String(
    work.Risk_Reasons || ""
  )
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <div
      className={`alert-row ${risk}`}
      onClick={onClick}
    >
      {/* LEFT */}

      <div className="alert-main">
        <div className="alert-severity-icon">
          {risk === "critical"
            ? "🚨"
            : risk === "high"
            ? "⚠️"
            : "◈"}
        </div>

        <div className="alert-project-info">
          <div className="alert-project-title">
            <strong>
              {work.Work_ID || "Unknown Project"}
            </strong>

            <span
              className={`badge ${risk}`}
            >
              {risk.toUpperCase()}
            </span>
          </div>

          <p>
            {work.Work_Type ||
              "Project"}{" "}
            •{" "}
            {work.State ||
              "Unknown State"}{" "}
            •{" "}
            {work.District ||
              "Unknown District"}
          </p>

          <div className="alert-reason-preview">
            {reasons.length > 0
              ? reasons
                  .slice(0, 2)
                  .map(
                    (
                      reason,
                      index
                    ) => (
                      <span
                        key={index}
                      >
                        • {reason}
                      </span>
                    )
                  )
              : (
                <span>
                  • AI risk indicators detected
                </span>
              )}
          </div>
        </div>
      </div>

      {/* MIDDLE */}

      <div className="alert-metrics">
        <div>
          <span>
            PROGRESS
          </span>

          <strong>
            {progress}%
          </strong>
        </div>

        <div>
          <span>
            DELAY
          </span>

          <strong
            className={
              delay > 30
                ? "delay-danger"
                : ""
            }
          >
            {delay} days
          </strong>
        </div>
      </div>

      {/* RIGHT */}

      <div className="alert-score">
        <span>
          RISK SCORE
        </span>

        <strong>
          {riskScore.toFixed(0)}
        </strong>

        <small>
          / 100
        </small>
      </div>

      <div className="alert-arrow">
        →
      </div>
    </div>
  );
}

/* =========================================================
   SIGNAL ITEM
   ========================================================= */

function SignalItem({
  icon,
  title,
  text,
}) {
  return (
    <div className="alert-signal-item">
      <div className="signal-icon">
        {icon}
      </div>

      <div>
        <strong>
          {title}
        </strong>

        <p>
          {text}
        </p>
      </div>
    </div>
  );
}

/* =========================================================
   RISK GUIDE
   ========================================================= */

function RiskGuide({
  type,
  title,
  text,
}) {
  return (
    <div className="risk-guide-item">
      <span
        className={`risk-dot ${type}`}
      />

      <div>
        <strong>
          {title}
        </strong>

        <p>
          {text}
        </p>
      </div>
    </div>
  );
}

/* =========================================================
   DETAIL MODAL
   ========================================================= */

function AlertDetailModal({
  work,
  onClose,
}) {
  const risk =
    String(
      work.Risk_Level || "MEDIUM"
    ).toLowerCase();

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
        className="modal alert-detail-modal"
        onClick={(e) =>
          e.stopPropagation()
        }
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">
              AI ALERT DETAILS
            </p>

            <h2>
              {work.Work_ID}
            </h2>

            <p>
              Project risk assessment
            </p>
          </div>

          <button
            className="close-button"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* RISK HEADER */}

        <div className="alert-detail-risk">
          <div>
            <span>
              RISK LEVEL
            </span>

            <strong>
              <span
                className={`badge ${risk}`}
              >
                {risk.toUpperCase()}
              </span>
            </strong>
          </div>

          <div>
            <span>
              AI RISK SCORE
            </span>

            <strong>
              {Number(
                work.Risk_Score || 0
              ).toFixed(0)}
              <small>
                /100
              </small>
            </strong>
          </div>

          <div>
            <span>
              ANOMALY STATUS
            </span>

            <strong>
              {work.Anomaly_Status ||
                "Normal"}
            </strong>
          </div>
        </div>

        {/* PROJECT DETAILS */}

        <div className="details-grid">
          <div>
            <label>
              State
            </label>

            <p>
              {work.State || "—"}
            </p>
          </div>

          <div>
            <label>
              District
            </label>

            <p>
              {work.District || "—"}
            </p>
          </div>

          <div>
            <label>
              Work Type
            </label>

            <p>
              {work.Work_Type || "—"}
            </p>
          </div>

          <div>
            <label>
              Implementing Agency
            </label>

            <p>
              {work.Implementing_Agency ||
                "—"}
            </p>
          </div>

          <div>
            <label>
              Sanction Amount
            </label>

            <p>
              ₹
              {Number(
                work.Sanction_Amount || 0
              ).toLocaleString(
                "en-IN"
              )}
            </p>
          </div>

          <div>
            <label>
              Estimated Cost
            </label>

            <p>
              ₹
              {Number(
                work.Estimated_Cost || 0
              ).toLocaleString(
                "en-IN"
              )}
            </p>
          </div>

          <div>
            <label>
              Expenditure
            </label>

            <p>
              ₹
              {Number(
                work.Expenditure || 0
              ).toLocaleString(
                "en-IN"
              )}
            </p>
          </div>

          <div>
            <label>
              Progress
            </label>

            <p>
              {work.Progress_Percentage ||
                0}
              %
            </p>
          </div>

          <div>
            <label>
              Delay
            </label>

            <p>
              {work.Delay_Days || 0} days
            </p>
          </div>

          <div>
            <label>
              Status
            </label>

            <p>
              {work.Status || "—"}
            </p>
          </div>
        </div>

        {/* AI REASONS */}

        <div className="ai-reasons">
          <h3>
            🤖 Why was this project flagged?
          </h3>

          {reasons.length > 0 ? (
            <ul>
              {reasons.map(
                (reason, index) => (
                  <li key={index}>
                    {reason}
                  </li>
                )
              )}
            </ul>
          ) : (
            <p>
              The AI engine detected an unusual
              combination of project attributes.
            </p>
          )}

          <div className="verification-note">
            <strong>
              ⚠️ Human Verification Required
            </strong>

            <span>
              This alert is a decision-support
              signal. Officials should verify the
              underlying project records before
              taking action.
            </span>
          </div>
        </div>

        <button
          className="modal-action-button"
          onClick={onClose}
        >
          Close Alert
        </button>
      </div>
    </div>
  );
}

export default RiskAlerts;