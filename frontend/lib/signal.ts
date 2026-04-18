export function getSignalColor(score: number): string {
  if (score >= 8) return '#4edea3';   // 5G
  if (score >= 5) return '#6e7fff';   // 4G
  return '#ff6b6b';                   // no signal
}

export function getConnectivityLabel(score: number): string {
  if (score >= 75) return 'Excellent';
  if (score >= 50) return 'Good';
  if (score >= 25) return 'Fair';
  return 'Poor';
}

export function getConnectivityColor(score: number): string {
  if (score >= 75) return '#4edea3';
  if (score >= 50) return '#6e7fff';
  return '#ff6b6b';
}
