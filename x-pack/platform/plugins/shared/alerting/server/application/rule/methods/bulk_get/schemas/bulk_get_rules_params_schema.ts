/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { schema } from '@kbn/config-schema';

export const bulkGetRulesParamsSchema = schema.object({
  ids: schema.arrayOf(schema.string(), { minSize: 1 }),
  includeLegacyId: schema.maybe(schema.boolean()),
  includeSnoozeData: schema.maybe(schema.boolean()),
  excludeFromPublicApi: schema.maybe(schema.boolean()),
});
