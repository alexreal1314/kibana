/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { get } from 'lodash';
import type { IScopedClusterClient, Logger } from '@kbn/core/server';
import { ALL_ENTITY_TYPES } from '@kbn/entity-store/common';
import type { EntityType } from '@kbn/entity-store/common';
import { euid, getBuiltInEntityDefinition } from '@kbn/entity-store/common/euid_helpers';
import type { EntityId, EsQuery } from './types';

const ENTITY_TYPE_FIELD_PATH = 'entity.EngineMetadata.Type';

const isEntityType = (value: unknown): value is EntityType =>
  typeof value === 'string' && (ALL_ENTITY_TYPES as readonly string[]).includes(value);

/**
 * Builds the query that selects the events of the origin entities of an entity-centered graph.
 *
 * Raw events carry no `entity.id`: an entity is linked to them by recomputing its identity from
 * source fields such as `user.email` and `host.id`. The match is therefore built from each
 * entity's Entity Store record with the Entity Store's own identity rules, not from a literal
 * `entity.id` filter. Returns `undefined` when no origin entity can be resolved, in which case the
 * graph has no events to show. A failed lookup is logged and also returns `undefined`, so the
 * relationships are still returned.
 */
export const buildOriginEntitiesEsQuery = async ({
  esClient,
  logger,
  entityIds,
  entityStoreIndexName,
}: {
  esClient: IScopedClusterClient;
  logger: Logger;
  entityIds: EntityId[];
  entityStoreIndexName: string | null;
}): Promise<EsQuery | undefined> => {
  const originIds = entityIds.filter(({ isOrigin }) => isOrigin).map(({ id }) => id);
  if (!entityStoreIndexName || originIds.length === 0) {
    return undefined;
  }

  try {
    const { hits } = await esClient.asCurrentUser.search<Record<string, unknown>>({
      index: entityStoreIndexName,
      size: originIds.length,
      query: { terms: { 'entity.id': originIds } },
    });

    const filters = hits.hits.flatMap(({ _source: record }) => {
      const entityType = get(record, ENTITY_TYPE_FIELD_PATH);
      if (!isEntityType(entityType)) {
        return [];
      }
      const filter = euid.dsl.getEuidFilterBasedOnEntityRecord(
        getBuiltInEntityDefinition(entityType),
        record
      );
      return filter ? [filter] : [];
    });

    return filters.length > 0 ? { bool: { should: filters } } : undefined;
  } catch (error) {
    logger.warn(
      `Failed to build the events query for the origin entities, continuing without events: ${error.message}`
    );
    return undefined;
  }
};
