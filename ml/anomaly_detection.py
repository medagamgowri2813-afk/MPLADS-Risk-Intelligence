import pandas as pd
import numpy as np
import os
from sklearn.ensemble import IsolationForest


# =========================================================
# FILE PATHS
# =========================================================

base_dir = os.path.dirname(os.path.abspath(__file__))

input_file = os.path.join(
    base_dir,
    "data",
    "mplads_features.csv"
)

output_file = os.path.join(
    base_dir,
    "data",
    "mplads_anomaly_results.csv"
)


# =========================================================
# LOAD FEATURE DATA
# =========================================================

print("=" * 60)
print("MPLADS AI ANOMALY DETECTION")
print("=" * 60)

print("\nLoading feature dataset:")
print(input_file)

if not os.path.exists(input_file):
    raise FileNotFoundError(
        f"Feature dataset not found: {input_file}"
    )

df = pd.read_csv(input_file)

print(f"Rows loaded: {len(df)}")
print(f"Columns available: {len(df.columns)}")


# =========================================================
# AI FEATURES
# =========================================================

candidate_features = [
    "allocation_amount",
    "allocation_amount_ratio",
    "allocation_amount_log",
    "days_since_recommendation",
    "approval_pending",
    "unsanctioned",
    "state_work_count",
    "constituency_work_count",
    "category_work_count",
    "work_description_length",
    "location_completeness",
    "approval_status_risk",
    "old_pending_signal"
]


# =========================================================
# FIND AVAILABLE FEATURES
# =========================================================

features = [
    column
    for column in candidate_features
    if column in df.columns
]


if len(features) == 0:
    raise ValueError(
        "No valid AI features found in the dataset."
    )


print("\nFeatures used by AI:")

for feature in features:
    print(f"  OK {feature}")


# =========================================================
# PREPARE AI INPUT
# =========================================================

X = df[features].copy()

for column in X.columns:

    X[column] = pd.to_numeric(
        X[column],
        errors="coerce"
    )


# Replace infinity
X = X.replace(
    [np.inf, -np.inf],
    np.nan
)


# Fill missing values
X = X.fillna(0)


# =========================================================
# CHECK DATA
# =========================================================

print("\nChecking AI input...")

print(f"Feature rows: {len(X)}")
print(f"Feature columns: {len(X.columns)}")

if len(X) < 2:
    raise ValueError(
        "At least 2 records are required for anomaly detection."
    )


# =========================================================
# ISOLATION FOREST
# =========================================================

print("\nTraining Isolation Forest...")

# For small datasets use a small contamination value.
# For larger datasets use 5%.

if len(df) < 20:
    contamination = 0.10
else:
    contamination = 0.05


model = IsolationForest(
    n_estimators=200,
    contamination=contamination,
    random_state=42,
    n_jobs=-1
)


model.fit(X)


# =========================================================
# ANOMALY PREDICTION
# =========================================================

print("Running anomaly prediction...")

df["Anomaly"] = model.predict(X)

# -1 = anomaly
#  1 = normal

df["Anomaly_Status"] = df["Anomaly"].map(
    {
        -1: "Anomaly",
        1: "Normal"
    }
)


# =========================================================
# ANOMALY SCORE
# =========================================================

df["Anomaly_Score"] = model.decision_function(X)


# =========================================================
# CONVERT SCORE TO 0-100
# =========================================================

raw_scores = df["Anomaly_Score"]

score_min = raw_scores.min()
score_max = raw_scores.max()


if score_max != score_min:

    df["Anomaly_Risk_Score"] = (
        (score_max - raw_scores)
        / (score_max - score_min)
    ) * 100

else:

    # If all values are identical,
    # give a neutral score instead of zero.
    df["Anomaly_Risk_Score"] = 50


df["Anomaly_Risk_Score"] = (
    df["Anomaly_Risk_Score"]
    .clip(0, 100)
    .round(2)
)


# =========================================================
# SAVE RESULTS
# =========================================================

os.makedirs(
    os.path.dirname(output_file),
    exist_ok=True
)

df.to_csv(
    output_file,
    index=False
)


# =========================================================
# SUMMARY
# =========================================================

anomaly_count = int(
    (df["Anomaly_Status"] == "Anomaly").sum()
)

normal_count = int(
    (df["Anomaly_Status"] == "Normal").sum()
)


print("\n" + "=" * 60)
print("AI ANOMALY DETECTION COMPLETED")
print("=" * 60)

print(f"\nTotal records: {len(df)}")

print(
    f"Anomalies detected: {anomaly_count}"
)

print(
    f"Normal records: {normal_count}"
)

if len(df) > 0:

    print(
        f"Anomaly percentage: "
        f"{(anomaly_count / len(df) * 100):.2f}%"
    )

print("\nResults saved at:")
print(output_file)

print("\n" + "=" * 60)