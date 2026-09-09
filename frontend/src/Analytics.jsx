import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import "./App.css";

const RISK_COLORS = {
  LOW: "#16a34a",
  MEDIUM: "#eab308",
  HIGH: "#f97316",
  CRITICAL: "#dc2626",
};

const RISK_ORDER = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
];

function Analytics({ dashboard = {}, works = [] }) {
  // =====================================================
  // NORMALIZE DATA
  // =====================================================

  const projectData = useMemo(() => {
    if (Array.isArray(works)) {
      return works;
    }

    if (Array.isArray(works?.data)) {
      return works.data;
    }

    return [];
  }, [works]);

  // =====================================================
  // RISK COUNTS
  // =====================================================

  const riskCounts = useMemo(() => {
    const counts = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };

    projectData.forEach((work) => {
      const risk = String(
        work?.Risk_Level || ""
      ).toUpperCase();

      if (counts[risk] !== undefined) {
        counts[risk] += 1;
      }
    });

    return counts;
  }, [projectData]);

  // =====================================================
  // TOTAL PROJECTS
  // =====================================================

  const totalProjects =
    projectData.length ||
    Number(dashboard?.totalWorks) ||
    0;

  // =====================================================
  // ANOMALIES
  // =====================================================

  const anomalyCount = useMemo(() => {
    const calculated = projectData.filter(
      (work) =>
        String(
          work?.Anomaly_Status || ""
        ).toLowerCase() === "anomaly"
    ).length;

    return calculated || Number(dashboard?.anomalies) || 0;
  }, [projectData, dashboard]);

  // =====================================================
  // HIGH + CRITICAL
  // =====================================================

  const highRiskCount =
    riskCounts.HIGH ||
    Number(dashboard?.highRisk) ||
    0;

  const criticalRiskCount =
    riskCounts.CRITICAL ||
    Number(dashboard?.criticalRisk) ||
    0;

  const priorityRiskCount =
    highRiskCount + criticalRiskCount;

  // =====================================================
  // RISK DISTRIBUTION DATA
  // =====================================================

  const riskDistribution = useMemo(() => {
    return RISK_ORDER.map((risk) => ({
      risk,
      count: riskCounts[risk],
    }));
  }, [riskCounts]);

  // =====================================================
  // RISK PERCENTAGE DATA
  // =====================================================

  const riskPercentage = useMemo(() => {
    return RISK_ORDER.map((risk) => ({
      name: risk,
      value:
        totalProjects > 0
          ? Number(
              (
                (riskCounts[risk] /
                  totalProjects) *
                100
              ).toFixed(1)
            )
          : 0,
    }));
  }, [riskCounts, totalProjects]);

  // =====================================================
  // STATE-WISE RISK ANALYSIS
  // =====================================================

  const stateRiskData = useMemo(() => {
    const stateMap = {};

    projectData.forEach((work) => {
      const state =
        work?.State || "Unknown";

      const risk = String(
        work?.Risk_Level || ""
      ).toUpperCase();

      if (!stateMap[state]) {
        stateMap[state] = {
          state,
          LOW: 0,
          MEDIUM: 0,
          HIGH: 0,
          CRITICAL: 0,
          total: 0,
        };
      }

      if (RISK_ORDER.includes(risk)) {
        stateMap[state][risk] += 1;
      }

      stateMap[state].total += 1;
    });

    return Object.values(stateMap)
      .sort((a, b) => b.total - a.total);
  }, [projectData]);

  // =====================================================
  // WORK TYPE RISK ANALYSIS
  // =====================================================

  const workTypeRiskData = useMemo(() => {
    const typeMap = {};

    projectData.forEach((work) => {
      const type =
        work?.Work_Type || "Unknown";

      const risk = String(
        work?.Risk_Level || ""
      ).toUpperCase();

      if (!typeMap[type]) {
        typeMap[type] = {
          type,
          LOW: 0,
          MEDIUM: 0,
          HIGH: 0,
          CRITICAL: 0,
          total: 0,
        };
      }

      if (RISK_ORDER.includes(risk)) {
        typeMap[type][risk] += 1;
      }

      typeMap[type].total += 1;
    });

    return Object.values(typeMap)
      .sort((a, b) => b.total - a.total);
  }, [projectData]);

  // =====================================================
  // TOP RISK STATE
  // =====================================================

  const highestRiskState = useMemo(() => {
    if (!stateRiskData.length) {
      return null;
    }

    return [...stateRiskData].sort(
      (a, b) =>
        b.CRITICAL +
        b.HIGH -
        (a.CRITICAL + a.HIGH)
    )[0];
  }, [stateRiskData]);

  // =====================================================
  // TOP RISK WORK TYPE
  // =====================================================

  const highestRiskWorkType = useMemo(() => {
    if (!workTypeRiskData.length) {
      return null;
    }

    return [...workTypeRiskData].sort(
      (a, b) =>
        b.CRITICAL +
        b.HIGH -
        (a.CRITICAL + a.HIGH)
    )[0];
  }, [workTypeRiskData]);

  // =====================================================
  // CUSTOM TOOLTIP
  // =====================================================

  const RiskTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) {
      return null;
    }

    return (
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          padding: "12px 14px",
          boxShadow:
            "0 8px 25px rgba(15, 23, 42, 0.12)",
        }}
      >
        {payload.map((item) => (
          <div
            key={item.dataKey}
            style={{
              marginBottom: "5px",
              fontSize: "13px",
            }}
          >
            <strong>
              {item.name || item.dataKey}:
            </strong>{" "}
            {item.value}
          </div>
        ))}
      </div>
    );
  };

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="analytics-page">

      {/* =================================================
          HEADER
      ================================================= */}

      <div
        style={{
          marginBottom: "24px",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "28px",
            fontWeight: 700,
            color: "#0f172a",
          }}
        >
          📈 Analytics
        </h1>

        <p
          style={{
            marginTop: "6px",
            color: "#64748b",
            fontSize: "14px",
          }}
        >
          AI-powered analysis of MPLADS
          project risks
        </p>
      </div>

      {/* =================================================
          SUMMARY CARDS
      ================================================= */}

      <div className="analytics-summary-grid">

        <div className="analytics-card">
          <span>📁 Total Projects</span>

          <strong>
            {totalProjects}
          </strong>

          <small>
            Projects analyzed
          </small>
        </div>

        <div className="analytics-card">
          <span>🤖 AI Anomalies</span>

          <strong>
            {anomalyCount}
          </strong>

          <small>
            Unusual patterns detected
          </small>
        </div>

        <div className="analytics-card high">
          <span>🚨 High Risk</span>

          <strong>
            {highRiskCount}
          </strong>

          <small>
            Requires verification
          </small>
        </div>

        <div className="analytics-card critical">
          <span>🔴 Critical Risk</span>

          <strong>
            {criticalRiskCount}
          </strong>

          <small>
            Immediate attention
          </small>
        </div>

      </div>

      {/* =================================================
          CHART ROW
      ================================================= */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(0, 1.6fr) minmax(0, 1fr)",
          gap: "20px",
          marginTop: "20px",
        }}
      >

        {/* RISK DISTRIBUTION */}

        <div className="analytics-panel">

          <div className="analytics-panel-header">

            <div>
              <h2>
                Risk Distribution
              </h2>

              <p>
                Number of MPLADS projects
                by AI-assigned risk level
              </p>
            </div>

          </div>

          <div
            style={{
              width: "100%",
              height: "320px",
            }}
          >

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <BarChart
                data={riskDistribution}
                margin={{
                  top: 20,
                  right: 20,
                  left: 0,
                  bottom: 10,
                }}
              >

                <CartesianGrid
                  strokeDasharray="3 3"
                />

                <XAxis
                  dataKey="risk"
                  tick={{
                    fontSize: 12,
                  }}
                />

                <YAxis
                  allowDecimals={false}
                  tick={{
                    fontSize: 12,
                  }}
                />

                <Tooltip
                  content={<RiskTooltip />}
                />

                <Bar
                  dataKey="count"
                  name="Projects"
                  radius={[
                    6,
                    6,
                    0,
                    0,
                  ]}
                >

                  {riskDistribution.map(
                    (entry) => (
                      <Cell
                        key={entry.risk}
                        fill={
                          RISK_COLORS[
                            entry.risk
                          ]
                        }
                      />
                    )
                  )}

                </Bar>

              </BarChart>

            </ResponsiveContainer>

          </div>

        </div>

        {/* RISK PERCENTAGE */}

        <div className="analytics-panel">

          <div className="analytics-panel-header">

            <div>
              <h2>
                Risk Percentage
              </h2>

              <p>
                Share of total projects
              </p>
            </div>

          </div>

          <div
            style={{
              width: "100%",
              height: "320px",
              position: "relative",
            }}
          >

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <PieChart>

                <Pie
                  data={riskPercentage}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={105}
                  paddingAngle={3}
                >

                  {riskPercentage.map(
                    (entry) => (
                      <Cell
                        key={entry.name}
                        fill={
                          RISK_COLORS[
                            entry.name
                          ]
                        }
                      />
                    )
                  )}

                </Pie>

                <Tooltip
                  formatter={(value) =>
                    `${value}%`
                  }
                />

                <Legend />

              </PieChart>

            </ResponsiveContainer>

            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform:
                  "translate(-50%, -50%)",
                textAlign: "center",
                pointerEvents: "none",
              }}
            >

              <strong
                style={{
                  display: "block",
                  fontSize: "24px",
                  color: "#0f172a",
                }}
              >
                {totalProjects}
              </strong>

              <span
                style={{
                  fontSize: "11px",
                  color: "#64748b",
                }}
              >
                Projects
              </span>

            </div>

          </div>

        </div>

      </div>

      {/* =================================================
          STATE-WISE ANALYSIS
      ================================================= */}

      <div
        className="analytics-panel"
        style={{
          marginTop: "20px",
        }}
      >

        <div className="analytics-panel-header">

          <div>
            <h2>
              🇮🇳 State-wise Risk Analysis
            </h2>

            <p>
              Risk distribution across project
              locations
            </p>
          </div>

          {highestRiskState && (
            <div
              style={{
                background: "#fff7ed",
                border: "1px solid #fed7aa",
                borderRadius: "10px",
                padding:
                  "8px 12px",
                fontSize: "12px",
                color: "#9a3412",
              }}
            >
              Highest priority:{" "}
              <strong>
                {highestRiskState.state}
              </strong>
            </div>
          )}

        </div>

        {stateRiskData.length === 0 ? (

          <div className="analytics-empty">
            No state-wise project data
            available.
          </div>

        ) : (

          <div
            style={{
              width: "100%",
              height: "390px",
            }}
          >

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <BarChart
                data={stateRiskData}
                layout="vertical"
                margin={{
                  top: 10,
                  right: 30,
                  left: 20,
                  bottom: 10,
                }}
              >

                <CartesianGrid
                  strokeDasharray="3 3"
                />

                <XAxis
                  type="number"
                  allowDecimals={false}
                />

                <YAxis
                  type="category"
                  dataKey="state"
                  width={110}
                  tick={{
                    fontSize: 12,
                  }}
                />

                <Tooltip
                  content={<RiskTooltip />}
                />

                <Legend />

                <Bar
                  dataKey="LOW"
                  name="Low"
                  stackId="risk"
                  fill={RISK_COLORS.LOW}
                />

                <Bar
                  dataKey="MEDIUM"
                  name="Medium"
                  stackId="risk"
                  fill={RISK_COLORS.MEDIUM}
                />

                <Bar
                  dataKey="HIGH"
                  name="High"
                  stackId="risk"
                  fill={RISK_COLORS.HIGH}
                />

                <Bar
                  dataKey="CRITICAL"
                  name="Critical"
                  stackId="risk"
                  fill={RISK_COLORS.CRITICAL}
                  radius={[
                    0,
                    5,
                    5,
                    0,
                  ]}
                />

              </BarChart>

            </ResponsiveContainer>

          </div>

        )}

      </div>

      {/* =================================================
          WORK TYPE ANALYSIS
      ================================================= */}

      <div
        className="analytics-panel"
        style={{
          marginTop: "20px",
        }}
      >

        <div className="analytics-panel-header">

          <div>
            <h2>
              🏗️ Work-type Risk Analysis
            </h2>

            <p>
              AI risk distribution by MPLADS
              project category
            </p>
          </div>

          {highestRiskWorkType && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "10px",
                padding:
                  "8px 12px",
                fontSize: "12px",
                color: "#991b1b",
              }}
            >
              Highest priority:{" "}
              <strong>
                {highestRiskWorkType.type}
              </strong>
            </div>
          )}

        </div>

        {workTypeRiskData.length === 0 ? (

          <div className="analytics-empty">
            No work-type data available.
          </div>

        ) : (

          <div
            style={{
              width: "100%",
              height: "390px",
            }}
          >

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <BarChart
                data={workTypeRiskData}
                margin={{
                  top: 10,
                  right: 30,
                  left: 10,
                  bottom: 40,
                }}
              >

                <CartesianGrid
                  strokeDasharray="3 3"
                />

                <XAxis
                  dataKey="type"
                  angle={-15}
                  textAnchor="end"
                  interval={0}
                  height={70}
                  tick={{
                    fontSize: 11,
                  }}
                />

                <YAxis
                  allowDecimals={false}
                />

                <Tooltip
                  content={<RiskTooltip />}
                />

                <Legend />

                <Bar
                  dataKey="LOW"
                  name="Low"
                  stackId="risk"
                  fill={RISK_COLORS.LOW}
                />

                <Bar
                  dataKey="MEDIUM"
                  name="Medium"
                  stackId="risk"
                  fill={RISK_COLORS.MEDIUM}
                />

                <Bar
                  dataKey="HIGH"
                  name="High"
                  stackId="risk"
                  fill={RISK_COLORS.HIGH}
                />

                <Bar
                  dataKey="CRITICAL"
                  name="Critical"
                  stackId="risk"
                  fill={RISK_COLORS.CRITICAL}
                  radius={[
                    5,
                    5,
                    0,
                    0,
                  ]}
                />

              </BarChart>

            </ResponsiveContainer>

          </div>

        )}

      </div>

      {/* =================================================
          AI INSIGHTS
      ================================================= */}

      <div
        className="analytics-panel"
        style={{
          marginTop: "20px",
          marginBottom: "30px",
        }}
      >

        <div className="analytics-panel-header">

          <div>
            <h2>
              🤖 AI Insights
            </h2>

            <p>
              Automatically generated risk
              intelligence from the current
              project dataset
            </p>
          </div>

        </div>

        <div className="ai-insights-grid">

          <div className="ai-insight critical">

            <strong>
              🚨 High-risk projects
            </strong>

            <p>
              {highRiskCount} projects
              require verification based
              on detected risk indicators.
            </p>

          </div>

          <div className="ai-insight danger">

            <strong>
              ⚠️ Critical projects
            </strong>

            <p>
              {criticalRiskCount} projects
              require immediate attention
              from authorities.
            </p>

          </div>

          <div className="ai-insight info">

            <strong>
              🔍 Anomaly detection
            </strong>

            <p>
              The AI model identifies
              unusual patterns in project
              cost, expenditure, progress
              and delays.
            </p>

          </div>

          <div className="ai-insight success">

            <strong>
              📊 Priority monitoring
            </strong>

            <p>
              {priorityRiskCount} projects
              are currently classified as
              High or Critical priority.
            </p>

          </div>

        </div>

        <div
          style={{
            marginTop: "18px",
            padding: "14px 16px",
            borderRadius: "10px",
            background: "#f8fafc",
            border:
              "1px solid #e2e8f0",
            color: "#475569",
            fontSize: "13px",
            lineHeight: 1.6,
          }}
        >
          <strong
            style={{
              color: "#0f172a",
            }}
          >
            Important:
          </strong>{" "}
          AI predictions are risk indicators
          for verification and do not
          automatically establish fraud.
          Final decisions should be made
          through human review and official
          verification.
        </div>

      </div>

    </div>
  );
}

export default Analytics;