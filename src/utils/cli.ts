export interface DailyCliArgs {
  snapshotDate: string;
  offline: boolean;
  fixturePath: string;
}

export function parseDailyCliArgs(argv: string[]): DailyCliArgs {
  let snapshotDate = new Date().toISOString().slice(0, 10);
  let offline = false;
  let fixturePath = 'seed/mock_ebay_daily.json';

  for (const argument of argv) {
    if (argument.startsWith('--date=')) {
      const value = argument.slice('--date='.length);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new Error(`Invalid --date value "${value}". Use YYYY-MM-DD.`);
      }
      snapshotDate = value;
      continue;
    }

    if (argument === '--offline') {
      offline = true;
      continue;
    }

    if (argument.startsWith('--fixture=')) {
      fixturePath = argument.slice('--fixture='.length);
      continue;
    }
  }

  return {
    snapshotDate,
    offline,
    fixturePath,
  };
}
