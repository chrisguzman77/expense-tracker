export type DonutSegment = { key: string | number; color: string; cents: number };

type Props = { segments: DonutSegment[]; size?: number; thickness?: number };

// Hand-written SVG: one circle per segment, drawn as a dash whose length is the
// segment's share of the circumference. Decorative (aria-hidden): the same
// numbers are always shown as text beside it. Shares come from integer cents.
export function Donut({ segments, size = 120, thickness = 18 }: Props) {
  const center = size / 2;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const positive = segments.filter((s) => s.cents > 0);
  const total = positive.reduce((sum, s) => sum + s.cents, 0);
  const arcs = positive.reduce<{ segment: DonutSegment; start: number; length: number }[]>((acc, segment) => {
    const prev = acc.at(-1);
    const start = prev ? prev.start + prev.length : 0;
    return [...acc, { segment, start, length: (segment.cents / total) * circumference }];
  }, []);

  return (
    <svg aria-hidden="true" width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={center} cy={center} r={radius} fill="none" strokeWidth={thickness} style={{ stroke: "var(--app-line)" }} />
      {arcs.map(({ segment, start, length }) => (
        <circle
          key={segment.key}
          data-segment=""
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          strokeDasharray={`${length} ${circumference - length}`}
          strokeDashoffset={-start}
          transform={`rotate(-90 ${center} ${center})`}
          style={{ stroke: segment.color }}
        />
      ))}
    </svg>
  );
}
