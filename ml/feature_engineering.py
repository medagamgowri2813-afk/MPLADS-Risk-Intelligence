import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime


# ---------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

INPUT_FILE = DATA_DIR / "uploaded_mplads_work_level.csv"
OUTPUT_FILE = DATA_DIR / "mplads_features.csv"


# ---------------------------------------------------------
# COLUMN NORMALIZATION
# ---------------------------------------------------------

def normalize_column_name(column):
    """
    Convert different column naming styles into a standard format.
    This helps the pipeline work with future datasets too.
    """

    column = str(column).strip().upper()

    replacements = {
        "MP NAME": "mp_name",
        "MP": "mp_name",
        "MEMBER OF PARLIAMENT": "mp_name",

        "WORK": "work",
        "WORK DESCRIPTION": "work",
        "WORK NAME": "work",

        "CATEGORY": "category",
        "WORK CATEGORY": "category",

        "STATE": "state",

        "CONSTITUENCY": "constituency",

        "IDA": "ida",

        "CITY": "city",
        "WARD": "ward",
        "BLOCK": "block",
        "VILLAGE": "village",

        "RECOMMENDED DATE": "recommended_date",
        "RECOMMENDATION DATE": "recommended_date",

        "ALLOCATION AMOUNT": "allocation_amount",
        "ALLOCATION AMOUNT (₹)": "allocation_amount",
        "ALLOCATED AMOUNT": "allocation_amount",

        "IDA APPROVAL": "ida_approval",
        "APPROVAL": "ida_approval",

        "STATUS": "status",

        "HOUSE": "house",
    }

    return replacements.get(column, column.lower().replace(" ", "_"))


# ---------------------------------------------------------
# CLEAN AMOUNT
# ---------------------------------------------------------

def clean_amount(value):
    """
    Convert allocation amount into numeric format.
    Handles commas, rupee symbols and blank values.
    """

    if pd.isna(value):
        return np.nan

    value = str(value).strip()

    value = (
        value
        .replace(",", "")
        .replace("₹", "")
        .replace("Rs.", "")
        .replace("Rs", "")
        .strip()
    )

    return pd.to_numeric(value, errors="coerce")


# ---------------------------------------------------------
# LOAD DATA
# ---------------------------------------------------------

def load_data():

    if not INPUT_FILE.exists():
        raise FileNotFoundError(
            f"Input dataset not found: {INPUT_FILE}"
        )

    print(f"Loading dataset: {INPUT_FILE}")

    df = pd.read_csv(
        INPUT_FILE,
        sep=None,
        engine="python"
    )

    print(f"Rows loaded: {len(df)}")
    print(f"Columns found: {len(df.columns)}")

    return df


# ---------------------------------------------------------
# STANDARDIZE COLUMNS
# ---------------------------------------------------------

def standardize_columns(df):

    df = df.copy()

    df.columns = [
        normalize_column_name(column)
        for column in df.columns
    ]

    print("\nStandardized columns:")

    for column in df.columns:
        print(f"  - {column}")

    return df


# ---------------------------------------------------------
# CLEAN DATA
# ---------------------------------------------------------

def clean_data(df):

    df = df.copy()

    # Remove completely empty rows
    df = df.dropna(how="all")

    # Remove duplicate rows
    before_duplicates = len(df)

    df = df.drop_duplicates()

    duplicates_removed = before_duplicates - len(df)

    print(f"\nDuplicate rows removed: {duplicates_removed}")

    # -----------------------------------------------------
    # TEXT COLUMNS
    # -----------------------------------------------------

    text_columns = [
        "mp_name",
        "work",
        "category",
        "state",
        "constituency",
        "ida",
        "city",
        "ward",
        "block",
        "village",
        "ida_approval",
        "status",
        "house",
    ]

    for column in text_columns:

        if column in df.columns:

            df[column] = (
                df[column]
                .fillna("Unknown")
                .astype(str)
                .str.strip()
            )

    # -----------------------------------------------------
    # ALLOCATION AMOUNT
    # -----------------------------------------------------

    if "allocation_amount" in df.columns:

        df["allocation_amount"] = (
            df["allocation_amount"]
            .apply(clean_amount)
        )

    # -----------------------------------------------------
    # RECOMMENDED DATE
    # -----------------------------------------------------

    if "recommended_date" in df.columns:

        df["recommended_date"] = pd.to_datetime(
            df["recommended_date"],
            errors="coerce"
        )

    return df


# ---------------------------------------------------------
# FEATURE ENGINEERING
# ---------------------------------------------------------

def create_features(df):

    df = df.copy()

    today = pd.Timestamp.today().normalize()

    # -----------------------------------------------------
    # 1. DAYS SINCE RECOMMENDATION
    # -----------------------------------------------------

    if "recommended_date" in df.columns:

        df["days_since_recommendation"] = (
            today - df["recommended_date"]
        ).dt.days

        df["days_since_recommendation"] = (
            df["days_since_recommendation"]
            .clip(lower=0)
        )

    else:

        df["days_since_recommendation"] = 0

    # -----------------------------------------------------
    # 2. APPROVAL PENDING
    # -----------------------------------------------------

    if "ida_approval" in df.columns:

        approval_text = (
            df["ida_approval"]
            .astype(str)
            .str.lower()
        )

        df["approval_pending"] = (
            approval_text
            .str.contains(
                "pending|action pending|not approved",
                regex=True,
                na=False
            )
            .astype(int)
        )

    else:

        df["approval_pending"] = 0

    # -----------------------------------------------------
    # 3. UNSANCTIONED FLAG
    # -----------------------------------------------------

    if "status" in df.columns:

        status_text = (
            df["status"]
            .astype(str)
            .str.lower()
        )

        df["unsanctioned"] = (
            status_text
            .str.contains(
                "unsanction",
                na=False
            )
            .astype(int)
        )

    else:

        df["unsanctioned"] = 0

    # -----------------------------------------------------
    # 4. STATE WORK COUNT
    # -----------------------------------------------------

    if "state" in df.columns:

        state_counts = df["state"].value_counts()

        df["state_work_count"] = (
            df["state"]
            .map(state_counts)
            .fillna(0)
        )

    else:

        df["state_work_count"] = 0

    # -----------------------------------------------------
    # 5. CONSTITUENCY WORK COUNT
    # -----------------------------------------------------

    if "constituency" in df.columns:

        constituency_counts = (
            df["constituency"]
            .value_counts()
        )

        df["constituency_work_count"] = (
            df["constituency"]
            .map(constituency_counts)
            .fillna(0)
        )

    else:

        df["constituency_work_count"] = 0

    # -----------------------------------------------------
    # 6. CATEGORY WORK COUNT
    # -----------------------------------------------------

    if "category" in df.columns:

        category_counts = (
            df["category"]
            .value_counts()
        )

        df["category_work_count"] = (
            df["category"]
            .map(category_counts)
            .fillna(0)
        )

    else:

        df["category_work_count"] = 0

    # -----------------------------------------------------
    # 7. ALLOCATION AMOUNT LOG
    # -----------------------------------------------------

    if "allocation_amount" in df.columns:

        df["allocation_amount"] = (
            pd.to_numeric(
                df["allocation_amount"],
                errors="coerce"
            )
        )

        median_amount = (
            df["allocation_amount"]
            .median()
        )

        if pd.isna(median_amount) or median_amount <= 0:
            median_amount = 1

        df["allocation_amount_ratio"] = (
            df["allocation_amount"]
            / median_amount
        )

        df["allocation_amount_log"] = np.log1p(
            df["allocation_amount"].clip(lower=0)
        )

    else:

        df["allocation_amount"] = 0
        df["allocation_amount_ratio"] = 0
        df["allocation_amount_log"] = 0

    # -----------------------------------------------------
    # 8. WORK DESCRIPTION LENGTH
    # -----------------------------------------------------

    if "work" in df.columns:

        df["work_description_length"] = (
            df["work"]
            .astype(str)
            .str.len()
        )

    else:

        df["work_description_length"] = 0

    # -----------------------------------------------------
    # 9. LOCATION COMPLETENESS
    # -----------------------------------------------------

    location_columns = [
        "city",
        "ward",
        "block",
        "village"
    ]

    available_location_columns = [
        column
        for column in location_columns
        if column in df.columns
    ]

    if available_location_columns:

        df["location_completeness"] = (
            df[available_location_columns]
            .replace(
                {
                    "Unknown": np.nan,
                    "": np.nan,
                    "nan": np.nan,
                }
            )
            .notna()
            .sum(axis=1)
        )

    else:

        df["location_completeness"] = 0

    # -----------------------------------------------------
    # 10. APPROVAL + STATUS RISK SIGNAL
    # -----------------------------------------------------

    df["approval_status_risk"] = (
        df["approval_pending"]
        + df["unsanctioned"]
    )

    # -----------------------------------------------------
    # 11. OLD PENDING WORK SIGNAL
    # -----------------------------------------------------

    df["old_pending_signal"] = (
        (
            df["days_since_recommendation"] > 180
        )
        & (
            (
                df["approval_pending"] == 1
            )
            | (
                df["unsanctioned"] == 1
            )
        )
    ).astype(int)

    return df


# ---------------------------------------------------------
# SELECT AI FEATURES
# ---------------------------------------------------------

def get_ai_features(df):

    feature_columns = [
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
        "old_pending_signal",
    ]

    available_features = [
        column
        for column in feature_columns
        if column in df.columns
    ]

    features = df[available_features].copy()

    # Convert everything to numeric
    for column in features.columns:

        features[column] = pd.to_numeric(
            features[column],
            errors="coerce"
        )

    # Replace infinity
    features = features.replace(
        [np.inf, -np.inf],
        np.nan
    )

    # Fill missing numeric values
    features = features.fillna(0)

    return features


# ---------------------------------------------------------
# SAVE OUTPUT
# ---------------------------------------------------------

def save_output(df):

    DATA_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    df.to_csv(
        OUTPUT_FILE,
        index=False
    )

    print(
        f"\nFeature dataset saved to:"
        f"\n{OUTPUT_FILE}"
    )


# ---------------------------------------------------------
# MAIN
# ---------------------------------------------------------

def main():

    print("=" * 60)
    print("MPLADS FEATURE ENGINEERING")
    print("=" * 60)

    # Load
    df = load_data()

    # Standardize columns
    df = standardize_columns(df)

    # Clean
    df = clean_data(df)

    # Create features
    df = create_features(df)

    # AI features
    ai_features = get_ai_features(df)

    # Add feature columns to original dataset
    for column in ai_features.columns:

        df[column] = ai_features[column]

    # Save
    save_output(df)

    print("\nFeature engineering completed successfully.")

    print("\nAI Features:")
    for column in ai_features.columns:
        print(f"  OK {column}")

    print("\nFinal dataset shape:")
    print(df.shape)


if __name__ == "__main__":
    main()