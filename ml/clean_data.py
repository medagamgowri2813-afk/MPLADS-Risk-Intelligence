import pandas as pd
import os

input_file = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "data",
    "mplads_sample_data.csv"
)

output_dir = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "outputs"
)

os.makedirs(output_dir, exist_ok=True)

output_file = os.path.join(
    output_dir,
    "mplads_cleaned_data.csv"
)

# Load dataset
df = pd.read_csv(input_file)

print("Original records:", len(df))

# Remove duplicate records
df = df.drop_duplicates()

# Convert numeric columns
numeric_columns = [
    "Sanction_Amount",
    "Estimated_Cost",
    "Expenditure",
    "Progress_Percentage",
    "Delay_Days"
]

for column in numeric_columns:
    df[column] = pd.to_numeric(df[column], errors="coerce")

# Fill missing numeric values with median
for column in numeric_columns:
    df[column] = df[column].fillna(df[column].median())

# Remove invalid negative values
df["Sanction_Amount"] = df["Sanction_Amount"].clip(lower=0)
df["Estimated_Cost"] = df["Estimated_Cost"].clip(lower=0)
df["Expenditure"] = df["Expenditure"].clip(lower=0)
df["Progress_Percentage"] = df["Progress_Percentage"].clip(0, 100)
df["Delay_Days"] = df["Delay_Days"].clip(lower=0)

# Save cleaned dataset
df.to_csv(output_file, index=False)

print("✅ Data cleaning completed!")
print("📊 Clean records:", len(df))
print(f"📁 Saved at: {output_file}")