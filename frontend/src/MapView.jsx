import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import India from "@svg-maps/india";
import "./MapView.css";

const API_URL =
  "https://mplads-risk-intelligence.onrender.com/api/works";

const RISK_COLORS = {
  LOW: "#16a34a",
  MEDIUM: "#eab308",
  HIGH: "#f97316",
  CRITICAL: "#dc2626",
};

const RISK_LIGHT = {
  LOW: "#dcfce7",
  MEDIUM: "#fef9c3",
  HIGH: "#ffedd5",
  CRITICAL: "#fee2e2",
};

const RISK_ORDER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const BASE_VIEWBOX = India.viewBox || "0 0 1000 1000";

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function getField(work, names) {
  for (const name of names) {
    if (
      work &&
      work[name] !== undefined &&
      work[name] !== null &&
      work[name] !== ""
    ) {
      return work[name];
    }
  }

  return "";
}

function getState(work) {
  return (
    getField(work, [
      "STATE",
      "State",
      "state",
      "STATE_NAME",
      "State Name",
    ]) || "UNKNOWN"
  );
}

function getRisk(work) {
  const value = normalizeText(
    getField(work, [
      "RISK_LEVEL",
      "Risk_Level",
      "risk_level",
      "RISK",
      "risk",
    ])
  );

  return RISK_COLORS[value] ? value : "LOW";
}

function getRiskScore(work) {
  const value = Number(
    getField(work, [
      "RISK_SCORE",
      "Risk_Score",
      "risk_score",
      "RiskScore",
    ])
  );

  return Number.isFinite(value) ? value : 0;
}

function getAmount(work) {
  const value = Number(
    getField(work, [
      "ALLOCATION_AMOUNT",
      "Allocation_Amount",
      "allocation_amount",
      "Allocated_Amount",
      "allocated_amount",
      "ALLOCATION AMOUNT",
    ])
  );

  return Number.isFinite(value) ? value : 0;
}

function getReasonValues(work) {
  const possibleFields = [
    "RISK_REASONS",
    "Risk_Reasons",
    "risk_reasons",
    "RISK_REASON",
    "Risk_Reason",
    "risk_reason",
    "ANOMALY_REASONS",
    "anomaly_reasons",
    "REASONS",
    "reasons",
  ];

  const value = getField(work, possibleFields);

  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .flatMap((item) => String(item).split(/[|;,]/))
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return String(value)
    .split(/[|;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

function formatAmount(value) {
  const amount = Number(value || 0);

  if (!Number.isFinite(amount) || amount === 0) {
    return "₹0";
  }

  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`;
  }

  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)} L`;
  }

  return `₹${amount.toLocaleString("en-IN")}`;
}

function cleanStateName(name) {
  return normalizeText(name)
    .replace(/&/g, "AND")
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
}

/*
  Dataset state names and SVG-map state names are not always identical.

  This mapping handles common differences such as:
  Jammu & Kashmir -> Jammu and Kashmir
  NCT of Delhi -> Delhi
  Odisha -> Odisha
  Puducherry -> Puducherry
*/
function getStateAliases(name) {
  const normalized = cleanStateName(name);

  const aliases = {
    "ANDHRA PRADESH": ["ANDHRA PRADESH"],
    "ARUNACHAL PRADESH": ["ARUNACHAL PRADESH"],
    ASSAM: ["ASSAM"],
    BIHAR: ["BIHAR"],
    CHHATTISGARH: ["CHHATTISGARH"],
    GOA: ["GOA"],
    GUJARAT: ["GUJARAT"],
    HARYANA: ["HARYANA"],
    "HIMACHAL PRADESH": ["HIMACHAL PRADESH"],
    JHARKHAND: ["JHARKHAND"],
    KARNATAKA: ["KARNATAKA"],
    KERALA: ["KERALA"],
    "MADHYA PRADESH": ["MADHYA PRADESH"],
    MAHARASHTRA: ["MAHARASHTRA"],
    MANIPUR: ["MANIPUR"],
    MEGHALAYA: ["MEGHALAYA"],
    MIZORAM: ["MIZORAM"],
    NAGALAND: ["NAGALAND"],
    ODISHA: ["ODISHA", "ORISSA"],
    PUNJAB: ["PUNJAB"],
    RAJASTHAN: ["RAJASTHAN"],
    SIKKIM: ["SIKKIM"],
    "TAMIL NADU": ["TAMIL NADU"],
    TELANGANA: ["TELANGANA"],
    TRIPURA: ["TRIPURA"],
    "UTTAR PRADESH": ["UTTAR PRADESH"],
    UTTARAKHAND: ["UTTARAKHAND"],
    "WEST BENGAL": ["WEST BENGAL"],
    DELHI: ["DELHI", "NCT OF DELHI", "NATIONAL CAPITAL TERRITORY OF DELHI"],
    "JAMMU AND KASHMIR": [
      "JAMMU AND KASHMIR",
      "JAMMU & KASHMIR",
      "JAMMU KASHMIR",
    ],
    LADAKH: ["LADAKH"],
    PUDUCHERRY: ["PUDUCHERRY", "PONDICHERRY"],
    CHANDIGARH: ["CHANDIGARH"],
    "ANDAMAN AND NICOBAR ISLANDS": [
      "ANDAMAN AND NICOBAR ISLANDS",
      "ANDAMAN & NICOBAR ISLANDS",
    ],
    LAKSHADWEEP: ["LAKSHADWEEP"],
    "DADRA AND NAGAR HAVELI": [
      "DADRA AND NAGAR HAVELI",
      "DADRA & NAGAR HAVELI",
    ],
    "DAMAN AND DIU": [
      "DAMAN AND DIU",
      "DAMAN & DIU",
    ],
    "DADRA AND NAGAR HAVELI AND DAMAN AND DIU": [
      "DADRA AND NAGAR HAVELI AND DAMAN AND DIU",
      "DADRA & NAGAR HAVELI AND DAMAN & DIU",
    ],
  };

  return aliases[normalized] || [normalized];
}

function createEmptyStateStats(name) {
  return {
    state: name,
    total: 0,
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0,
    totalRiskScore: 0,
    totalAllocation: 0,
    reasons: {},
  };
}

function aggregateByState(works) {
  const map = new Map();

  works.forEach((work) => {
    const rawState = getState(work);
    const state = cleanStateName(rawState);

    if (!state || state === "UNKNOWN") return;

    if (!map.has(state)) {
      map.set(state, createEmptyStateStats(state));
    }

    const item = map.get(state);
    const risk = getRisk(work);

    item.total += 1;
    item[risk] += 1;
    item.totalRiskScore += getRiskScore(work);
    item.totalAllocation += getAmount(work);

    const reasons = getReasonValues(work);

    reasons.forEach((reason) => {
      const normalizedReason = String(reason).trim();

      if (!normalizedReason) return;

      item.reasons[normalizedReason] =
        (item.reasons[normalizedReason] || 0) + 1;
    });
  });

  map.forEach((item) => {
    item.averageRisk =
      item.total > 0
        ? item.totalRiskScore / item.total
        : 0;

    item.highCritical =
      item.HIGH + item.CRITICAL;

    item.criticalPercentage =
      item.total > 0
        ? (item.CRITICAL / item.total) * 100
        : 0;

    item.highCriticalPercentage =
      item.total > 0
        ? (item.highCritical / item.total) * 100
        : 0;
  });

  return map;
}

function getLocationStateName(location) {
  return cleanStateName(location.name || location.id || "");
}

function resolveStatsForLocation(location, statsMap) {
  const locationName = getLocationStateName(location);

  if (statsMap.has(locationName)) {
    return statsMap.get(locationName);
  }

  for (const [datasetState, stats] of statsMap.entries()) {
    const aliases = getStateAliases(datasetState);

    if (aliases.includes(locationName)) {
      return stats;
    }

    if (
      aliases.some(
        (alias) =>
          cleanStateName(alias) === locationName
      )
    ) {
      return stats;
    }
  }

  return createEmptyStateStats(location.name);
}

function getFilteredStats(stats, filter) {
  if (!stats) return null;

  if (filter === "ALL") {
    return stats;
  }

  const filteredTotal = stats[filter];

  if (!filteredTotal) {
    return {
      ...stats,
      total: 0,
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
      totalAllocation: 0,
      averageRisk: 0,
    };
  }

  return {
    ...stats,
    total: filteredTotal,
    LOW: filter === "LOW" ? stats.LOW : 0,
    MEDIUM: filter === "MEDIUM" ? stats.MEDIUM : 0,
    HIGH: filter === "HIGH" ? stats.HIGH : 0,
    CRITICAL: filter === "CRITICAL" ? stats.CRITICAL : 0,
  };
}

function getMapIntensity(stats, filter) {
  if (!stats || stats.total === 0) {
    return 0;
  }

  if (filter === "CRITICAL") {
    return stats.criticalPercentage;
  }

  if (filter === "HIGH") {
    return stats.total > 0
      ? (stats.HIGH / stats.total) * 100
      : 0;
  }

  if (filter === "MEDIUM") {
    return stats.total > 0
      ? (stats.MEDIUM / stats.total) * 100
      : 0;
  }

  if (filter === "LOW") {
    return stats.total > 0
      ? (stats.LOW / stats.total) * 100
      : 0;
  }

  return stats.highCriticalPercentage;
}

function getStateFill(stats, filter) {
  if (!stats || stats.total === 0) {
    return "#e8edf4";
  }

  if (filter !== "ALL") {
    const count = stats[filter] || 0;

    if (count === 0) {
      return "#e8edf4";
    }

    return RISK_COLORS[filter];
  }

  /*
    ALL mode:
    Determine dominant risk level.
  */
  const levels = RISK_ORDER.map((level) => ({
    level,
    count: stats[level],
  })).sort((a, b) => b.count - a.count);

  const dominant = levels[0].level;

  return RISK_COLORS[dominant];
}

function getStateOpacity(stats, filter) {
  if (!stats || stats.total === 0) {
    return 0.45;
  }

  if (filter === "ALL") {
    return 0.75;
  }

  const percentage =
    getMapIntensity(stats, filter);

  /*
    Gives visual concentration without
    making every state neon-bright.
  */
  return Math.min(
    0.95,
    Math.max(
      0.28,
      0.28 + percentage / 100
    )
  );
}

function MetricCard({
  icon,
  label,
  value,
  subtitle,
  tone,
}) {
  return (
    <div className={`metric-card ${tone}`}>
      <div className="metric-icon">
        {icon}
      </div>

      <div className="metric-content">
        <div className="metric-label">
          {label}
        </div>

        <div className="metric-value">
          {formatNumber(value)}
        </div>

        <div className="metric-subtitle">
          {subtitle}
        </div>
      </div>
    </div>
  );
}

function RiskFilter({
  active,
  value,
  label,
  onClick,
}) {
  return (
    <button
      type="button"
      className={`risk-filter-button ${
        active ? "active" : ""
      } ${value.toLowerCase()}`}
      onClick={() => onClick(value)}
    >
      {label}
    </button>
  );
}

function MapView() {
  const [works, setWorks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const [selectedState, setSelectedState] =
    useState(null);

  const [hoveredState, setHoveredState] =
    useState(null);

  const [viewBox, setViewBox] =
    useState(BASE_VIEWBOX);

  const [zoom, setZoom] = useState(1);

  const pathRefs = useRef({});

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await axios.get(
        API_URL,
        {
          timeout: 30000,
        }
      );

      let data = [];

      if (Array.isArray(response.data)) {
        data = response.data;
      } else if (
        Array.isArray(response.data?.data)
      ) {
        data = response.data.data;
      } else if (
        Array.isArray(response.data?.works)
      ) {
        data = response.data.works;
      } else if (
        Array.isArray(response.data?.projects)
      ) {
        data = response.data.projects;
      }

      console.log(
        "MPLADS Map records:",
        data.length
      );

      if (data.length > 0) {
        console.log(
          "First MPLADS record:",
          data[0]
        );
      }

      setWorks(data);

      if (data.length === 0) {
        setError(
          "Backend returned no MPLADS work records."
        );
      }
    } catch (err) {
      console.error(
        "MPLADS Map API error:",
        err
      );

      setError(
        "Unable to load MPLADS data. Make sure the backend is running on port 5000."
      );

      setWorks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const stateStats = useMemo(
    () => aggregateByState(works),
    [works]
  );

  const totals = useMemo(() => {
    const result = {
      total: works.length,
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
      allocation: 0,
    };

    works.forEach((work) => {
      const risk = getRisk(work);

      result[risk] += 1;
      result.allocation += getAmount(work);
    });

    return result;
  }, [works]);

  const statesCovered = useMemo(() => {
    return Array.from(stateStats.values()).filter(
      (state) => state.total > 0
    ).length;
  }, [stateStats]);

  const filteredLocations = useMemo(() => {
    const query = cleanStateName(search);

    return India.locations.filter((location) => {
      const stats =
        resolveStatsForLocation(
          location,
          stateStats
        );

      if (!stats || stats.total === 0) {
        return true;
      }

      const name = cleanStateName(
        location.name
      );

      const matchesSearch =
        !query ||
        name.includes(query);

      if (!matchesSearch) {
        return false;
      }

      if (filter === "ALL") {
        return true;
      }

      return stats[filter] > 0;
    });
  }, [
    stateStats,
    filter,
    search,
  ]);

  const visibleStateStats = useMemo(() => {
    return Array.from(
      stateStats.values()
    )
      .filter((state) => state.total > 0)
      .filter((state) => {
        if (filter === "ALL") return true;
        return state[filter] > 0;
      })
      .sort(
        (a, b) =>
          b.highCritical - a.highCritical
      );
  }, [stateStats, filter]);

  const topPriorityStates =
    visibleStateStats.slice(0, 5);

  const resetMap = () => {
    setFilter("ALL");
    setSearch("");
    setSelectedState(null);
    setHoveredState(null);
    setViewBox(BASE_VIEWBOX);
    setZoom(1);
  };

  const zoomIn = () => {
    setZoom((current) =>
      Math.min(current + 0.25, 2)
    );
  };

  const zoomOut = () => {
    setZoom((current) =>
      Math.max(current - 0.25, 0.75)
    );
  };

  const focusLocation = (
    location,
    stats
  ) => {
    setSelectedState(stats);

    const path =
      pathRefs.current[location.id];

    if (!path) return;

    try {
      const bbox =
        path.getBBox();

      const paddingX =
        bbox.width * 0.35;

      const paddingY =
        bbox.height * 0.35;

      const x =
        bbox.x - paddingX;

      const y =
        bbox.y - paddingY;

      const width =
        bbox.width +
        paddingX * 2;

      const height =
        bbox.height +
        paddingY * 2;

      setViewBox(
        `${x} ${y} ${width} ${height}`
      );

      setZoom(1);
    } catch (err) {
      console.warn(
        "Could not focus state:",
        err
      );
    }
  };

  const handleStateClick = (
    location
  ) => {
    const stats =
      resolveStatsForLocation(
        location,
        stateStats
      );

    if (!stats || stats.total === 0) {
      return;
    }

    focusLocation(
      location,
      stats
    );
  };

  const selectedReasons = useMemo(() => {
    if (!selectedState) return [];

    return Object.entries(
      selectedState.reasons || {}
    )
      .sort(
        (a, b) => b[1] - a[1]
      )
      .slice(0, 5);
  }, [selectedState]);

  const mapLocations = useMemo(() => {
    const locations = India.locations || [];

    return locations.filter((location) => {
      const stats =
        resolveStatsForLocation(
          location,
          stateStats
        );

      const name =
        cleanStateName(
          location.name
        );

      const query =
        cleanStateName(search);

      const matchesSearch =
        !query ||
        name.includes(query);

      if (!matchesSearch) {
        return false;
      }

      if (
        filter !== "ALL" &&
        stats[filter] === 0
      ) {
        /*
          Keep the state visible in a muted
          form only if search is not being used.
        */
        if (query) {
          return false;
        }
      }

      return true;
    });
  }, [
    stateStats,
    filter,
    search,
  ]);

  return (
    <div className="mplads-map-page">

      {/* ================= HEADER ================= */}

      <header className="map-main-header">
        <div className="header-title-block">
          <div className="map-brand-icon">
            ◈
          </div>

          <div>
            <div className="eyebrow">
              GEOGRAPHIC INTELLIGENCE
            </div>

            <h1>
              India MPLADS Risk Intelligence Map
            </h1>

            <p>
              Geographic distribution of
              AI-detected project risk across
              states
            </p>
          </div>
        </div>

        <button
          type="button"
          className="refresh-data-button"
          onClick={loadData}
          disabled={loading}
        >
          {loading
            ? "⟳ Loading..."
            : "↻ Refresh Data"}
        </button>
      </header>

      {/* ================= DATA NOTICE ================= */}

      <section className="data-honesty-banner">
        <div className="notice-icon">
          📍
        </div>

        <div>
          <strong>
            State-level risk distribution
          </strong>

          <p>
            Project-level latitude/longitude
            is not available in the current
            dataset. This map therefore uses
            real Indian state boundaries and
            aggregates MPLADS project risk at
            the state level.
          </p>

          <span>
            No project GPS coordinates are
            fabricated.
          </span>
        </div>
      </section>

      {/* ================= ERROR ================= */}

      {error && (
        <div className="map-error">
          <span>⚠</span>
          <div>
            <strong>
              Data loading issue
            </strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* ================= KPI CARDS ================= */}

      <section className="map-kpi-grid">

        <MetricCard
          icon="▣"
          label="Total Projects"
          value={totals.total}
          subtitle="MPLADS work records"
          tone="total"
        />

        <MetricCard
          icon="!"
          label="Critical"
          value={totals.CRITICAL}
          subtitle="Immediate attention"
          tone="critical"
        />

        <MetricCard
          icon="▲"
          label="High Risk"
          value={totals.HIGH}
          subtitle="Requires verification"
          tone="high"
        />

        <MetricCard
          icon="•"
          label="Medium Risk"
          value={totals.MEDIUM}
          subtitle="Monitor projects"
          tone="medium"
        />

        <MetricCard
          icon="✓"
          label="Low Risk"
          value={totals.LOW}
          subtitle="Normal monitoring"
          tone="low"
        />

        <MetricCard
          icon="◎"
          label="States Covered"
          value={statesCovered}
          subtitle="Geographic coverage"
          tone="states"
        />

      </section>

      {/* ================= CONTROLS ================= */}

      <section className="map-control-section">

        <div className="control-heading">
          <div>
            <div className="section-eyebrow">
              STATE RISK DISTRIBUTION
            </div>

            <h2>
              Analyze geographic
              concentration
            </h2>

            <p>
              Select a risk level to
              emphasize its geographic
              distribution.
            </p>
          </div>

          <div className="control-actions">

            <div className="search-box">
              <span>⌕</span>

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search state..."
                type="text"
              />

              {search && (
                <button
                  type="button"
                  onClick={() =>
                    setSearch("")
                  }
                >
                  ×
                </button>
              )}
            </div>

            <button
              type="button"
              className="reset-button"
              onClick={resetMap}
            >
              ↻ Reset
            </button>

          </div>
        </div>

        <div className="risk-filter-row">

          <span className="filter-label">
            Risk filter
          </span>

          <RiskFilter
            active={filter === "ALL"}
            value="ALL"
            label="All Risks"
            onClick={setFilter}
          />

          <RiskFilter
            active={filter === "LOW"}
            value="LOW"
            label="LOW Risk"
            onClick={setFilter}
          />

          <RiskFilter
            active={filter === "MEDIUM"}
            value="MEDIUM"
            label="MEDIUM Risk"
            onClick={setFilter}
          />

          <RiskFilter
            active={filter === "HIGH"}
            value="HIGH"
            label="HIGH Risk"
            onClick={setFilter}
          />

          <RiskFilter
            active={filter === "CRITICAL"}
            value="CRITICAL"
            label="CRITICAL Risk"
            onClick={setFilter}
          />

        </div>

      </section>

      {/* ================= MAIN MAP + DETAILS ================= */}

      <section className="map-dashboard-grid">

        {/* MAP CARD */}

        <div className="india-map-card">

          <div className="map-card-header">

            <div>
              <div className="live-label">
                <span className="live-dot" />
                LIVE MPLADS DATA
              </div>

              <h2>
                India State Risk Map
              </h2>

              <p>
                {statesCovered} states ·{" "}
                {formatNumber(
                  filter === "ALL"
                    ? totals.total
                    : totals[filter]
                )}{" "}
                {filter === "ALL"
                  ? "projects"
                  : `${filter.toLowerCase()} projects`}
              </p>
            </div>

            <div className="map-status">
              <span className="status-dot" />
              LIVE DATA
            </div>

          </div>

          <div className="map-visual-wrapper">

            {loading ? (
              <div className="map-state-message">
                <div className="spinner" />
                <h3>
                  Loading MPLADS intelligence...
                </h3>
                <p>
                  Fetching work-level records
                  from the backend.
                </p>
              </div>
            ) : (
              <>
                <div className="map-floating-title">
                  INDIA
                </div>

                <div className="map-zoom-controls">
                  <button
                    type="button"
                    onClick={zoomIn}
                  >
                    +
                  </button>

                  <div>
                    {Math.round(
                      zoom * 100
                    )}
                    %
                  </div>

                  <button
                    type="button"
                    onClick={zoomOut}
                  >
                    −
                  </button>

                  <button
                    type="button"
                    onClick={resetMap}
                    title="Reset map"
                  >
                    ⌂
                  </button>
                </div>

                <div
                  className="svg-map-shell"
                  style={{
                    transform: `scale(${zoom})`,
                  }}
                >

                  <svg
                    className="india-risk-svg"
                    viewBox={viewBox}
                    role="img"
                    aria-label="India state-level MPLADS risk map"
                  >

                    {mapLocations.map(
                      (location) => {
                        const stats =
                          resolveStatsForLocation(
                            location,
                            stateStats
                          );

                        const isSelected =
                          selectedState &&
                          cleanStateName(
                            selectedState.state
                          ) ===
                            cleanStateName(
                              location.name
                            );

                        const isHovered =
                          hoveredState &&
                          cleanStateName(
                            hoveredState.state
                          ) ===
                            cleanStateName(
                              location.name
                            );

                        const fill =
                          getStateFill(
                            stats,
                            filter
                          );

                        const opacity =
                          getStateOpacity(
                            stats,
                            filter
                          );

                        return (
                          <path
                            key={
                              location.id ||
                              location.name
                            }
                            ref={(node) => {
                              pathRefs.current[
                                location.id
                              ] = node;
                            }}
                            d={location.path}
                            className={`india-state-path ${
                              isSelected
                                ? "selected"
                                : ""
                            } ${
                              isHovered
                                ? "hovered"
                                : ""
                            }`}
                            fill={fill}
                            fillOpacity={
                              isSelected ||
                              isHovered
                                ? 1
                                : opacity
                            }
                            stroke="#ffffff"
                            strokeWidth={
                              isSelected
                                ? 2.8
                                : 1.2
                            }
                            onMouseEnter={() =>
                              setHoveredState(
                                stats
                              )
                            }
                            onMouseLeave={() =>
                              setHoveredState(
                                null
                              )
                            }
                            onClick={() =>
                              handleStateClick(
                                location
                              )
                            }
                          />
                        );
                      }
                    )}

                  </svg>

                </div>

                {/* HOVER TOOLTIP */}

                {hoveredState && (
                  <div className="state-hover-card">

                    <div className="hover-state-name">
                      {hoveredState.state}
                    </div>

                    <div className="hover-total">
                      {formatNumber(
                        hoveredState.total
                      )}
                      <span>
                        projects
                      </span>
                    </div>

                    <div className="hover-risk-grid">

                      <div>
                        <b className="critical-text">
                          {formatNumber(
                            hoveredState.CRITICAL
                          )}
                        </b>
                        <span>
                          Critical
                        </span>
                      </div>

                      <div>
                        <b className="high-text">
                          {formatNumber(
                            hoveredState.HIGH
                          )}
                        </b>
                        <span>
                          High
                        </span>
                      </div>

                      <div>
                        <b className="medium-text">
                          {formatNumber(
                            hoveredState.MEDIUM
                          )}
                        </b>
                        <span>
                          Medium
                        </span>
                      </div>

                      <div>
                        <b className="low-text">
                          {formatNumber(
                            hoveredState.LOW
                          )}
                        </b>
                        <span>
                          Low
                        </span>
                      </div>

                    </div>

                    <div className="hover-score">
                      Avg. Risk Score
                      <strong>
                        {hoveredState.averageRisk.toFixed(
                          1
                        )}
                      </strong>
                    </div>

                  </div>
                )}

                {/* LEGEND */}

                <div className="map-legend-card">

                  <strong>
                    RISK INTENSITY
                  </strong>

                  <div className="legend-row">

                    <span>
                      <i className="legend-color low" />
                      Low
                    </span>

                    <span>
                      <i className="legend-color medium" />
                      Medium
                    </span>

                    <span>
                      <i className="legend-color high" />
                      High
                    </span>

                    <span>
                      <i className="legend-color critical" />
                      Critical
                    </span>

                  </div>

                  <small>
                    State color represents
                    aggregated project risk,
                    not individual GPS
                    locations.
                  </small>

                </div>
              </>
            )}

          </div>

        </div>

        {/* ================= STATE DETAILS ================= */}

        <aside className="state-detail-card">

          {selectedState ? (
            <div className="state-detail-content">

              <button
                type="button"
                className="close-detail"
                onClick={() =>
                  setSelectedState(null)
                }
              >
                ×
              </button>

              <div className="detail-eyebrow">
                SELECTED STATE
              </div>

              <h2>
                {selectedState.state}
              </h2>

              <div className="detail-total">
                {formatNumber(
                  selectedState.total
                )}
                <span>
                  Projects
                </span>
              </div>

              <div className="detail-score-card">
                <span>
                  Average Risk Score
                </span>

                <strong>
                  {selectedState.averageRisk.toFixed(
                    1
                  )}
                </strong>
              </div>

              <div className="detail-stat-list">

                <div className="detail-risk-row">
                  <span>
                    <i className="risk-dot critical" />
                    Critical
                  </span>

                  <strong>
                    {formatNumber(
                      selectedState.CRITICAL
                    )}
                  </strong>
                </div>

                <div className="detail-risk-row">
                  <span>
                    <i className="risk-dot high" />
                    High
                  </span>

                  <strong>
                    {formatNumber(
                      selectedState.HIGH
                    )}
                  </strong>
                </div>

                <div className="detail-risk-row">
                  <span>
                    <i className="risk-dot medium" />
                    Medium
                  </span>

                  <strong>
                    {formatNumber(
                      selectedState.MEDIUM
                    )}
                  </strong>
                </div>

                <div className="detail-risk-row">
                  <span>
                    <i className="risk-dot low" />
                    Low
                  </span>

                  <strong>
                    {formatNumber(
                      selectedState.LOW
                    )}
                  </strong>
                </div>

              </div>

              <div className="allocation-card">
                <span>
                  Total Allocation
                </span>

                <strong>
                  {formatAmount(
                    selectedState.totalAllocation
                  )}
                </strong>
              </div>

              <div className="risk-reasons-section">

                <div className="detail-section-title">
                  TOP RISK SIGNALS
                </div>

                {selectedReasons.length >
                0 ? (
                  <div className="reason-list">
                    {selectedReasons.map(
                      ([reason, count]) => (
                        <div
                          className="reason-item"
                          key={reason}
                        >
                          <span>
                            {reason}
                          </span>

                          <b>
                            {count}
                          </b>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <div className="no-reasons">
                    No risk-reason details
                    were supplied by the
                    current API response.
                  </div>
                )}

              </div>

              <div className="human-verification-note">
                <span>⚠</span>

                <div>
                  <strong>
                    Human verification required
                  </strong>

                  <p>
                    AI risk signals are
                    indicators for review,
                    not a declaration of
                    fraud.
                  </p>
                </div>
              </div>

            </div>
          ) : (
            <div className="empty-state-detail">

              <div className="empty-map-icon">
                ◈
              </div>

              <h2>
                Select a State
              </h2>

              <p>
                Click any highlighted state
                on the map to view detailed
                MPLADS risk intelligence.
              </p>

              <div className="empty-hint">
                Hover over a state for a
                quick risk summary.
              </div>

            </div>
          )}

        </aside>

      </section>

      {/* ================= PRIORITY VIEW ================= */}

      <section className="priority-section">

        <div className="priority-eyebrow">
          PRIORITY VIEW
        </div>

        <h2>
          States with highest combined
          High + Critical volume
        </h2>

        <div className="priority-list">

          {topPriorityStates.length > 0 ? (
            topPriorityStates.map(
              (state) => (
                <button
                  type="button"
                  key={state.state}
                  onClick={() => {
                    setSelectedState(
                      state
                    );

                    const location =
                      India.locations.find(
                        (item) =>
                          cleanStateName(
                            item.name
                          ) ===
                          cleanStateName(
                            state.state
                          )
                      );

                    if (location) {
                      focusLocation(
                        location,
                        state
                      );
                    }
                  }}
                >
                  <strong>
                    {state.state}
                  </strong>

                  <span>
                    {formatNumber(
                      state.highCritical
                    )}
                  </span>

                  <small>
                    high + critical
                  </small>
                </button>
              )
            )
          ) : (
            <div className="no-priority">
              No state-level risk data
              available.
            </div>
          )}

        </div>

      </section>

      {/* ================= FOOTER ================= */}

      <footer className="map-footer">
        <span>
          AI Risk Intelligence
        </span>

        <i>•</i>

        <span>
          State-level geographic
          visualization
        </span>

        <i>•</i>

        <span>
          Human verification required
        </span>
      </footer>

    </div>
  );
}

export default MapView;