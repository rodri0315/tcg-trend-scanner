export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function todayInNewYork(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function parseCliDateArg(): string {
  const dateArg = process.argv.find((argument) => argument.startsWith('--date='));
  if (!dateArg) {
    return todayUtc();
  }

  const value = dateArg.slice('--date='.length);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid --date value "${value}". Use YYYY-MM-DD.`);
  }

  return value;
}
