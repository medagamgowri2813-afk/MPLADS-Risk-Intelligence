
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const XLSX = require("xlsx");
const { spawn } = require("child_process");

const app = express();

app.use(cors());
app.use(express.json({ limit: "20mb" }));

// ============================================================
// PATHS
// ============================================================

const PROJECT_ROOT = path.join(__dirname, "..");
const ML_DIR = path.join(PROJECT_ROOT, "ml");
const DATA_DIR = path.join(ML_DIR, "data");
const UPLOAD_DIR = path.join(ML_DIR, "uploads");

const WORK_LEVEL_FILE = path.join(
  DATA_DIR,
  "uploaded_mplads_work_level.csv"
);

const ALLOCATION_FILE = path.join(
  DATA_DIR,
  "uploaded_allocation.csv"
);

const PROJECT_FILE = path.join(
  DATA_DIR,
  "uploaded_mplads.csv"
);

const FEATURES_FILE = path.join(
  DATA_DIR,
  "mplads_features.csv"
);

const ANOMALY_FILE = path.join(
  DATA_DIR,
  "mplads_anomaly_results.csv"
);

const RISK_FILE = path.join(
  DATA_DIR,
  "mplads_final_risk_data.csv"
);

const PIPELINE_LOG = path.join(
  DATA_DIR,
  "pipeline.log"
);

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ============================================================
// ACTIVE DATASET
// ============================================================

let activeDatasetType = null;

let activeDatasetMeta = {
  datasetType: null,
  fileName: null,
  rows: 0,
  uploadedAt: null
};

// ============================================================
// PIPELINE STATUS
// ============================================================

let pipelineStatus = {
  status: "IDLE",
  step: null,
  progress: 0,
  message: "Ready",
  startedAt: null,
  finishedAt: null,
  error: null,
  result: null
};

let pipelineRunning = false;

// ============================================================
// MULTER
// ============================================================

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },

  filename: function (req, file, cb) {
    const extension = path.extname(file.originalname);

    const filename =
      "upload_" +
      Date.now() +
      extension;

    cb(null, filename);
  }
});

const upload = multer({
  storage,

  limits: {
    fileSize: 50 * 1024 * 1024
  },

  fileFilter: function (req, file, cb) {
    const extension =
      path.extname(file.originalname).toLowerCase();

    if (
      extension !== ".csv" &&
      extension !== ".xlsx" &&
      extension !== ".xls"
    ) {
      return cb(
        new Error(
          "Only CSV, XLSX and XLS files are supported."
        )
      );
    }

    cb(null, true);
  }
});

// ============================================================
// COLUMN NORMALIZATION
// ============================================================

function normalizeColumn(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/^\uFEFF/, "")
    .replace(/[₹$€£]/g, "")
    .replace(/%/g, "percentage")
    .replace(/['"`]/g, "")
    .replace(/[()[\]{}]/g, "")
    .replace(/[\/\\-]+/g, "_")
    .replace(/[.:;,]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// ============================================================
// TEXT CLEANING
// ============================================================

function cleanText(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value)
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================
// NUMBER PARSING
// ============================================================

function parseNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : 0;
  }

  const text = String(value)
    .replace(/[₹$€£]/g, "")
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .trim();

  const number = Number(text);

  if (Number.isFinite(number)) {
    return number;
  }

  const match = text.match(
    /-?\d+(?:\.\d+)/
  );

  if (!match) {
    return 0;
  }

  return Number(match[0]);
}

// ============================================================
// DATE PARSING
// ============================================================

function parseDate(value) {
  if (!value) {
    return null;
  }

  const text = cleanText(value);

  if (!text) {
    return null;
  }

  const date = new Date(text);

  if (!Number.isNaN(date.getTime())) {
    return date;
  }

  const match = text.match(
    /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/
  );

  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    const year = Number(match[3]);

    const parsed = new Date(
      year,
      month,
      day
    );

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

// ============================================================
// CSV DELIMITER DETECTION
// ============================================================

function detectDelimiter(filePath) {
  const text = fs.readFileSync(
    filePath,
    "utf8"
  );

  const sample = text
    .replace(/^\uFEFF/, "")
    .slice(0, 50000);

  const firstLine =
    sample.split(/\r?\n/)[0] || "";

  const delimiters = [
    ";",
    ",",
    "\t",
    "|"
  ];

  let bestDelimiter = ",";
  let bestCount = -1;

  for (const delimiter of delimiters) {
    const count =
      firstLine.split(delimiter).length - 1;

    if (count > bestCount) {
      bestCount = count;
      bestDelimiter = delimiter;
    }
  }

  return bestDelimiter;
}

// ============================================================
// READ FILE
// ============================================================

function readUploadedFile(filePath) {
  const extension =
    path.extname(filePath).toLowerCase();

  let workbook;

  if (extension === ".csv") {
    const delimiter =
      detectDelimiter(filePath);

    workbook = XLSX.readFile(
      filePath,
      {
        raw: false,
        cellDates: true,
        FS: delimiter
      }
    );
  } else {
    workbook = XLSX.readFile(
      filePath,
      {
        raw: false,
        cellDates: true
      }
    );
  }

  if (
    !workbook.SheetNames ||
    workbook.SheetNames.length === 0
  ) {
    throw new Error(
      "No worksheet found in uploaded file."
    );
  }

  const sheet =
    workbook.Sheets[
      workbook.SheetNames[0]
    ];

  if (!sheet) {
    throw new Error(
      "Unable to read uploaded file."
    );
  }

  return XLSX.utils.sheet_to_json(
    sheet,
    {
      defval: ""
    }
  );
}

// ============================================================
// COLUMN ALIASES
// ============================================================

const ALIASES = {
  mpName: [
    "MP NAME",
    "MP_NAME",
    "MP",
    "Member of Parliament",
    "Member Name",
    "Honble Members of Parliaments",
    "Honble Members of Parliament",
    "Hon'ble Members of Parliaments",
    "Hon'ble Members of Parliament"
  ],

  work: [
    "WORK",
    "Work Name",
    "Work Description",
    "Description",
    "Project",
    "Project Name",
    "work_description"
  ],

  category: [
    "CATEGORY",
    "Category",
    "Work Category",
    "Work Type",
    "Sector",
    "work_type"
  ],

  state: [
    "STATE",
    "State Name",
    "state"
  ],

  constituency: [
    "CONSTITUENCY",
    "Parliamentary Constituency",
    "MP Constituency",
    "constituency"
  ],

  district: [
    "DISTRICT",
    "District Name",
    "district"
  ],

  city: [
    "CITY",
    "Town",
    "city"
  ],

  ward: [
    "WARD",
    "ward"
  ],

  block: [
    "BLOCK",
    "block"
  ],

  village: [
    "VILLAGE",
    "village"
  ],

  recommendedDate: [
    "RECOMMENDED DATE",
    "Recommended Date",
    "Recommendation Date",
    "Date Recommended",
    "Recommended_Date",
    "recommended_date"
  ],

  allocationAmount: [
    "ALLOCATION AMOUNT",
    "Allocated Amount",
    "Allocated AMOUNT",
    "Allocated Amount Rs",
    "Allocated Amount ₹",
    "Allocated AMOUNT ( ₹ )",
    "Allocation",
    "allocation_amount",
    "sanction_amount"
  ],

  approval: [
    "IDA APPROVAL",
    "Approval",
    "IDA Approved",
    "Approval Status",
    "ida_approval"
  ],

  status: [
    "STATUS",
    "Status",
    "Work Status",
    "status"
  ],

  house: [
    "HOUSE",
    "Lok Sabha",
    "Rajya Sabha",
    "house"
  ],

  workId: [
    "WORK ID",
    "Work_ID",
    "Project ID",
    "Project_ID",
    "ID",
    "work_id"
  ],

  estimatedCost: [
    "ESTIMATED COST",
    "Estimated Cost",
    "estimated_cost"
  ],

  expenditure: [
    "EXPENDITURE",
    "Expenditure",
    "expenditure"
  ],

  progress: [
    "PROGRESS",
    "Progress",
    "Progress Percentage",
    "Progress %",
    "progress_percentage"
  ],

  workType: [
    "WORK TYPE",
    "Work Type",
    "work_type"
  ]
};

// ============================================================
// FIND COLUMN
// ============================================================

function findColumn(row, aliases) {
  const columns =
    Object.keys(row);

  const normalizedColumns =
    columns.map(normalizeColumn);

  for (const alias of aliases) {
    const normalizedAlias =
      normalizeColumn(alias);

    const index =
      normalizedColumns.indexOf(
        normalizedAlias
      );

    if (index !== -1) {
      return columns[index];
    }
  }

  return null;
}

// ============================================================
// GET VALUE
// ============================================================

function getColumnValue(row, column) {
  if (!column) {
    return "";
  }

  return row[column];
}

// ============================================================
// DATASET DETECTION
// ============================================================

function detectDatasetType(rows) {
  if (
    !rows ||
    rows.length === 0
  ) {
    throw new Error(
      "Uploaded file contains no data."
    );
  }

  const firstRow = rows[0];

  const workColumn =
    findColumn(
      firstRow,
      ALIASES.work
    );

  const stateColumn =
    findColumn(
      firstRow,
      ALIASES.state
    );

  const constituencyColumn =
    findColumn(
      firstRow,
      ALIASES.constituency
    );

  const dateColumn =
    findColumn(
      firstRow,
      ALIASES.recommendedDate
    );

  const allocationColumn =
    findColumn(
      firstRow,
      ALIASES.allocationAmount
    );

  const statusColumn =
    findColumn(
      firstRow,
      ALIASES.status
    );

  const mpColumn =
    findColumn(
      firstRow,
      ALIASES.mpName
    );

  const expenditureColumn =
    findColumn(
      firstRow,
      ALIASES.expenditure
    );

  const progressColumn =
    findColumn(
      firstRow,
      ALIASES.progress
    );

  const estimatedColumn =
    findColumn(
      firstRow,
      ALIASES.estimatedCost
    );

  // ----------------------------------------------------------
  // PROJECT
  // ----------------------------------------------------------

  if (
    workColumn &&
    stateColumn &&
    (
      expenditureColumn ||
      progressColumn ||
      estimatedColumn
    )
  ) {
    return "PROJECT";
  }

  // ----------------------------------------------------------
  // WORK LEVEL
  // ----------------------------------------------------------

  if (
    workColumn &&
    stateColumn &&
    constituencyColumn &&
    dateColumn &&
    allocationColumn &&
    statusColumn
  ) {
    return "MPLADS_WORK_LEVEL";
  }

  // ----------------------------------------------------------
  // ALLOCATION
  // ----------------------------------------------------------

  if (
    stateColumn &&
    constituencyColumn &&
    allocationColumn &&
    mpColumn
  ) {
    return "ALLOCATION";
  }

  // ----------------------------------------------------------
  // SIMPLE PROJECT FALLBACK
  // ----------------------------------------------------------

  if (
    workColumn &&
    stateColumn
  ) {
    return "PROJECT";
  }

  return "UNKNOWN";
}

// ============================================================
// BUILD WORK LEVEL DATA
// ============================================================

function buildWorkLevelData(rows) {
  if (!rows.length) {
    return [];
  }

  const firstRow = rows[0];

  const columns = {
    mpName: findColumn(
      firstRow,
      ALIASES.mpName
    ),

    work: findColumn(
      firstRow,
      ALIASES.work
    ),

    category: findColumn(
      firstRow,
      ALIASES.category
    ),

    state: findColumn(
      firstRow,
      ALIASES.state
    ),

    constituency: findColumn(
      firstRow,
      ALIASES.constituency
    ),

    district: findColumn(
      firstRow,
      ALIASES.district
    ),

    city: findColumn(
      firstRow,
      ALIASES.city
    ),

    ward: findColumn(
      firstRow,
      ALIASES.ward
    ),

    block: findColumn(
      firstRow,
      ALIASES.block
    ),

    village: findColumn(
      firstRow,
      ALIASES.village
    ),

    recommendedDate: findColumn(
      firstRow,
      ALIASES.recommendedDate
    ),

    allocationAmount: findColumn(
      firstRow,
      ALIASES.allocationAmount
    ),

    approval: findColumn(
      firstRow,
      ALIASES.approval
    ),

    status: findColumn(
      firstRow,
      ALIASES.status
    ),

    house: findColumn(
      firstRow,
      ALIASES.house
    ),

    workId: findColumn(
      firstRow,
      ALIASES.workId
    )
  };

  return rows.map(
    (row, index) => {
      const existingId =
        cleanText(
          getColumnValue(
            row,
            columns.workId
          )
        );

      const workId =
        existingId ||
        "MPLADS-" +
          String(index + 1)
            .padStart(6, "0");

      return {
        work_id: workId,

        mp_name:
          cleanText(
            getColumnValue(
              row,
              columns.mpName
            )
          ),

        work:
          cleanText(
            getColumnValue(
              row,
              columns.work
            )
          ),

        category:
          cleanText(
            getColumnValue(
              row,
              columns.category
            )
          ),

        state:
          cleanText(
            getColumnValue(
              row,
              columns.state
            )
          ),

        constituency:
          cleanText(
            getColumnValue(
              row,
              columns.constituency
            )
          ),

        district:
          cleanText(
            getColumnValue(
              row,
              columns.district
            )
          ),

        city:
          cleanText(
            getColumnValue(
              row,
              columns.city
            )
          ),

        ward:
          cleanText(
            getColumnValue(
              row,
              columns.ward
            )
          ),

        block:
          cleanText(
            getColumnValue(
              row,
              columns.block
            )
          ),

        village:
          cleanText(
            getColumnValue(
              row,
              columns.village
            )
          ),

        recommended_date:
          cleanText(
            getColumnValue(
              row,
              columns.recommendedDate
            )
          ),

        allocation_amount:
          parseNumber(
            getColumnValue(
              row,
              columns.allocationAmount
            )
          ),

        ida_approval:
          cleanText(
            getColumnValue(
              row,
              columns.approval
            )
          ),

        status:
          cleanText(
            getColumnValue(
              row,
              columns.status
            )
          ),

        house:
          cleanText(
            getColumnValue(
              row,
              columns.house
            )
          )
      };
    }
  );
}

// ============================================================
// BUILD ALLOCATION DATA
// ============================================================

function buildAllocationData(rows) {
  if (!rows.length) {
    return [];
  }

  const firstRow = rows[0];

  const columns = {
    mpName: findColumn(
      firstRow,
      ALIASES.mpName
    ),

    state: findColumn(
      firstRow,
      ALIASES.state
    ),

    constituency: findColumn(
      firstRow,
      ALIASES.constituency
    ),

    allocationAmount: findColumn(
      firstRow,
      ALIASES.allocationAmount
    )
  };

  return rows.map(
    (row, index) => {
      return {
        sr_no:
          String(index + 1),

        state:
          cleanText(
            getColumnValue(
              row,
              columns.state
            )
          ),

        mp:
          cleanText(
            getColumnValue(
              row,
              columns.mpName
            )
          ),

        constituency:
          cleanText(
            getColumnValue(
              row,
              columns.constituency
            )
          ),

        allocated_amount:
          parseNumber(
            getColumnValue(
              row,
              columns.allocationAmount
            )
          )
      };
    }
  );
}

// ============================================================
// BUILD + ENRICH PROJECT DATA
// ============================================================

function enrichProjectData(rows) {
  if (!rows || rows.length === 0) {
    return [];
  }

  const firstRow = rows[0];

  const columns = {
    workId: findColumn(
      firstRow,
      ALIASES.workId
    ),

    state: findColumn(
      firstRow,
      ALIASES.state
    ),

    district: findColumn(
      firstRow,
      ALIASES.district
    ),

    work: findColumn(
      firstRow,
      ALIASES.work
    ),

    category: findColumn(
      firstRow,
      ALIASES.workType
    ) ||
      findColumn(
        firstRow,
        ALIASES.category
      ),

    sanction: findColumn(
      firstRow,
      ALIASES.allocationAmount
    ),

    estimated: findColumn(
      firstRow,
      ALIASES.estimatedCost
    ),

    expenditure: findColumn(
      firstRow,
      ALIASES.expenditure
    ),

    progress: findColumn(
      firstRow,
      ALIASES.progress
    ),

    status: findColumn(
      firstRow,
      ALIASES.status
    )
  };

  return rows.map(
    (row, index) => {
      const workId =
        cleanText(
          getColumnValue(
            row,
            columns.workId
          )
        ) ||
        "PROJECT-" +
          String(index + 1)
            .padStart(6, "0");

      const state =
        cleanText(
          getColumnValue(
            row,
            columns.state
          )
        );

      const district =
        cleanText(
          getColumnValue(
            row,
            columns.district
          )
        );

      const work =
        cleanText(
          getColumnValue(
            row,
            columns.work
          )
        );

      const workType =
        cleanText(
          getColumnValue(
            row,
            columns.category
          )
        ) ||
        "General";

      const sanction =
        parseNumber(
          getColumnValue(
            row,
            columns.sanction
          )
        );

      const estimated =
        parseNumber(
          getColumnValue(
            row,
            columns.estimated
          )
        );

      const expenditure =
        parseNumber(
          getColumnValue(
            row,
            columns.expenditure
          )
        );

      let progress =
        parseNumber(
          getColumnValue(
            row,
            columns.progress
          )
        );

      if (progress < 0) {
        progress = 0;
      }

      if (progress > 100) {
        progress = 100;
      }

      const status =
        cleanText(
          getColumnValue(
            row,
            columns.status
          )
        );

      const statusLower =
        status.toLowerCase();

      const delayed =
        statusLower.includes("delay") ||
        statusLower.includes("delayed");

      const completed =
        statusLower.includes("complete") ||
        progress >= 100;

      const incomplete =
        !completed &&
        progress < 50;

      const expenditureRatio =
        sanction > 0
          ? expenditure / sanction
          : 0;

      const costRatio =
        estimated > 0
          ? sanction / estimated
          : 0;

      const progressExpenditureGap =
        expenditureRatio * 100 -
        progress;

      const costRisk =
        estimated > 0 &&
        sanction > estimated * 1.15;

      const zeroProgressWithExpenditure =
        progress === 0 &&
        expenditure > 0;

      // --------------------------------------------------------
      // ANOMALY SIGNALS
      // --------------------------------------------------------

      let anomalySignals = 0;
      const anomalyReasons = [];

      if (delayed) {
        anomalySignals++;
        anomalyReasons.push(
          "Project is delayed"
        );
      }

      if (
        incomplete &&
        expenditureRatio > 0.70
      ) {
        anomalySignals++;
        anomalyReasons.push(
          "High expenditure with low progress"
        );
      }

      if (
        Math.abs(
          progressExpenditureGap
        ) >= 35
      ) {
        anomalySignals++;
        anomalyReasons.push(
          "Progress and expenditure mismatch"
        );
      }

      if (costRisk) {
        anomalySignals++;
        anomalyReasons.push(
          "Sanction amount exceeds estimated cost"
        );
      }

      if (
        zeroProgressWithExpenditure
      ) {
        anomalySignals++;
        anomalyReasons.push(
          "Expenditure recorded with zero progress"
        );
      }

      const anomaly =
        anomalySignals >= 2;

      // --------------------------------------------------------
      // RISK SCORE
      // --------------------------------------------------------

      let riskScore = 0;
      const riskReasons = [];

      if (anomaly) {
        riskScore += 40;
        riskReasons.push(
          "Multiple unusual project patterns detected"
        );
      }

      if (delayed) {
        riskScore += 20;
        riskReasons.push(
          "Project is delayed"
        );
      }

      if (
        incomplete &&
        expenditureRatio > 0.70
      ) {
        riskScore += 20;
        riskReasons.push(
          "Low progress despite high expenditure"
        );
      }

      if (
        Math.abs(
          progressExpenditureGap
        ) >= 35
      ) {
        riskScore += 15;
        riskReasons.push(
          "Progress and expenditure mismatch"
        );
      }

      if (costRisk) {
        riskScore += 10;
        riskReasons.push(
          "Sanction amount is significantly above estimated cost"
        );
      }

      if (
        zeroProgressWithExpenditure
      ) {
        riskScore += 15;
        riskReasons.push(
          "Expenditure exists while progress is zero"
        );
      }

      // Additional strong signal
      if (
        expenditureRatio >= 0.90 &&
        progress < 50
      ) {
        riskScore += 15;
        riskReasons.push(
          "Most sanctioned amount spent while progress remains below 50%"
        );
      }

      // Strong cost mismatch
      if (
        estimated > 0 &&
        sanction >= estimated * 1.30
      ) {
        riskScore += 15;
        riskReasons.push(
          "Sanction amount is substantially above estimated cost"
        );
      }

      if (riskScore > 100) {
        riskScore = 100;
      }

      let riskLevel = "LOW";

      if (riskScore >= 81) {
        riskLevel = "CRITICAL";
      } else if (riskScore >= 61) {
        riskLevel = "HIGH";
      } else if (riskScore >= 31) {
        riskLevel = "MEDIUM";
      }

      if (
        riskReasons.length === 0
      ) {
        riskReasons.push(
          "No significant risk signal detected"
        );
      }

      // --------------------------------------------------------
      // FINAL FRONTEND-COMPATIBLE RECORD
      // --------------------------------------------------------

      return {
        work_id: workId,

        state,
        district,

        work_description: work,

        work_type: workType,

        sanction_amount: sanction,

        estimated_cost: estimated,

        expenditure,

        progress_percentage: progress,

        status,

        anomaly: anomaly
          ? "1"
          : "0",

        anomaly_status:
          anomaly
            ? "Anomaly"
            : "Normal",

        anomaly_risk_score:
          anomaly
            ? Math.min(
                100,
                50 +
                  anomalySignals * 10
              )
            : 0,

        risk_score: riskScore,

        risk_level: riskLevel,

        risk_reasons:
          riskReasons.join("; "),

        expenditure_ratio:
          Number(
            expenditureRatio.toFixed(4)
          ),

        progress_expenditure_gap:
          Number(
            progressExpenditureGap.toFixed(2)
          ),

        delay_flag:
          delayed
            ? 1
            : 0,

        // Frontend compatibility
        Work_ID: workId,
        State: state,
        District: district,
        Work_Description: work,
        Work_Type: workType,
        Sanction_Amount: sanction,
        Estimated_Cost: estimated,
        Expenditure: expenditure,
        Progress_Percentage: progress,
        Status: status,
        Anomaly:
          anomaly
            ? 1
            : 0,
        Anomaly_Status:
          anomaly
            ? "Anomaly"
            : "Normal",
        Anomaly_Risk_Score:
          anomaly
            ? Math.min(
                100,
                50 +
                  anomalySignals * 10
              )
            : 0,
        Risk_Score: riskScore,
        Risk_Level: riskLevel,
        Risk_Reasons:
          riskReasons.join("; "),
        Expenditure_Ratio:
          Number(
            expenditureRatio.toFixed(4)
          ),
        Progress_Expenditure_Gap:
          Number(
            progressExpenditureGap.toFixed(2)
          ),
        Delay_Flag:
          delayed
            ? 1
            : 0
      };
    }
  );
}

// ============================================================
// CSV ESCAPE
// ============================================================

function escapeCSV(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  const text =
    String(value);

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n") ||
    text.includes("\r")
  ) {
    return (
      '"' +
      text.replace(
        /"/g,
        '""'
      ) +
      '"'
    );
  }

  return text;
}

// ============================================================
// WRITE CSV
// ============================================================

function writeCSV(filePath, rows) {
  if (
    !rows ||
    rows.length === 0
  ) {
    fs.writeFileSync(
      filePath,
      "",
      "utf8"
    );
    return;
  }

  const columns = [];

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!columns.includes(key)) {
        columns.push(key);
      }
    }
  }

  const lines = [];

  lines.push(
    columns
      .map(escapeCSV)
      .join(",")
  );

  for (const row of rows) {
    lines.push(
      columns
        .map(
          (column) =>
            escapeCSV(
              row[column]
            )
        )
        .join(",")
    );
  }

  fs.writeFileSync(
    filePath,
    lines.join("\n"),
    "utf8"
  );
}

// ============================================================
// RUN PYTHON SCRIPT
// ============================================================

function runPythonScript(scriptName) {
  return new Promise(
    (resolve, reject) => {
      const scriptPath =
        path.join(
          ML_DIR,
          scriptName
        );

      if (!fs.existsSync(scriptPath)) {
        reject(
          new Error(
            "Python script not found: " +
              scriptPath
          )
        );
        return;
      }

      const commands =
        process.platform === "win32"
          ? ["python", "py"]
          : ["python3", "python"];

      let commandIndex = 0;

      function execute() {
        if (
          commandIndex >=
          commands.length
        ) {
          reject(
            new Error(
              "Python was not found on this system."
            )
          );
          return;
        }

        const command =
          commands[commandIndex];

        console.log(
          "\nRunning:",
          command,
          scriptName
        );

        const child =
          spawn(
            command,
            [scriptPath],
            {
              cwd: ML_DIR,
              shell: false,
              windowsHide: true,
              env: {
                ...process.env,
                PYTHONIOENCODING: "utf-8"
              }
            }
          );

        let stdout = "";
        let stderr = "";

        child.stdout.on(
          "data",
          (data) => {
            const text =
              data.toString();

            stdout += text;

            console.log(
              text.trim()
            );
          }
        );

        child.stderr.on(
          "data",
          (data) => {
            const text =
              data.toString();

            stderr += text;

            console.error(
              text.trim()
            );
          }
        );

        child.on(
          "error",
          (error) => {
            if (
              error.code === "ENOENT"
            ) {
              commandIndex++;
              execute();
              return;
            }

            reject(error);
          }
        );

        child.on(
          "close",
          (code) => {
            if (code === 0) {
              resolve({
                script: scriptName,
                stdout,
                stderr
              });
            } else {
              reject(
                new Error(
                  scriptName +
                    " failed with exit code " +
                    code +
                    "\n" +
                    stderr
                )
              );
            }
          }
        );
      }

      execute();
    }
  );
}

// ============================================================
// START AI PIPELINE
// ============================================================

async function startAIPipeline() {
  if (pipelineRunning) {
    console.log(
      "AI pipeline already running."
    );
    return;
  }

  pipelineRunning = true;

  pipelineStatus = {
    status: "RUNNING",
    step: "FEATURE_ENGINEERING",
    progress: 10,
    message:
      "Starting AI pipeline...",
    startedAt:
      new Date().toISOString(),
    finishedAt: null,
    error: null,
    result: null
  };

  try {
    fs.writeFileSync(
      PIPELINE_LOG,
      "Pipeline started: " +
        new Date().toISOString() +
        "\n",
      "utf8"
    );

    pipelineStatus = {
      ...pipelineStatus,
      step: "FEATURE_ENGINEERING",
      progress: 20,
      message:
        "Creating AI features..."
    };

    await runPythonScript(
      "feature_engineering.py"
    );

    pipelineStatus = {
      ...pipelineStatus,
      step: "ANOMALY_DETECTION",
      progress: 50,
      message:
        "Running Isolation Forest anomaly detection..."
    };

    await runPythonScript(
      "anomaly_detection.py"
    );

    pipelineStatus = {
      ...pipelineStatus,
      step: "RISK_SCORING",
      progress: 75,
      message:
        "Calculating MPLADS risk scores..."
    };

    await runPythonScript(
      "risk_scoring.py"
    );

    if (!fs.existsSync(RISK_FILE)) {
      throw new Error(
        "AI pipeline completed but final risk file was not created: " +
          RISK_FILE
      );
    }

    const finalData =
      readUploadedFile(
        RISK_FILE
      );

    const summary =
      calculateRiskSummary(
        finalData
      );

    pipelineStatus = {
      status: "COMPLETED",
      step: "DONE",
      progress: 100,
      message:
        "AI analysis completed successfully.",
      startedAt:
        pipelineStatus.startedAt,
      finishedAt:
        new Date().toISOString(),
      error: null,
      result: {
        rows:
          finalData.length,
        summary
      }
    };

    fs.appendFileSync(
      PIPELINE_LOG,
      "Pipeline completed: " +
        new Date().toISOString() +
        "\n",
      "utf8"
    );

    console.log(
      "\nAI PIPELINE COMPLETED SUCCESSFULLY"
    );

    console.log(summary);

  } catch (error) {
    console.error(
      "\nAI PIPELINE FAILED:",
      error.message
    );

    pipelineStatus = {
      status: "FAILED",
      step:
        pipelineStatus.step,
      progress:
        pipelineStatus.progress,
      message:
        "AI pipeline failed.",
      startedAt:
        pipelineStatus.startedAt,
      finishedAt:
        new Date().toISOString(),
      error:
        error.message,
      result: null
    };

    fs.appendFileSync(
      PIPELINE_LOG,
      "Pipeline failed: " +
        error.stack +
        "\n",
      "utf8"
    );
  } finally {
    pipelineRunning = false;
  }
}

// ============================================================
// RISK SUMMARY
// ============================================================

function calculateRiskSummary(rows) {
  const summary = {
    totalWorks: rows.length,
    lowRisk: 0,
    mediumRisk: 0,
    highRisk: 0,
    criticalRisk: 0,
    anomalies: 0,
    totalAllocation: 0
  };

  for (const row of rows) {
    const riskLevel =
      String(
        row.Risk_Level ||
          row.risk_level ||
          ""
      )
        .trim()
        .toUpperCase();

    if (riskLevel === "LOW") {
      summary.lowRisk++;
    }

    if (riskLevel === "MEDIUM") {
      summary.mediumRisk++;
    }

    if (riskLevel === "HIGH") {
      summary.highRisk++;
    }

    if (riskLevel === "CRITICAL") {
      summary.criticalRisk++;
    }

    const anomalyStatus =
      String(
        row.Anomaly_Status ||
          row.anomaly_status ||
          ""
      )
        .trim()
        .toLowerCase();

    const anomalyValue =
      String(
        row.Anomaly ||
          row.anomaly ||
          ""
      )
        .trim()
        .toLowerCase();

    if (
      anomalyStatus === "anomaly" ||
      anomalyValue === "1" ||
      anomalyValue === "true"
    ) {
      summary.anomalies++;
    }

    summary.totalAllocation +=
      parseNumber(
        row.sanction_amount ||
          row.Sanction_Amount ||
          row.allocation_amount ||
          row.ALLOCATION_AMOUNT ||
          row["ALLOCATION AMOUNT"]
      );
  }

  return summary;
}

// ============================================================
// PROJECT RISK SUMMARY
// ============================================================

function calculateProjectRiskSummary(rows) {
  const enriched =
    enrichProjectData(rows);

  const summary =
    calculateRiskSummary(
      enriched
    );

  const states = new Set();
  const categories = new Set();

  let totalExpenditure = 0;

  for (const row of enriched) {
    if (row.State) {
      states.add(row.State);
    }

    if (row.Work_Type) {
      categories.add(
        row.Work_Type
      );
    }

    totalExpenditure +=
      parseNumber(
        row.Expenditure
      );
  }

  return {
    ...summary,
    states: states.size,
    categories: categories.size,
    totalExpenditure
  };
}

// ============================================================
// ALLOCATION SUMMARY
// ============================================================

function calculateAllocationSummary(rows) {
  const summary = {
    totalRows: rows.length,
    totalAllocation: 0,
    states: 0,
    constituencies: 0,
    MPs: 0
  };

  const states = new Set();
  const constituencies = new Set();
  const MPs = new Set();

  for (const row of rows) {
    const state =
      cleanText(row.state);

    const constituency =
      cleanText(
        row.constituency
      );

    const mp =
      cleanText(row.mp);

    if (state) {
      states.add(state);
    }

    if (constituency) {
      constituencies.add(
        constituency
      );
    }

    if (mp) {
      MPs.add(mp);
    }

    summary.totalAllocation +=
      parseNumber(
        row.allocated_amount
      );
  }

  summary.states =
    states.size;

  summary.constituencies =
    constituencies.size;

  summary.MPs =
    MPs.size;

  return summary;
}

// ============================================================
// GET RISK DATA
// ============================================================

function getRiskData() {
  if (!fs.existsSync(RISK_FILE)) {
    return [];
  }

  return readUploadedFile(
    RISK_FILE
  );
}

// ============================================================
// GET ALLOCATION DATA
// ============================================================

function getAllocationData() {
  if (!fs.existsSync(ALLOCATION_FILE)) {
    return [];
  }

  return readUploadedFile(
    ALLOCATION_FILE
  );
}

// ============================================================
// GET PROJECT DATA
// ============================================================

function getProjectData() {
  if (!fs.existsSync(PROJECT_FILE)) {
    return [];
  }

  return readUploadedFile(
    PROJECT_FILE
  );
}

// ============================================================
// GET ACTIVE RISK DATA
// ============================================================

function getActiveRiskData() {
  if (
    activeDatasetType ===
    "PROJECT"
  ) {
    return enrichProjectData(
      getProjectData()
    );
  }

  if (
    activeDatasetType ===
    "MPLADS_WORK_LEVEL"
  ) {
    return getRiskData();
  }

  return [];
}

// ============================================================
// HEALTH
// ============================================================

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      success: true,

      message:
        "MPLADS Risk Intelligence backend is running.",

      activeDataset:
        activeDatasetMeta,

      pipeline:
        pipelineStatus,

      riskFileExists:
        fs.existsSync(
          RISK_FILE
        )
    });
  }
);

// ============================================================
// PIPELINE STATUS
// ============================================================

app.get(
  "/api/pipeline/status",
  (req, res) => {
    res.json({
      success: true,

      data:
        pipelineStatus,

      activeDataset:
        activeDatasetMeta
    });
  }
);

// ============================================================
// UPLOAD STATUS
// ============================================================

app.get(
  "/api/upload/status",
  (req, res) => {
    const workRows =
      fs.existsSync(
        WORK_LEVEL_FILE
      )
        ? readUploadedFile(
            WORK_LEVEL_FILE
          )
        : [];

    const allocationRows =
      fs.existsSync(
        ALLOCATION_FILE
      )
        ? readUploadedFile(
            ALLOCATION_FILE
          )
        : [];

    const projectRows =
      fs.existsSync(
        PROJECT_FILE
      )
        ? readUploadedFile(
            PROJECT_FILE
          )
        : [];

    res.json({
      success: true,

      activeDataset:
        activeDatasetMeta,

      workLevel: {
        uploaded:
          workRows.length > 0,
        rows:
          workRows.length
      },

      allocation: {
        uploaded:
          allocationRows.length > 0,
        rows:
          allocationRows.length
      },

      project: {
        uploaded:
          projectRows.length > 0,
        rows:
          projectRows.length
      },

      pipeline:
        pipelineStatus
    });
  }
);

// ============================================================
// DASHBOARD
// ============================================================

app.get(
  "/api/dashboard",
  (req, res) => {
    try {
      // --------------------------------------------------------
      // WORK LEVEL
      // --------------------------------------------------------

      if (
        activeDatasetType ===
        "MPLADS_WORK_LEVEL"
      ) {
        const data =
          getRiskData();

        const summary =
          calculateRiskSummary(
            data
          );

        return res.json({
          success: true,

          datasetType:
            activeDatasetMeta.datasetType,

          datasetName:
            activeDatasetMeta.fileName,

          rows:
            data.length,

          data:
            summary,

          pipeline:
            pipelineStatus
        });
      }

      // --------------------------------------------------------
      // ALLOCATION
      // --------------------------------------------------------

      if (
        activeDatasetType ===
        "ALLOCATION"
      ) {
        const allocationData =
          getAllocationData();

        const summary =
          calculateAllocationSummary(
            allocationData
          );

        return res.json({
          success: true,

          datasetType:
            "ALLOCATION",

          datasetName:
            activeDatasetMeta.fileName,

          rows:
            allocationData.length,

          data: {
            totalWorks:
              allocationData.length,

            lowRisk: 0,
            mediumRisk: 0,
            highRisk: 0,
            criticalRisk: 0,
            anomalies: 0,

            totalAllocation:
              summary.totalAllocation,

            states:
              summary.states,

            constituencies:
              summary.constituencies,

            MPs:
              summary.MPs
          },

          allocation:
            summary,

          pipeline:
            pipelineStatus
        });
      }

      // --------------------------------------------------------
      // PROJECT
      // --------------------------------------------------------

      if (
        activeDatasetType ===
        "PROJECT"
      ) {
        const rawData =
          getProjectData();

        const enrichedData =
          enrichProjectData(
            rawData
          );

        const summary =
          calculateRiskSummary(
            enrichedData
          );

        const states = new Set();
        const categories = new Set();

        let totalExpenditure = 0;

        for (const row of enrichedData) {
          if (row.State) {
            states.add(row.State);
          }

          if (row.Work_Type) {
            categories.add(
              row.Work_Type
            );
          }

          totalExpenditure +=
            parseNumber(
              row.Expenditure
            );
        }

        return res.json({
          success: true,

          datasetType:
            "PROJECT",

          datasetName:
            activeDatasetMeta.fileName,

          rows:
            enrichedData.length,

          data: {
            totalWorks:
              enrichedData.length,

            lowRisk:
              summary.lowRisk,

            mediumRisk:
              summary.mediumRisk,

            highRisk:
              summary.highRisk,

            criticalRisk:
              summary.criticalRisk,

            anomalies:
              summary.anomalies,

            totalAllocation:
              summary.totalAllocation,

            totalExpenditure,

            states:
              states.size,

            categories:
              categories.size
          },

          pipeline:
            pipelineStatus
        });
      }

      // --------------------------------------------------------
      // NO ACTIVE DATASET
      // --------------------------------------------------------

      return res.json({
        success: true,

        datasetType: null,

        datasetName: null,

        rows: 0,

        data: {
          totalWorks: 0,
          lowRisk: 0,
          mediumRisk: 0,
          highRisk: 0,
          criticalRisk: 0,
          anomalies: 0,
          totalAllocation: 0
        },

        pipeline:
          pipelineStatus
      });

    } catch (error) {
      console.error(
        "Dashboard error:",
        error.message
      );

      res.status(500).json({
        success: false,

        message:
          "Unable to load dashboard.",

        error:
          error.message
      });
    }
  }
);

// ============================================================
// WORKS
// ============================================================

app.get(
  "/api/works",
  (req, res) => {
    try {
      const data =
        getActiveRiskData();

      res.json({
        success: true,

        datasetType:
          activeDatasetType,

        count:
          data.length,

        data
      });

    } catch (error) {
      res.status(500).json({
        success: false,

        message:
          "Unable to load works.",

        error:
          error.message
      });
    }
  }
);

// ============================================================
// RISK ALERTS
// ============================================================

app.get(
  "/api/risk-alerts",
  (req, res) => {
    try {
      const data =
        getActiveRiskData();

      const alerts =
        data.filter(
          (row) => {
            const level =
              String(
                row.Risk_Level ||
                  row.risk_level ||
                  ""
              )
                .trim()
                .toUpperCase();

            return (
              level === "HIGH" ||
              level === "CRITICAL"
            );
          }
        );

      res.json({
        success: true,

        count:
          alerts.length,

        data:
          alerts
      });

    } catch (error) {
      res.status(500).json({
        success: false,

        message:
          "Unable to load risk alerts.",

        error:
          error.message
      });
    }
  }
);

// ============================================================
// WORK LEVEL DATA
// ============================================================

app.get(
  "/api/work-level",
  (req, res) => {
    try {
      if (
        !fs.existsSync(
          WORK_LEVEL_FILE
        )
      ) {
        return res.json({
          success: true,
          count: 0,
          data: []
        });
      }

      const data =
        readUploadedFile(
          WORK_LEVEL_FILE
        );

      res.json({
        success: true,

        count:
          data.length,

        data
      });

    } catch (error) {
      res.status(500).json({
        success: false,

        message:
          "Unable to load work-level data.",

        error:
          error.message
      });
    }
  }
);

// ============================================================
// WORK LEVEL ANALYTICS
// ============================================================

app.get(
  "/api/work-level/analytics",
  (req, res) => {
    try {
      const data =
        getActiveRiskData();

      const states = {};
      const categories = {};
      const statuses = {};
      const riskLevels = {};

      for (const row of data) {
        const state =
          cleanText(
            row.State ||
              row.STATE ||
              row.state
          ) ||
          "Unknown";

        const category =
          cleanText(
            row.Work_Type ||
              row.WORK_TYPE ||
              row.CATEGORY ||
              row.category ||
              row.work_type
          ) ||
          "Unknown";

        const status =
          cleanText(
            row.Status ||
              row.STATUS ||
              row.status
          ) ||
          "Unknown";

        const risk =
          cleanText(
            row.Risk_Level ||
              row.RISK_LEVEL ||
              row.risk_level
          ) ||
          "Unknown";

        states[state] =
          (states[state] || 0) + 1;

        categories[category] =
          (categories[category] || 0) + 1;

        statuses[status] =
          (statuses[status] || 0) + 1;

        riskLevels[risk] =
          (riskLevels[risk] || 0) + 1;
      }

      res.json({
        success: true,

        totalWorks:
          data.length,

        byState:
          Object.entries(states)
            .map(
              ([state, count]) => ({
                state,
                count
              })
            )
            .sort(
              (a, b) =>
                b.count - a.count
            ),

        byCategory:
          Object.entries(categories)
            .map(
              ([category, count]) => ({
                category,
                count
              })
            )
            .sort(
              (a, b) =>
                b.count - a.count
            ),

        byStatus:
          Object.entries(statuses)
            .map(
              ([status, count]) => ({
                status,
                count
              })
            )
            .sort(
              (a, b) =>
                b.count - a.count
            ),

        byRisk:
          Object.entries(riskLevels)
            .map(
              ([risk, count]) => ({
                risk,
                count
              })
            )
            .sort(
              (a, b) =>
                b.count - a.count
            )
      });

    } catch (error) {
      res.status(500).json({
        success: false,

        message:
          "Unable to generate analytics.",

        error:
          error.message
      });
    }
  }
);

// ============================================================
// ALLOCATION DATA
// ============================================================

app.get(
  "/api/allocation",
  (req, res) => {
    try {
      const data =
        getAllocationData();

      res.json({
        success: true,

        datasetType:
          activeDatasetType,

        count:
          data.length,

        data
      });

    } catch (error) {
      res.status(500).json({
        success: false,

        message:
          "Unable to load allocation data.",

        error:
          error.message
      });
    }
  }
);

// ============================================================
// ALLOCATION ANALYTICS
// ============================================================

app.get(
  "/api/allocation/analytics",
  (req, res) => {
    try {
      const rows =
        getAllocationData();

      const stateAmounts = {};
      const constituencyAmounts = {};

      let totalAllocation = 0;

      for (const row of rows) {
        const state =
          cleanText(
            row.state
          ) ||
          "Unknown";

        const constituency =
          cleanText(
            row.constituency
          ) ||
          "Unknown";

        const amount =
          parseNumber(
            row.allocated_amount
          );

        stateAmounts[state] =
          (stateAmounts[state] || 0) +
          amount;

        constituencyAmounts[
          constituency
        ] =
          (
            constituencyAmounts[
              constituency
            ] || 0
          ) +
          amount;

        totalAllocation +=
          amount;
      }

      res.json({
        success: true,

        datasetType:
          activeDatasetType,

        data: {
          totalRows:
            rows.length,

          totalAllocation,

          byState:
            Object.entries(
              stateAmounts
            )
              .map(
                ([state, amount]) => ({
                  state,
                  amount
                })
              )
              .sort(
                (a, b) =>
                  b.amount - a.amount
              ),

          byConstituency:
            Object.entries(
              constituencyAmounts
            )
              .map(
                ([constituency, amount]) => ({
                  constituency,
                  amount
                })
              )
              .sort(
                (a, b) =>
                  b.amount - a.amount
              )
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,

        message:
          "Unable to generate allocation analytics.",

        error:
          error.message
      });
    }
  }
);

// ============================================================
// PROJECT DATA
// ============================================================

app.get(
  "/api/projects",
  (req, res) => {
    try {
      const rawData =
        getProjectData();

      const data =
        enrichProjectData(
          rawData
        );

      res.json({
        success: true,

        datasetType:
          activeDatasetType,

        count:
          data.length,

        data
      });

    } catch (error) {
      res.status(500).json({
        success: false,

        message:
          "Unable to load project data.",

        error:
          error.message
      });
    }
  }
);

// ============================================================
// MAIN UPLOAD API
// ============================================================

app.post(
  "/api/upload",
  upload.single("file"),
  async (req, res) => {
    let temporaryFile = null;

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,

          message:
            "Please select a CSV, XLSX or XLS file."
        });
      }

      temporaryFile =
        req.file.path;

      console.log(
        "\n========================================"
      );

      console.log(
        "MPLADS FILE UPLOAD"
      );

      console.log(
        "File:",
        req.file.originalname
      );

      console.log(
        "========================================"
      );

      // --------------------------------------------------------
      // READ
      // --------------------------------------------------------

      const rows =
        readUploadedFile(
          temporaryFile
        );

      if (
        !rows ||
        rows.length === 0
      ) {
        throw new Error(
          "Uploaded file contains no usable rows."
        );
      }

      console.log(
        "Rows:",
        rows.length
      );

      console.log(
        "Columns:",
        Object.keys(rows[0])
      );

      // --------------------------------------------------------
      // DETECT
      // --------------------------------------------------------

      const datasetType =
        detectDatasetType(
          rows
        );

      console.log(
        "Detected dataset:",
        datasetType
      );

      // ======================================================
      // WORK LEVEL
      // ======================================================

      if (
        datasetType ===
        "MPLADS_WORK_LEVEL"
      ) {
        if (pipelineRunning) {
          return res.status(409).json({
            success: false,

            message:
              "Another AI pipeline is already running. Please wait for it to finish."
          });
        }

        const workData =
          buildWorkLevelData(
            rows
          );

        if (
          workData.length === 0
        ) {
          throw new Error(
            "Could not create work-level dataset."
          );
        }

        writeCSV(
          WORK_LEVEL_FILE,
          workData
        );

        activeDatasetType =
          "MPLADS_WORK_LEVEL";

        activeDatasetMeta = {
          datasetType:
            "MPLADS_WORK_LEVEL",

          fileName:
            req.file.originalname,

          rows:
            workData.length,

          uploadedAt:
            new Date().toISOString()
        };

        console.log(
          "Saved work-level input:",
          workData.length
        );

        startAIPipeline();

        return res.json({
          success: true,

          uploaded: true,

          datasetType:
            "MPLADS_WORK_LEVEL",

          rows:
            workData.length,

          message:
            "MPLADS work-level dataset uploaded successfully. AI analysis started.",

          pipeline: {
            status: "RUNNING",

            endpoint:
              "/api/pipeline/status"
          },

          activeDataset:
            activeDatasetMeta
        });
      }

      // ======================================================
      // ALLOCATION
      // ======================================================

      if (
        datasetType ===
        "ALLOCATION"
      ) {
        if (pipelineRunning) {
          return res.status(409).json({
            success: false,

            message:
              "Another AI pipeline is already running. Please wait for it to finish."
          });
        }

        const allocationData =
          buildAllocationData(
            rows
          );

        if (
          allocationData.length === 0
        ) {
          throw new Error(
            "Could not create allocation dataset."
          );
        }

        writeCSV(
          ALLOCATION_FILE,
          allocationData
        );

        const allocationAIData =
          allocationData.map(
            (row, index) => ({
              work_id:
                "ALLOC-" +
                String(index + 1)
                  .padStart(6, "0"),

              mp_name:
                row.mp || "",

              work:
                "MPLADS Allocation Record",

              category:
                "Allocation",

              state:
                row.state || "",

              constituency:
                row.constituency || "",

              district: "",
              city: "",
              ward: "",
              block: "",
              village: "",
              recommended_date: "",

              allocation_amount:
                row.allocated_amount || 0,

              ida_approval: "",
              status: "",
              house: ""
            })
          );

        writeCSV(
          WORK_LEVEL_FILE,
          allocationAIData
        );

        activeDatasetType =
          "MPLADS_WORK_LEVEL";

        activeDatasetMeta = {
          datasetType:
            "ALLOCATION_AI",

          fileName:
            req.file.originalname,

          rows:
            allocationData.length,

          uploadedAt:
            new Date().toISOString()
        };

        startAIPipeline();

        return res.json({
          success: true,

          uploaded: true,

          datasetType:
            "ALLOCATION",

          rows:
            allocationData.length,

          message:
            "Allocation dataset uploaded successfully. AI anomaly and risk analysis started.",

          pipeline: {
            status: "RUNNING",

            endpoint:
              "/api/pipeline/status"
          },

          activeDataset:
            activeDatasetMeta
        });
      }

      // ======================================================
      // PROJECT
      // ======================================================

      if (
        datasetType ===
        "PROJECT"
      ) {
        if (pipelineRunning) {
          return res.status(409).json({
            success: false,

            message:
              "Another AI pipeline is already running. Please wait for it to finish."
          });
        }

        // IMPORTANT:
        // Project datasets use direct project-risk enrichment.
        // They do NOT go through the MPLADS work-level Python
        // pipeline because project data has different columns.

        const enrichedData =
          enrichProjectData(
            rows
          );

        if (
          enrichedData.length === 0
        ) {
          throw new Error(
            "Could not create project risk dataset."
          );
        }

        // Save enriched project data
        writeCSV(
          PROJECT_FILE,
          enrichedData
        );

        activeDatasetType =
          "PROJECT";

        activeDatasetMeta = {
          datasetType:
            "PROJECT",

          fileName:
            req.file.originalname,

          rows:
            enrichedData.length,

          uploadedAt:
            new Date().toISOString()
        };

        const summary =
          calculateRiskSummary(
            enrichedData
          );

        // Project upload itself is a completed
        // risk-analysis operation.
        pipelineStatus = {
          status: "COMPLETED",

          step:
            "PROJECT_RISK_SCORING",

          progress: 100,

          message:
            "Project risk analysis completed successfully.",

          startedAt:
            new Date().toISOString(),

          finishedAt:
            new Date().toISOString(),

          error: null,

          result: {
            rows:
              enrichedData.length,

            summary
          }
        };

        console.log(
          "Saved enriched project risk data:",
          enrichedData.length
        );

        console.log(
          "Project risk summary:",
          summary
        );

        return res.json({
          success: true,

          uploaded: true,

          datasetType:
            "PROJECT",

          rows:
            enrichedData.length,

          message:
            "Project dataset uploaded successfully. Risk analysis completed.",

          pipeline: {
            status:
              "COMPLETED",

            endpoint:
              "/api/pipeline/status"
          },

          activeDataset:
            activeDatasetMeta,

          summary
        });
      }

      // ======================================================
      // UNKNOWN
      // ======================================================

      return res.status(400).json({
        success: false,

        message:
          "This file could not be identified as an MPLADS dataset.",

        rows:
          rows.length,

        columns:
          Object.keys(
            rows[0]
          ),

        expectedExamples: [
          "MP NAME",
          "WORK",
          "CATEGORY",
          "STATE",
          "CONSTITUENCY",
          "RECOMMENDED DATE",
          "ALLOCATION AMOUNT",
          "STATUS"
        ]
      });

    } catch (error) {
      console.error(
        "\nUPLOAD ERROR:",
        error.message
      );

      return res.status(400).json({
        success: false,

        message:
          error.message ||
          "File upload failed.",

        error:
          error.message
      });

    } finally {
      if (
        temporaryFile &&
        fs.existsSync(
          temporaryFile
        )
      ) {
        try {
          fs.unlinkSync(
            temporaryFile
          );
        } catch (error) {
          console.error(
            "Temporary file cleanup error:",
            error.message
          );
        }
      }
    }
  }
);

// ============================================================
// ERROR HANDLER
// ============================================================

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "Server error:",
      error.message
    );

    if (
      error instanceof
      multer.MulterError
    ) {
      if (
        error.code ===
        "LIMIT_FILE_SIZE"
      ) {
        return res.status(400).json({
          success: false,

          message:
            "File size cannot exceed 50 MB."
        });
      }

      return res.status(400).json({
        success: false,

        message:
          error.message
      });
    }

    res.status(400).json({
      success: false,

      message:
        error.message ||
        "Something went wrong."
    });
  }
);

// ============================================================
// SERVER
// ============================================================

const PORT = 5000;

app.listen(
  PORT,
  () => {
    console.log(
      "\n========================================"
    );

    console.log(
      "MPLADS RISK INTELLIGENCE SYSTEM"
    );

    console.log(
      "Backend running on:"
    );

    console.log(
      "http://localhost:" +
        PORT
    );

    console.log(
      "----------------------------------------"
    );

    console.log(
      "Upload:"
    );

    console.log(
      "http://localhost:" +
        PORT +
        "/api/upload"
    );

    console.log(
      "Dashboard:"
    );

    console.log(
      "http://localhost:" +
        PORT +
        "/api/dashboard"
    );

    console.log(
      "Pipeline:"
    );

    console.log(
      "http://localhost:" +
        PORT +
        "/api/pipeline/status"
    );

    console.log(
      "========================================\n"
    );
  }
);

