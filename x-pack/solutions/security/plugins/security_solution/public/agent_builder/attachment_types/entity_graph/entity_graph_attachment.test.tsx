/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ApplicationStart } from '@kbn/core-application-browser';
import type { HttpStart } from '@kbn/core-http-browser';
import type { AttachmentActionButton } from '@kbn/agent-builder-browser/attachments';
import { navigateToEntityAnalyticsWithFlyoutInApp } from '../entity_explore_navigation';
import { createEntityGraphAttachmentDefinition } from './entity_graph_attachment';
import type { EntityGraphAttachment, EntityGraphAttachmentData } from './types';

jest.mock('../entity_explore_navigation', () => ({
  ...jest.requireActual('../entity_explore_navigation'),
  navigateToEntityAnalyticsWithFlyoutInApp: jest.fn(),
}));

const mockNavigate = navigateToEntityAnalyticsWithFlyoutInApp as jest.Mock;

const email = 'liveness-probe@prod-billing-project.iam.gserviceaccount.com';
const userGraphData: EntityGraphAttachmentData = {
  identifierType: 'user',
  identifier: `${email}@gke-prod-cluster-billing-api-7f3a`,
  entityStoreId: `user:${email}@gke-prod-cluster-billing-api-7f3a@local`,
  timeRange: { from: 'now-30d', to: 'now' },
};

const openFullGraph = (data: EntityGraphAttachmentData) => {
  const definition = createEntityGraphAttachmentDefinition({
    application: {} as ApplicationStart,
    http: {} as HttpStart,
  });
  const attachment = { id: 'a', type: 'security.entity_graph', data } as EntityGraphAttachment;
  const buttons = definition.getActionButtons?.({
    attachment,
    isSidebar: false,
    isCanvas: false,
  } as Parameters<NonNullable<typeof definition.getActionButtons>>[0]) as AttachmentActionButton[];
  buttons[0].handler();
  return mockNavigate.mock.calls[0][0].flyout;
};

describe('createEntityGraphAttachmentDefinition', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('"Open full graph" action', () => {
    it('opens the graph view seeded with the events and alerts the preview showed', () => {
      const originEventIds = [
        { id: 'gcp-exec-evt-9201', isAlert: false },
        { id: 'alert-source-evt-1', isAlert: true },
      ];

      const flyout = openFullGraph({ ...userGraphData, originEventIds });

      expect(flyout.left).toEqual({
        path: { tab: 'graph_view' },
        originEventIds,
      });
    });

    it('opens the graph view centered on the entity only when the preview had no events', () => {
      const flyout = openFullGraph(userGraphData);

      expect(flyout.left).toEqual({ path: { tab: 'graph_view' } });
    });
  });
});
