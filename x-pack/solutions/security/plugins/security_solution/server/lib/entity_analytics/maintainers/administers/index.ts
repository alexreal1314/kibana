/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { RegisterEntityMaintainerConfig } from '@kbn/entity-store/server';

import { runRelationshipMaintainer } from '../engine/run_relationship_maintainer';
import { ADMINISTERS_INTEGRATION_RELATIONSHIP_CONFIGS } from './configs';

export const administersMaintainer: RegisterEntityMaintainerConfig = {
  id: 'administers',
  description:
    'Resolves administers relationships from raw_identifiers on entity documents ' +
    '(Active Directory: user → host and host → host via managedObjects). ' +
    'Uses resolved_identifiers to track progress — only unresolved identifiers ' +
    'are processed on each run via MV_DIFFERENCE.',
  interval: '1d',
  initialState: {},
  run: async ({ esClient, logger, status, crudClient, abortController }) => {
    const namespace = status.metadata.namespace;
    logger.info('Starting administers maintainer run');

    const result = await runRelationshipMaintainer({
      esClient,
      logger,
      namespace,
      crudClient,
      integrations: ADMINISTERS_INTEGRATION_RELATIONSHIP_CONFIGS,
      abortController,
    });

    logger.info(
      `Completed run: ${result.totalBuckets} buckets, ${result.totalRecords} records, ${result.totalWritten} entities written`
    );

    return result;
  },
};
