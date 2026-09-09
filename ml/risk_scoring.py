import pandas as pd
import numpy as np
import os


# =========================================================
# MPLADS AI RISK SCORING
# =========================================================
# Purpose:
# Convert anomaly + project risk indicators into a
# 0-100 risk score and LOW / MEDIUM / HIGH / CRITICAL level.
#
# IMPORTANT:
# Anomaly != Fraud
# Anomaly != Automatically Critical
#
# AI only identifies projects that may require verification.
# Final verification must be done by the concerned authority.
# =========================================================


# =========================================================
# FILE PATHS
# =========================================================

base_dir = os.path.dirname(os.path.abspath(__file__))

input_file = os.path.join(
    base_dir,
    "data",
    "mplads_anomaly_results.csv"
)

output_file = os.path.join(
    base_dir,
    "data",
    "mplads_final_risk_data.csv"
)


# =========================================================
# LOAD DATA
# =========================================================

print("=" * 65)
print("MPLADS AI RISK SCORING")
print("=" * 65)

print("\nLoading anomaly results:")
print(input_file)

if not os.path.exists(input_file):

    raise FileNotFoundError(
        f"Input file not found:\n{input_file}"
    )

df = pd.read_csv(input_file)

print(f"Rows loaded: {len(df)}")


# =========================================================
# HELPER FUNCTIONS
# =========================================================

def safe_number(value, default=0):

    try:

        number = float(value)

        if np.isnan(number) or np.isinf(number):

            return default

        return number

    except (ValueError, TypeError):

        return default


def clean_text(value):

    if value is None:

        return ""

    return str(value).strip().lower()


# =========================================================
# RISK CALCULATION
# =========================================================

def calculate_risk(row):

    score = 0

    reasons = []

    # =====================================================
    # 1. AI ANOMALY
    # =====================================================
    # Anomaly is an important signal but does NOT directly
    # make the project HIGH or CRITICAL.
    # =====================================================

    anomaly_status = clean_text(
        row.get("Anomaly_Status", "")
    )

    anomaly_score = safe_number(
        row.get("Anomaly_Risk_Score", 0)
    )

    anomaly_detected = (
        anomaly_status == "anomaly"
        or anomaly_status == "outlier"
        or anomaly_status == "yes"
        or anomaly_status == "true"
    )

    if anomaly_detected:

        score += 30

        reasons.append(
            "AI detected an unusual project pattern"
        )

    # =====================================================
    # 2. ANOMALY SEVERITY
    # =====================================================

    if anomaly_score >= 90:

        score += 20

        reasons.append(
            "Very high AI anomaly score"
        )

    elif anomaly_score >= 75:

        score += 15

        reasons.append(
            "High AI anomaly score"
        )

    elif anomaly_score >= 60:

        score += 8

        reasons.append(
            "Elevated AI anomaly score"
        )

    # =====================================================
    # 3. APPROVAL PENDING
    # =====================================================

    approval_pending = safe_number(
        row.get("approval_pending", 0)
    )

    if approval_pending == 1:

        score += 10

        reasons.append(
            "Approval is pending"
        )

    # =====================================================
    # 4. UNSANCTIONED WORK
    # =====================================================

    unsanctioned = safe_number(
        row.get("unsanctioned", 0)
    )

    if unsanctioned == 1:

        score += 15

        reasons.append(
            "Work is currently unsanctioned"
        )

    # =====================================================
    # 5. OLD PENDING WORK
    # =====================================================

    old_pending = safe_number(
        row.get("old_pending_signal", 0)
    )

    if old_pending == 1:

        score += 12

        reasons.append(
            "Work has remained pending for a long period"
        )

    # =====================================================
    # 6. RECOMMENDATION AGE
    # =====================================================

    days_since_recommendation = safe_number(
        row.get(
            "days_since_recommendation",
            0
        )
    )

    if days_since_recommendation > 730:

        score += 12

        reasons.append(
            "Work recommendation is more than two years old"
        )

    elif days_since_recommendation > 365:

        score += 8

        reasons.append(
            "Work recommendation is more than one year old"
        )

    elif days_since_recommendation > 180:

        score += 4

        reasons.append(
            "Work recommendation is relatively old"
        )

    # =====================================================
    # 7. UNUSUAL ALLOCATION AMOUNT
    # =====================================================

    allocation_ratio = safe_number(
        row.get(
            "allocation_amount_ratio",
            0
        )
    )

    if allocation_ratio >= 4:

        score += 15

        reasons.append(
            "Allocation amount is significantly higher than the dataset median"
        )

    elif allocation_ratio >= 3:

        score += 10

        reasons.append(
            "Allocation amount is unusually high compared with the dataset median"
        )

    elif allocation_ratio >= 2:

        score += 5

        reasons.append(
            "Allocation amount is higher than the typical dataset value"
        )

    # =====================================================
    # 8. CONSTITUENCY CONCENTRATION
    # =====================================================

    constituency_count = safe_number(
        row.get(
            "constituency_work_count",
            0
        )
    )

    if constituency_count >= 1000:

        score += 8

        reasons.append(
            "Very high concentration of works in this constituency"
        )

    elif constituency_count >= 500:

        score += 4

        reasons.append(
            "High concentration of works in this constituency"
        )

    # =====================================================
    # 9. STATE CONCENTRATION
    # =====================================================

    state_count = safe_number(
        row.get(
            "state_work_count",
            0
        )
    )

    if state_count >= 10000:

        score += 8

        reasons.append(
            "Very high concentration of works in this state"
        )

    elif state_count >= 5000:

        score += 4

        reasons.append(
            "High concentration of works in this state"
        )

    # =====================================================
    # 10. PROGRESS / EXPENDITURE MISMATCH
    # =====================================================
    # This is useful for MPLADS monitoring.
    #
    # Example:
    # Very high expenditure + very low progress
    # can be a useful verification signal.
    # =====================================================

    progress = safe_number(
        row.get(
            "Progress",
            row.get(
                "progress",
                row.get(
                    "progress_percent",
                    0
                )
            )
        )
    )

    expenditure = safe_number(
        row.get(
            "Expenditure",
            row.get(
                "expenditure",
                row.get(
                    "expenditure_amount",
                    0
                )
            )
        )
    )

    sanctioned_amount = safe_number(
        row.get(
            "Sanction_Amount",
            row.get(
                "sanction_amount",
                row.get(
                    "sanctioned_amount",
                    row.get(
                        "Estimated_Cost",
                        row.get(
                            "estimated_cost",
                            0
                        )
                    )
                )
            )
        )
    )

    progress = max(
        0,
        min(100, progress)
    )

    if (
        sanctioned_amount > 0
        and expenditure > 0
    ):

        expenditure_ratio = (
            expenditure /
            sanctioned_amount
        )

        if (
            expenditure_ratio >= 0.90
            and progress < 50
        ):

            score += 15

            reasons.append(
                "High expenditure compared with reported project progress"
            )

        elif (
            expenditure_ratio >= 0.75
            and progress < 40
        ):

            score += 10

            reasons.append(
                "Expenditure is relatively high compared with project progress"
            )

    # =====================================================
    # LIMIT SCORE
    # =====================================================

    score = int(
        max(
            0,
            min(
                round(score),
                100
            )
        )
    )

    # =====================================================
    # RISK LEVEL
    # =====================================================
    #
    # LOW       : 0 - 34
    # MEDIUM    : 35 - 64
    # HIGH      : 65 - 84
    # CRITICAL  : 85 - 100
    #
    # This prevents an anomaly alone from becoming Critical.
    # =====================================================

    if score >= 85:

        risk_level = "CRITICAL"

    elif score >= 65:

        risk_level = "HIGH"

    elif score >= 35:

        risk_level = "MEDIUM"

    else:

        risk_level = "LOW"

    # =====================================================
    # RISK REASONS
    # =====================================================

    if reasons:

        risk_reasons = "; ".join(
            reasons
        )

    else:

        risk_reasons = (
            "No major risk indicators detected"
        )

    # =====================================================
    # RETURN
    # =====================================================

    return pd.Series(
        [
            score,
            risk_level,
            risk_reasons
        ]
    )


# =========================================================
# APPLY RISK SCORING
# =========================================================

print("\nCalculating risk scores...")

df[
    [
        "Risk_Score",
        "Risk_Level",
        "Risk_Reasons"
    ]
] = df.apply(
    calculate_risk,
    axis=1
)


# =========================================================
# SAVE FINAL DATA
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

print("\n" + "=" * 65)
print("RISK SCORING COMPLETED")
print("=" * 65)

print(
    f"\nTotal records: {len(df)}"
)

print("\nRisk distribution:")

risk_distribution = (
    df["Risk_Level"]
    .value_counts()
)

for level in [
    "CRITICAL",
    "HIGH",
    "MEDIUM",
    "LOW"
]:

    count = risk_distribution.get(
        level,
        0
    )

    print(
        f"  {level:<10}: {count}"
    )


# =========================================================
# ANOMALY SUMMARY
# =========================================================

print("\nAI anomaly summary:")

if "Anomaly_Status" in df.columns:

    anomaly_counts = (
        df["Anomaly_Status"]
        .astype(str)
        .str.lower()
        .value_counts()
    )

    for status, count in anomaly_counts.items():

        print(
            f"  {status:<15}: {count}"
        )


# =========================================================
# AVERAGE RISK
# =========================================================

if len(df) > 0:

    average_risk = (
        df["Risk_Score"]
        .mean()
    )

    print(
        f"\nAverage risk score: "
        f"{average_risk:.2f}"
    )


# =========================================================
# OUTPUT
# =========================================================

print(
    f"\nFinal file:"
    f"\n{output_file}"
)

print("\n" + "=" * 65)