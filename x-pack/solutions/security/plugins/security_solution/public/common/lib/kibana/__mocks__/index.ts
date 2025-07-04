/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { notificationServiceMock } from '@kbn/core/public/mocks';
import {
  createKibanaContextProviderMock,
  createUseUiSettingMock,
  createUseUiSetting$Mock,
  createStartServicesMock,
  createWithKibanaMock,
} from '../kibana_react.mock';
import { APP_UI_ID } from '../../../../../common/constants';

export { useKibana } from './use_kibana';

const mockStartServicesMock = createStartServicesMock();
export const KibanaServices = {
  get: jest.fn(() => {
    const { application, http, uiSettings, notifications, data, unifiedSearch } =
      mockStartServicesMock;

    return {
      application,
      http,
      uiSettings,
      notifications,
      data,
      unifiedSearch,
    };
  }),
  getKibanaVersion: jest.fn(() => '8.0.0'),
  getKibanaBranch: jest.fn(() => 'main'),
  getBuildFlavor: jest.fn(() => 'traditional'),
  getPrebuiltRulesPackageVersion: jest.fn(() => undefined),
};
export const useUiSetting = jest.fn(createUseUiSettingMock());
export const useUiSetting$ = jest.fn(createUseUiSetting$Mock());
export const useHttp = jest.fn().mockReturnValue(createStartServicesMock().http);
export const useTimeZone = jest.fn();
export const useDateFormat = jest.fn().mockReturnValue('MMM D, YYYY @ HH:mm:ss.SSS');
export const useBasePath = jest.fn(() => '/test/base/path');
export const useToasts = jest
  .fn()
  .mockReturnValue(notificationServiceMock.createStartContract().toasts);
export const useCurrentUser = jest.fn();
export const withKibana = jest.fn(createWithKibanaMock());
export const KibanaContextProvider = jest.fn(createKibanaContextProviderMock());
export const useAppUrl = jest.fn().mockReturnValue({
  getAppUrl: jest
    .fn()
    .mockImplementation(({ appId = APP_UI_ID, ...options }) =>
      mockStartServicesMock.application.getUrlForApp(appId, options)
    ),
});
// do not delete
export const useNavigateTo = jest.fn().mockReturnValue({
  navigateTo: jest.fn().mockImplementation(({ appId = APP_UI_ID, url, ...options }) => {
    if (url) {
      mockStartServicesMock.application.navigateToUrl(url);
    } else {
      mockStartServicesMock.application.navigateToApp(appId, options);
    }
  }),
});

export const useCapabilities = jest.fn((featureId?: string) =>
  featureId
    ? mockStartServicesMock.application.capabilities[featureId]
    : mockStartServicesMock.application.capabilities
);

export const useNavigation = jest
  .fn()
  .mockReturnValue({ getAppUrl: jest.fn(), navigateTo: jest.fn() });
