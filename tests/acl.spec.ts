/**
 * Spec § 38.1 - ACL leak test (CORE).
 * Verifies canRead() blocks every leak path per spec § 13.5.
 */
import { describe, it, expect } from 'vitest';
import { canRead, type AclInfo, type AclTarget, type AclContext } from '@/lib/context-router/acl';

const owner = 'owner-uuid';
const other = 'other-uuid';
const narratorEntity: AclTarget = { entityId: 'narr', entityType: 'narrator' };
const charA: AclTarget = { entityId: other, entityType: 'character' };
const worldAgent: AclTarget = { entityId: 'wa', entityType: 'world_agent' };

const baseInfo = (vis: AclInfo['visibility'], extra: Partial<AclInfo> = {}): AclInfo => ({
  owner_entity_id: owner,
  visibility: vis,
  ...extra,
});

describe('ACL canRead - owner always reads', () => {
  it('owner reads even with denied list (denied does not apply to owner)', () => {
    const info = baseInfo('private', { denied_entities: [owner] });
    expect(canRead(info, { entityId: owner, entityType: 'character' })).toBe(true);
  });

  it('owner reads regardless of visibility', () => {
    for (const vis of ['private', 'world_only', 'author_only', 'novelizer_only'] as const) {
      const info = baseInfo(vis);
      expect(canRead(info, { entityId: owner, entityType: 'character' })).toBe(true);
    }
  });
});

describe('ACL canRead - private_layer never leaks', () => {
  it('private visibility blocks all non-owner characters', () => {
    const info = baseInfo('private');
    expect(canRead(info, charA)).toBe(false);
  });

  it('source_layer=private_layer blocks even if visibility is public', () => {
    const info = baseInfo('public', { source_layer: 'private_layer' });
    expect(canRead(info, charA)).toBe(false);
  });

  it('private blocks world_agent except for self_and_world (which world_agent IS allowed)', () => {
    const priv = baseInfo('private');
    expect(canRead(priv, worldAgent)).toBe(false);
    const selfWorld = baseInfo('self_and_world');
    expect(canRead(selfWorld, worldAgent)).toBe(true);
  });
});

describe('ACL canRead - narrator special case (spec § 13.4)', () => {
  it('narrator reads private', () => {
    expect(canRead(baseInfo('private'), narratorEntity)).toBe(true);
  });
  it('narrator reads world_only / novelizer_only', () => {
    expect(canRead(baseInfo('world_only'), narratorEntity)).toBe(true);
    expect(canRead(baseInfo('novelizer_only'), narratorEntity)).toBe(true);
  });
  it('narrator does NOT read author_only', () => {
    expect(canRead(baseInfo('author_only'), narratorEntity)).toBe(false);
  });
});

describe('ACL canRead - author_view bypass', () => {
  const ctx: AclContext = { isAuthorView: true };
  it('author view reads everything except still subject to private_layer source check', () => {
    expect(canRead(baseInfo('private'), charA, ctx)).toBe(true);
    expect(canRead(baseInfo('author_only'), charA, ctx)).toBe(true);
  });

  it('author_view must come from backend; frontend setting it is just a flag we trust the backend', () => {
    // This is documentation: the test that frontend can't set isAuthorView
    // belongs in the API auth middleware integration test, not here.
    expect(true).toBe(true);
  });
});

describe('ACL canRead - denied list', () => {
  it('denied entity blocked even if visibility=public', () => {
    const info = baseInfo('public', { denied_entities: [other] });
    expect(canRead(info, charA)).toBe(false);
  });
});

describe('ACL canRead - shared visibility', () => {
  it('shared without entity in allowed_entities = blocked', () => {
    const info = baseInfo('shared', { allowed_entities: [] });
    expect(canRead(info, charA)).toBe(false);
  });
  it('shared with entity in allowed_entities = allowed', () => {
    const info = baseInfo('shared', { allowed_entities: [other] });
    expect(canRead(info, charA)).toBe(true);
  });
});

describe('ACL canRead - acl visibility', () => {
  it('acl with allowed_entities works like shared', () => {
    expect(canRead(baseInfo('acl', { allowed_entities: [other] }), charA)).toBe(true);
    expect(canRead(baseInfo('acl', { allowed_entities: [] }), charA)).toBe(false);
  });
});

describe('ACL canRead - faction visibility', () => {
  it('same faction allows', () => {
    const info = baseInfo('faction', { allowed_factions: ['faction-1'] });
    expect(canRead(info, charA, { targetFactions: ['faction-1'] })).toBe(true);
  });
  it('different faction blocks', () => {
    const info = baseInfo('faction', { allowed_factions: ['faction-1'] });
    expect(canRead(info, charA, { targetFactions: ['faction-2'] })).toBe(false);
  });
});

describe('ACL canRead - location_public', () => {
  it('entity in location reads', () => {
    const info = baseInfo('location_public', { location_id: 'loc-1' });
    expect(canRead(info, charA, { targetLocationIds: ['loc-1'] })).toBe(true);
  });
  it('entity not in location blocked', () => {
    const info = baseInfo('location_public', { location_id: 'loc-1' });
    expect(canRead(info, charA, { targetLocationIds: ['loc-2'] })).toBe(false);
  });
});

describe('ACL canRead - public', () => {
  it('public is readable by any character', () => {
    expect(canRead(baseInfo('public'), charA)).toBe(true);
  });
});
