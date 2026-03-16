interface MetricCardProps {
  label: string;
  value: string;
  help?: string;
  tone?: 'neutral' | 'accent' | 'warning';
}

export function MetricCard({ label, value, help, tone = 'neutral' }: MetricCardProps) {
  return (
    <article className={`metricCard metricCard--${tone}`}>
      <p>
        <span className="metricLabel">{label}</span>
        {help ? (
          <span className="infoHint" tabIndex={0} aria-label={`${label}: ${help}`} data-tooltip={help}>
            ?
          </span>
        ) : null}
      </p>
      <strong>{value}</strong>
    </article>
  );
}
