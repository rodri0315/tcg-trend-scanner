import type { NextRequest } from 'next/server';

import { GET as runDailyScanCron } from '../daily-scan/route';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest): Promise<Response> {
  return runDailyScanCron(request);
}
