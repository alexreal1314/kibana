/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { getLatestEntityIndexPattern } from '@kbn/entity-store/common/domain/entity_index';
import { COMPOSITE_PAGE_SIZE } from '../engine/constants';
import type { RelationshipIntegrationConfig } from '../engine/types';

/**
 * Builds the Step 2 ES|QL override query for the administers maintainer.
 *
 * Uses MV_DIFFERENCE to compute the delta between raw_identifiers and
 * resolved_identifiers so only genuinely unresolved hostnames are processed.
 * Entities where all raw_identifiers are already resolved are excluded entirely
 * at the ES|QL level — no application-side diff needed.
 *
 * Override column contract:
 *   - actorUserId       — full actor EUID string
 *   - administers       — resolved target EUIDs to write into ids
 *   - resolvedHostnames — raw hostname values that were resolved, to append
 *                         into resolved_identifiers.host.name
 */
function buildAdministersEsqlQuery(namespace: string): string {
  const entityIndex = getLatestEntityIndexPattern(namespace);

  return `FROM ${entityIndex}
| WHERE MV_DIFFERENCE(
    entity.relationships.administers.raw_identifiers.host.name,
    entity.relationships.administers.resolved_identifiers.host.name
  ) IS NOT NULL
| EVAL actorUserId = entity.id
| EVAL allHostnames = entity.relationships.administers.raw_identifiers.host.name
| MV_EXPAND allHostnames
| WHERE COALESCE(allHostnames, "") != ""
| EVAL targetEntityId = CONCAT("host:", allHostnames)
| STATS
    administers       = VALUES(targetEntityId),
    resolvedHostnames = VALUES(allHostnames)
  BY actorUserId
| WHERE COALESCE(actorUserId, "") != ""
| LIMIT ${COMPOSITE_PAGE_SIZE}`;
}

export function buildAdministersConfigs(): RelationshipIntegrationConfig[] {
  return [
    {
      kind: 'override',
      id: 'entityanalytics_ad',
      name: 'Active Directory Entity Analytics',
      indexPattern: getLatestEntityIndexPattern,
      targetEntityType: 'host',
      relationshipKey: 'administers',
      // entity.id is present on every entity document regardless of type,
      // so Step 1 discovers both user and host actors. Without this, the
      // engine defaults to USER_IDENTITY_FIELDS (user.name, user.email, etc.)
      // which don't exist on host entity documents, producing 0 buckets.
      customActor: {
        fields: ['entity.id'],
      },
      compositeAggAdditionalFilters: [
        // Only surface entities that have unresolved administers raw_identifiers.
        {
          exists: {
            field: 'entity.relationships.administers.raw_identifiers.host.name',
          },
        },
      ],
      esqlQueryOverride: buildAdministersEsqlQuery,
    },
  ];
}

export const ADMINISTERS_INTEGRATION_RELATIONSHIP_CONFIGS = buildAdministersConfigs();
