/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { loggingSystemMock } from '@kbn/core-logging-server-mocks';
import { elasticsearchServiceMock } from '@kbn/core/server/mocks';
import { buildOriginEntitiesEsQuery } from './fetch_origin_entities_es_query';

const email = 'liveness-probe@prod-billing-project.iam.gserviceaccount.com';
const host = 'gke-prod-cluster-billing-api-7f3a';
const userEuid = `user:${email}@${host}@local`;

/** Entity Store record of the user, as stored: nested, with the namespace already resolved. */
const userRecord = {
  entity: {
    id: userEuid,
    namespace: 'local',
    EngineMetadata: { Type: 'user', UntypedId: `${email}@${host}@local` },
  },
  user: { name: email, email },
  host: { id: host, name: host },
};

const hostRecord = {
  entity: {
    id: `host:${host}`,
    EngineMetadata: { Type: 'host', UntypedId: host },
  },
  host: { id: host, name: host },
};

describe('buildOriginEntitiesEsQuery', () => {
  const esClient = elasticsearchServiceMock.createScopedClusterClient();
  const logger = loggingSystemMock.createLogger();

  const respondWith = (...sources: unknown[]) =>
    esClient.asCurrentUser.search.mockResolvedValueOnce({
      hits: { hits: sources.map((_source) => ({ _source })) },
    } as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('matches the events of an origin entity by its identity fields, not by a literal entity.id', async () => {
    respondWith(userRecord);

    const esQuery = await buildOriginEntitiesEsQuery({
      esClient,
      logger,
      entityIds: [{ id: userEuid, isOrigin: true }],
      entityStoreIndexName: '.entities.v2.latest.default-00001',
    });

    const serialized = JSON.stringify(esQuery);
    expect(serialized).toContain(email);
    expect(serialized).toContain(host);
    expect(serialized).not.toContain('"entity.id"');
    expect(esQuery?.bool.should).toHaveLength(1);
  });

  it('looks the origin entities up in the entity store index', async () => {
    respondWith(userRecord);

    await buildOriginEntitiesEsQuery({
      esClient,
      logger,
      entityIds: [{ id: userEuid, isOrigin: true }],
      entityStoreIndexName: '.entities.v2.latest.default-00001',
    });

    expect(esClient.asCurrentUser.search).toHaveBeenCalledWith(
      expect.objectContaining({
        index: '.entities.v2.latest.default-00001',
        query: { terms: { 'entity.id': [userEuid] } },
      })
    );
  });

  it('matches the events of any of several origin entities', async () => {
    respondWith(userRecord, hostRecord);

    const esQuery = await buildOriginEntitiesEsQuery({
      esClient,
      logger,
      entityIds: [
        { id: userEuid, isOrigin: true },
        { id: `host:${host}`, isOrigin: true },
      ],
      entityStoreIndexName: '.entities.v2.latest.default-00001',
    });

    expect(esQuery?.bool.should).toHaveLength(2);
  });

  it('ignores entities that are not origins', async () => {
    const esQuery = await buildOriginEntitiesEsQuery({
      esClient,
      logger,
      entityIds: [{ id: userEuid, isOrigin: false }],
      entityStoreIndexName: '.entities.v2.latest.default-00001',
    });

    expect(esQuery).toBeUndefined();
    expect(esClient.asCurrentUser.search).not.toHaveBeenCalled();
  });

  it('returns nothing when there is no entity store index', async () => {
    const esQuery = await buildOriginEntitiesEsQuery({
      esClient,
      logger,
      entityIds: [{ id: userEuid, isOrigin: true }],
      entityStoreIndexName: null,
    });

    expect(esQuery).toBeUndefined();
    expect(esClient.asCurrentUser.search).not.toHaveBeenCalled();
  });

  it('returns nothing when the origin entity is not in the entity store', async () => {
    respondWith();

    const esQuery = await buildOriginEntitiesEsQuery({
      esClient,
      logger,
      entityIds: [{ id: userEuid, isOrigin: true }],
      entityStoreIndexName: '.entities.v2.latest.default-00001',
    });

    expect(esQuery).toBeUndefined();
  });

  it('returns nothing, and does not throw, when the entity lookup fails', async () => {
    esClient.asCurrentUser.search.mockRejectedValueOnce(new Error('index_not_found_exception'));

    await expect(
      buildOriginEntitiesEsQuery({
        esClient,
        logger,
        entityIds: [{ id: userEuid, isOrigin: true }],
        entityStoreIndexName: '.entities.v2.latest.default-00001',
      })
    ).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });
});
