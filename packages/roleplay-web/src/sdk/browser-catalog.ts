import {
  BROWSER_CATALOG,
  withServiceOverlay,
  type BrowserCatalog,
  type BrowserServiceDims,
} from '@qa-sdk/browser-codec';

export const LOCAL_SERVICE_DIMS: BrowserServiceDims = {
  env: 'local',
  region: 'asia',
  svc_name: 'roleplay-web',
  namespace: 'shop',
};

export const LOCAL_BROWSER_CATALOG: BrowserCatalog = withServiceOverlay(
  BROWSER_CATALOG,
  LOCAL_SERVICE_DIMS,
);
