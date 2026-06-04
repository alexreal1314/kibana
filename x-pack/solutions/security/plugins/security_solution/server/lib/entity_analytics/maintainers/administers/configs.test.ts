/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { ADMINISTERS_INTEGRATION_RELATIONSHIP_CONFIGS } from './configs';
import { buildActorDiscoveryQuery } from '../engine/build_actor_discovery_query';
import { buildTargetsPerActorQuery } from '../engine/build_targets_per_actor_query';
import { COMPOSITE_PAGE_SIZE } from '../engine/constants';
import type { OverrideRelationshipIntegrationConfig } from '../engine/types';

const overrideConfigs = ADMINISTERS_INTEGRATION_RELATIONSHIP_CONFIGS.filter(
  (c): c is OverrideRelationshipIntegrationConfig => c.kind === 'override'
);

describe('ADMINISTERS_INTEGRATION_RELATIONSHIP_CONFIGS', () => {
  it('ships exactly the one expected integration', () => {
    expect(ADMINISTERS_INTEGRATION_RELATIONSHIP_CONFIGS.map((c) => c.id).sort()).toEqual([
      'entityanalytics_ad',
    ]);
  });

  it('declares kind: "override" on every administers config', () => {
    for (const config of ADMINISTERS_INTEGRATION_RELATIONSHIP_CONFIGS) {
      expect(config.kind).toBe('override');
    }
    expect(overrideConfigs).toHaveLength(ADMINISTERS_INTEGRATION_RELATIONSHIP_CONFIGS.length);
  });

  it('declares relationshipKey "administers" on every config', () => {
    for (const config of overrideConfigs) {
      expect(config.relationshipKey).toBe('administers');
    }
  });

  it('declares targetEntityType "host" on every config', () => {
    for (const config of ADMINISTERS_INTEGRATION_RELATIONSHIP_CONFIGS) {
      expect(config.targetEntityType).toBe('host');
    }
  });

  it.each(ADMINISTERS_INTEGRATION_RELATIONSHIP_CONFIGS)(
    '$id: builds a syntactically-locked actor discovery query',
    (config) => {
      const query = buildActorDiscoveryQuery(config, undefined) as {
        size: number;
        query: { bool: { filter: unknown[] } };
        aggs: { users: { composite: { size: number; sources: unknown[] } } };
      };
      expect(query.size).toBe(0);
      expect(query.query.bool.filter.length).toBeGreaterThanOrEqual(2);
      expect(query.aggs.users.composite.size).toBe(COMPOSITE_PAGE_SIZE);
    }
  );

  it.each(ADMINISTERS_INTEGRATION_RELATIONSHIP_CONFIGS)(
    '$id: indexPattern points to the entity index (not a log index)',
    (config) => {
      expect(config.indexPattern('myns')).toContain('.entities.v2.latest.security_myns');
      expect(config.indexPattern('default')).not.toContain('myns');
    }
  );

  it.each(ADMINISTERS_INTEGRATION_RELATIONSHIP_CONFIGS)(
    '$id: override query constructs host EUIDs from FQDN via CONCAT',
    (config) => {
      const query = buildTargetsPerActorQuery(config, 'default');
      expect(query).toContain('CONCAT("host:", allHostnames)');
    }
  );

  it.each(ADMINISTERS_INTEGRATION_RELATIONSHIP_CONFIGS)(
    '$id: override query expands raw_identifiers.host.name via MV_EXPAND',
    (config) => {
      const query = buildTargetsPerActorQuery(config, 'default');
      expect(query).toContain('raw_identifiers.host.name');
      expect(query).toContain('MV_EXPAND');
    }
  );

  it.each(ADMINISTERS_INTEGRATION_RELATIONSHIP_CONFIGS)(
    '$id: override query does NOT filter by entity.type (both user and host actors)',
    (config) => {
      const query = buildTargetsPerActorQuery(config, 'default');
      expect(query).not.toContain('entity.type ==');
    }
  );

  it.each(ADMINISTERS_INTEGRATION_RELATIONSHIP_CONFIGS)(
    '$id: override query sets actorUserId from entity.id (already EUID-prefixed)',
    (config) => {
      const query = buildTargetsPerActorQuery(config, 'default');
      expect(query).toContain('actorUserId = entity.id');
    }
  );

  describe('resolved_identifiers approach', () => {
    it('override query uses MV_DIFFERENCE to filter only unresolved identifiers', () => {
      const config =
        ADMINISTERS_INTEGRATION_RELATIONSHIP_CONFIGS[0] as OverrideRelationshipIntegrationConfig;
      const query = config.esqlQueryOverride('default');
      expect(query).toContain('MV_DIFFERENCE(');
      expect(query).toContain('resolved_identifiers.host.name');
    });

    it('override query resolvedHostnames tracks full raw_identifiers set (not just delta)', () => {
      const config =
        ADMINISTERS_INTEGRATION_RELATIONSHIP_CONFIGS[0] as OverrideRelationshipIntegrationConfig;
      const query = config.esqlQueryOverride('default');
      expect(query).toContain('MV_EXPAND allHostnames');
      expect(query).toContain('resolvedHostnames = VALUES(allHostnames)');
    });

    it('override query does NOT contain a @timestamp filter (no watermark needed)', () => {
      const config =
        ADMINISTERS_INTEGRATION_RELATIONSHIP_CONFIGS[0] as OverrideRelationshipIntegrationConfig;
      const query = config.esqlQueryOverride('default');
      expect(query).not.toContain('@timestamp >');
    });

    it('composite agg filters do NOT include @timestamp range', () => {
      const config = ADMINISTERS_INTEGRATION_RELATIONSHIP_CONFIGS[0];
      const filters = config.compositeAggAdditionalFilters ?? [];
      const rangeFilters = filters.filter((f) => JSON.stringify(f).includes('@timestamp'));
      expect(rangeFilters.length).toBe(0);
    });
  });

  describe('golden snapshots', () => {
    it.each(ADMINISTERS_INTEGRATION_RELATIONSHIP_CONFIGS)(
      '$id: targets-per-actor ES|QL is locked',
      (config) => {
        expect(buildTargetsPerActorQuery(config, '__namespace__')).toMatchSnapshot();
      }
    );
  });
});
