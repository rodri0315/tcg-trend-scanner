interface MetricCardProps {
  label: string;
  value: string;
  tone?: 'neutral' | 'accent' | 'warning';
}

export function MetricCard({ label, value, tone = 'neutral' }: MetricCardProps) {
  return (
    <article className={`metricCard metricCard--${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}
