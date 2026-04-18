"""
Preprocessing script — run once before starting the backend.
Strips the raw CSV to 3G/4G/5G towers with essential columns.

Usage:
    cd backend
    python preprocess.py
"""

import pandas as pd

INPUT  = "data/india-towers.csv"
OUTPUT = "data/india-towers-processed.csv"

df = pd.read_csv(INPUT)
print(f"Raw dataset: {len(df):,} towers")
print(df['radio'].value_counts())

df = df[df['radio'].isin(['3G', '4G', '5G'])][['radio', 'lat', 'long', 'operator']]
df = df.dropna(subset=['lat', 'long'])
df['operator'] = df['operator'].fillna('Unknown')
df.to_csv(OUTPUT, index=False)
print(f"\nDone. {len(df):,} 3G/4G/5G towers saved to {OUTPUT}")
print(df['operator'].value_counts())
