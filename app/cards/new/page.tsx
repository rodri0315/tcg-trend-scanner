import Link from 'next/link';

import { DashboardShell } from '../../../components/dashboard-shell';
import { CardForm } from './card-form';

export const dynamic = 'force-dynamic';

export default function NewCardPage() {
  return (
    <DashboardShell>
      <section className="heroPanel section--narrow">
        <div>
          <p className="eyebrow">Watchlist management</p>
          <h2>Add a new card to the tracked universe.</h2>
          <p className="lede">
            This writes directly to the watchlist table in Postgres. Use one row per language and market segment so
            raw and graded behavior stay separate.
          </p>
        </div>
        <div className="heroActions">
          <Link href="/cards" className="textLink">
            Back to watchlist
          </Link>
        </div>
      </section>

      <section className="panel section--narrow">
        <div className="sectionHead">
          <div>
            <p className="eyebrow">New tracked card</p>
            <h3>Watchlist entry</h3>
          </div>
        </div>

        <CardForm />
      </section>
    </DashboardShell>
  );
}
