/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ElasticsearchClient, Logger } from '@kbn/core/server';
import { euid, getBuiltInEntityDefinition } from '@kbn/entity-store/common/euid_helpers';
import { DEFAULT_ALERTS_INDEX } from '../../../../common/constants';
import type { EntityIdentifierType } from './entity_resolution';

/** Most events and alerts stored on a graph preview, newest first, to keep the preview compact. */
export const ENTITY_GRAPH_ORIGIN_EVENTS_LIMIT = 50;

/** Matches alert backing indices such as `.internal.alerts-security.alerts-default-000001`. */
const ALERTS_INDEX_PARTIAL_NAME = `${DEFAULT_ALERTS_INDEX}-`;
const EVENT_ID_FIELD = 'event.id';
const EVENT_LOGS_INDEX_PATTERN = 'logs-*';

export interface EntityGraphOriginEventId {
  id: string;
  isAlert: boolean;
}

/**
 * Finds the most recent events and alerts attributable to an Entity Store entity, so the graph API
 * can be seeded with them via `originEventIds`.
 *
 * Raw events carry no `entity.id`: the entity is linked to them by recomputing its identity from
 * source fields such as `user.email` and `host.id`. The match is therefore built from the entity
 * record with the Entity Store's own identity rules instead of a literal `entity.id` filter.
 *
 * Only documents with an `event.id` can be returned, because that is the key the graph API accepts.
 * A failed lookup returns an empty list so the preview still renders its relationships.
 */
export const fetchEntityGraphOriginEventIds = async ({
  esClient,
  logger,
  spaceId,
  identifierType,
  entityRecord,
  timeRange,
}: {
  esClient: ElasticsearchClient;
  logger: Logger;
  spaceId: string;
  identifierType: EntityIdentifierType;
  entityRecord: Record<string, unknown>;
  timeRange: { from: string; to: string };
}): Promise<EntityGraphOriginEventId[]> => {
  const entityFilter = euid.dsl.getEuidFilterBasedOnEntityRecord(
    getBuiltInEntityDefinition(identifierType),
    entityRecord
  );
  if (!entityFilter) {
    return [];
  }

  const alertsIndex = `${DEFAULT_ALERTS_INDEX}-${spaceId}`;

  try {
    const response = await esClient.search({
      index: [alertsIndex, EVENT_LOGS_INDEX_PATTERN],
      ignore_unavailable: true,
      allow_no_indices: true,
      size: ENTITY_GRAPH_ORIGIN_EVENTS_LIMIT,
      _source: false,
      fields: [EVENT_ID_FIELD],
      sort: [{ '@timestamp': 'desc' }],
      // One hit per event.id: the same event is often ingested more than once.
      collapse: { field: EVENT_ID_FIELD },
      query: {
        bool: {
          filter: [
            { range: { '@timestamp': { gte: timeRange.from, lte: timeRange.to } } },
            { exists: { field: EVENT_ID_FIELD } },
            entityFilter,
          ],
        },
      },
    });

    return response.hits.hits.flatMap((hit) => {
      const [id] = (hit.fields?.[EVENT_ID_FIELD] as string[] | undefined) ?? [];
      return id ? [{ id, isAlert: hit._index.includes(ALERTS_INDEX_PARTIAL_NAME) }] : [];
    });
  } catch (error) {
    logger.warn(
      `Failed to look up events for entity graph preview, continuing without them: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return [];
  }
};
