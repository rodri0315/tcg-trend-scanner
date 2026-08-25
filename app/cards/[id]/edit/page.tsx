import Link from 'next/link';
import { notFound } from 'next/navigation';

import { DashboardShell } from '../../../../components/dashboard-shell';
import { getCardById } from '../../../../src/services/cards';
import { CardForm } from '../../new/card-form';
import { updateCardAction } from './actions';

export const dynamic = 'force-dynamic';

interface EditCardPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCardPage({ params }: EditCardPageProps) {
  const cardId = Number((await params).id);
  if (!Number.isInteger(cardId) || cardId <= 0) {
    notFound();
  }

  const card = await getCardById(cardId);
  if (!card) {
    notFound();
  }

  const action = updateCardAction.bind(null, cardId);

  return (
    <DashboardShell>
      <section className="heroPanel section--narrow">
        <div>
          <p className="eyebrow">Watchlist management</p>
          <h2>Edit {card.name} {card.cardNumber}.</h2>
          <p className="lede">
            Query changes affect future scans, while every existing snapshot keeps its recorded historical query.
            Create a separate row for a different game, language, product type, or market segment.
          </p>
        </div>
        <div className="heroActions">
          <Link href={`/cards/${cardId}`} className="textLink">
            Cancel editing
          </Link>
        </div>
      </section>

      <section className="panel section--narrow">
        <div className="sectionHead">
          <div>
            <p className="eyebrow">Tracked card</p>
            <h3>Card identity and eBay query</h3>
          </div>
        </div>

        <CardForm
          action={action}
          initialValues={card}
          submitLabel="Save changes"
          helperText="The updated query will be checked during the next scheduled scan."
        />
      </section>
    </DashboardShell>
  );
}
