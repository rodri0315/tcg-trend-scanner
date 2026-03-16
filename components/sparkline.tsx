interface SparklineProps {
  values: Array<number | null>;
  stroke?: string;
}

export function Sparkline({ values, stroke = '#d76442' }: SparklineProps) {
  const points = values.filter((value): value is number => value !== null);
  if (points.length < 2) {
    return <div className="sparkline sparkline--empty">Not enough history yet</div>;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const width = 240;
  const height = 68;

  const path = values
    .map((value, index) => {
      if (value === null) {
        return null;
      }

      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .filter((segment): segment is string => segment !== null)
    .join(' ');

  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Trend sparkline">
      <path d={path} fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
