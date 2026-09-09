import pandas as pd
import numpy as np
import os

np.random.seed(42)

n = 1000

states = [
    "Andhra Pradesh",
    "Telangana",
    "Karnataka",
    "Tamil Nadu",
    "Maharashtra",
    "Kerala"
]

work_types = [
    "Road",
    "School",
    "Hospital",
    "Drinking Water",
    "Community Hall",
    "Drainage"
]

# Approximate geographic boundaries for generating
# realistic project locations within each state.
state_bounds = {
    "Andhra Pradesh": {
        "lat_min": 12.6,
        "lat_max": 19.2,
        "lon_min": 76.7,
        "lon_max": 84.8
    },
    "Telangana": {
        "lat_min": 15.8,
        "lat_max": 19.9,
        "lon_min": 77.2,
        "lon_max": 81.0
    },
    "Karnataka": {
        "lat_min": 11.5,
        "lat_max": 18.5,
        "lon_min": 74.0,
        "lon_max": 78.6
    },
    "Tamil Nadu": {
        "lat_min": 8.0,
        "lat_max": 13.6,
        "lon_min": 76.2,
        "lon_max": 80.4
    },
    "Maharashtra": {
        "lat_min": 15.6,
        "lat_max": 22.1,
        "lon_min": 72.6,
        "lon_max": 80.9
    },
    "Kerala": {
        "lat_min": 8.2,
        "lat_max": 12.8,
        "lon_min": 74.8,
        "lon_max": 77.4
    }
}

# Generate states first so coordinates can match each state.
state_values = np.random.choice(states, n)

# Generate one coordinate pair for every project.
latitudes = []
longitudes = []

for state in state_values:

    bounds = state_bounds[state]

    latitude = np.random.uniform(
        bounds["lat_min"],
        bounds["lat_max"]
    )

    longitude = np.random.uniform(
        bounds["lon_min"],
        bounds["lon_max"]
    )

    latitudes.append(round(latitude, 6))
    longitudes.append(round(longitude, 6))


df = pd.DataFrame({
    "Work_ID": [
        f"MPLADS_{i:04d}"
        for i in range(1, n + 1)
    ],

    "State": state_values,

    "District": [
        f"District_{np.random.randint(1, 30)}"
        for _ in range(n)
    ],

    "Work_Type": np.random.choice(
        work_types,
        n
    ),

    "Sanction_Amount": np.random.randint(
        50000,
        5000000,
        n
    ),

    "Estimated_Cost": np.random.randint(
        50000,
        5000000,
        n
    ),

    "Expenditure": np.random.randint(
        10000,
        5000000,
        n
    ),

    "Progress_Percentage": np.random.randint(
        0,
        101,
        n
    ),

    "Delay_Days": np.random.randint(
        0,
        500,
        n
    ),

    "Implementing_Agency": [
        f"Agency_{np.random.randint(1, 20)}"
        for _ in range(n)
    ],

    "Status": np.random.choice(
        [
            "Not Started",
            "In Progress",
            "Completed",
            "Delayed"
        ],
        n
    ),

    # New fields required for Map View
    "Latitude": latitudes,
    "Longitude": longitudes
})


# Save inside ml/data
output_dir = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "data"
)

os.makedirs(
    output_dir,
    exist_ok=True
)


output_file = os.path.join(
    output_dir,
    "mplads_sample_data.csv"
)


df.to_csv(
    output_file,
    index=False
)


print("✅ Dataset created successfully!")
print(f"📊 Records: {len(df)}")
print(f"📍 Projects with coordinates: {len(df)}")
print(f"📁 File: {output_file}")