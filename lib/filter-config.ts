export interface FilterConfig {
  captureMode: 'all' | 'failed_only';
  urlIncludes: string[];
  urlExcludes: string[];
  methods: string[];
  statusRange: [number, number];
  resourceTypes: string[];
  enableAdvanced: boolean;
  advancedRules?: AdvancedRules;
}

export interface AdvancedRules {
  mode: 'include' | 'exclude';
  logic: 'and' | 'or';
  rules: FilterRule[];
  exclude: FilterRule[];
}

export interface FilterRule {
  type:
    | 'url_contains'
    | 'url_regex'
    | 'method'
    | 'status_range'
    | 'resource_type'
    | 'domain';
  value: any;
}

export const FILTER_CONFIG_KEY = 'filterConfig';

export const DEFAULT_FILTER: FilterConfig = {
  captureMode: 'failed_only',
  urlIncludes: ['/api/', '/graphql', '/v1', '/v2', '/v3'],
  urlExcludes: [
    '/log',
    '/track',
    '/beacon',
    '/ping',
    '/poll',
    '.js',
    '.css',
    '.png',
    '.jpg',
    '.woff',
    '.svg',
    '/static/',
    '/assets/',
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  statusRange: [400, 599],
  resourceTypes: ['xhr', 'fetch'],
  enableAdvanced: false,
};

export async function getFilterConfig(): Promise<FilterConfig> {
  const result = await chrome.storage.local.get(FILTER_CONFIG_KEY);
  const stored = result[FILTER_CONFIG_KEY] as Partial<FilterConfig> | undefined;
  return { ...DEFAULT_FILTER, ...(stored ?? {}) };
}

export async function setFilterConfig(config: FilterConfig): Promise<void> {
  await chrome.storage.local.set({ [FILTER_CONFIG_KEY]: config });
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id != null) {
      chrome.tabs
        .sendMessage(tab.id, { type: 'FILTER_CONFIG_CHANGED', config })
        .catch(() => {});
    }
  }
}
