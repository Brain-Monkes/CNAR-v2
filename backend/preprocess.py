"""
Preprocessing script — run once before starting the backend.
Strips the raw CSV down to only 4G/5G towers with essential columns.
Reduces load time and memory usage significantly.

Usage:
    cd backend
    python preprocess.py
"""

import pandas as pd

INPUT  = "data/india-towers.csv"
OUTPUT = "data/india-towers-4g5g.csv"

df = pd.read_csv(INPUT)
print(f"Raw dataset: {len(df):,} towers")
print(df['radio'].value_counts())

df = df[df['radio'].isin(['4G', '5G'])][['radio', 'lat', 'long']]
df = df.dropna()
df.to_csv(OUTPUT, index=False)
print(f"\nDone. {len(df):,} 4G/5G towers saved to {OUTPUT}")
