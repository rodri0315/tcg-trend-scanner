import assert from 'node:assert/strict';
import test from 'node:test';

import { getListingIdentityRejectionReason } from './listingIdentity';

const baseCard = {
  name: 'Giratina V',
  cardNumber: '186',
  language: 'english',
  variant: 'Alt Art',
};

test('requires both the tracked card number and character name', () => {
  assert.equal(getListingIdentityRejectionReason(baseCard, 'Giratina V 186/196 Lost Origin Alt Art NM'), null);
  assert.equal(getListingIdentityRejectionReason(baseCard, 'Charizard V 186 Brilliant Stars'), 'card_name_mismatch');
  assert.equal(getListingIdentityRejectionReason(baseCard, 'Giratina V 111 Lost Abyss'), 'card_number_mismatch');
});

test('matches card numbers as canonical tokens instead of substrings', () => {
  assert.equal(getListingIdentityRejectionReason(baseCard, 'Giratina V 1186 custom card'), 'card_number_mismatch');
  assert.equal(
    getListingIdentityRejectionReason(
      { ...baseCard, name: 'Gengar VMAX', cardNumber: '020', language: 'japanese' },
      'Japanese Gengar VMAX 20/190 Fusion Arts',
    ),
    null,
  );
  assert.equal(
    getListingIdentityRejectionReason(
      { ...baseCard, name: 'Roronoa Zoro', cardNumber: 'OP04-031' },
      'One Piece Zoro OP4-031 Leader English',
    ),
    null,
  );
});

test('rejects listings that explicitly identify a conflicting language', () => {
  assert.equal(
    getListingIdentityRejectionReason(baseCard, 'Giratina V 186 Japanese Lost Origin'),
    'conflicting_language',
  );
  assert.equal(
    getListingIdentityRejectionReason(
      { ...baseCard, cardNumber: '111', language: 'japanese' },
      'Giratina V 111 English Lost Abyss',
    ),
    'conflicting_language',
  );
});

test('requires variant evidence where a card number can represent multiple versions', () => {
  const signatureCard = {
    name: 'Monkey.D.Luffy',
    cardNumber: 'OP05-119',
    language: 'english',
    variant: 'Signature',
  };

  assert.equal(
    getListingIdentityRejectionReason(signatureCard, 'One Piece Luffy OP05-119 English'),
    'missing_variant_identity',
  );
  assert.equal(
    getListingIdentityRejectionReason(signatureCard, 'One Piece Luffy OP05-119 Signed Signature English'),
    null,
  );
  assert.equal(
    getListingIdentityRejectionReason(signatureCard, 'Monkey D Luffy OP05-119 Eiichiro Oda Anniversary English'),
    null,
  );
});
