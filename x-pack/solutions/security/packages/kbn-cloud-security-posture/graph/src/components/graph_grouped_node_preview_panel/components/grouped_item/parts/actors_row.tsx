/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { css } from '@emotion/react';
import { EuiFlexGroup, EuiFlexItem, EuiBadge, EuiIcon } from '@elastic/eui';
import { GROUPED_ITEM_ACTOR_TEST_ID, GROUPED_ITEM_TARGET_TEST_ID } from '../../../test_ids';
import type { AlertItem } from '../types';
import { displayEntityName } from '../utils';

export interface ActorsRowProps {
  actor: NonNullable<AlertItem['actor']>;
  target: NonNullable<AlertItem['target']>;
}

const badgeStyles = css`
  max-width: 200px;
`;

export const ActorsRow = ({ actor, target }: ActorsRowProps) => {
  // Normalize actor and target IDs to arrays
  const actorIds = Array.isArray(actor.id) ? actor.id : [actor.id];
  const targetIds = Array.isArray(target.id) ? target.id : [target.id];

  return (
    <EuiFlexGroup wrap gutterSize="xs" responsive={false} alignItems="center" direction="row">
      {actorIds.map((actorId) => (
        <EuiFlexItem key={`actor-${actorId}`} grow={false}>
          <EuiBadge
            color="hollow"
            iconType={actor.icon}
            iconSide="left"
            data-test-subj={GROUPED_ITEM_ACTOR_TEST_ID}
            css={badgeStyles}
          >
            {displayEntityName({ ...actor, id: actorId })}
          </EuiBadge>
        </EuiFlexItem>
      ))}
      <EuiFlexItem grow={false}>
        <EuiIcon type="sortRight" size="m" color="subdued" />
      </EuiFlexItem>
      {targetIds.map((targetId) => (
        <EuiFlexItem key={`target-${targetId}`} grow={false}>
          <EuiBadge
            color="hollow"
            iconType={target.icon}
            iconSide="left"
            data-test-subj={GROUPED_ITEM_TARGET_TEST_ID}
            css={badgeStyles}
          >
            {displayEntityName({ ...target, id: targetId })}
          </EuiBadge>
        </EuiFlexItem>
      ))}
    </EuiFlexGroup>
  );
};
