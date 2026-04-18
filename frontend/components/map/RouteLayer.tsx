/**
 * Renders a route as multiple colored Polyline segments.
 * Each segment between consecutive route points is colored by signal score.
 * This creates a visual gradient showing coverage quality along the path.
 *
 * Algorithm:
 *   - geometry.coordinates: [lon, lat][] — N points
 *   - point_scores: number[] — M scores (M = downsampled route points)
 *   - Map point_scores index to geometry index via: Math.floor(i * N / M)
 *   - For each consecutive pair of geometry coords, pick the score of the
 *     nearest downsampled index and color accordingly.
 */
'use client';
import { Polyline } from 'react-leaflet';
import { RouteObject } from '@/types';
import { getSignalColor } from '@/lib/signal';

interface Props {
  route: RouteObject;
  isSelected: boolean;
  onClick: () => void;
}

export function RouteLayer({ route, isSelected, onClick }: Props) {
  const coords = route.geometry.coordinates; // [lon, lat][]
  const scores = route.point_scores;
  const N = coords.length;
  const M = scores.length;

  // Build segments: each segment is 2 consecutive points with a color
  const segments: { positions: [number, number][]; color: string }[] = [];

  for (let i = 0; i < N - 1; i++) {
    const scoreIdx = Math.min(Math.floor((i / N) * M), M - 1);
    const color = isSelected ? getSignalColor(scores[scoreIdx]) : '#4a5568';
    // Leaflet expects [lat, lon]
    segments.push({
      positions: [
        [coords[i][1], coords[i][0]],
        [coords[i + 1][1], coords[i + 1][0]],
      ],
      color,
    });
  }

  return (
    <>
      {segments.map((seg, i) => (
        <Polyline
          key={i}
          positions={seg.positions}
          pathOptions={{
            color: seg.color,
            weight: isSelected ? 5 : 3,
            opacity: isSelected ? 0.95 : 0.3,
          }}
          eventHandlers={{ click: onClick }}
        />
      ))}
    </>
  );
}
