export const API_SCALING_PROFILE = {
  mode: 'stateless-http',
  minReplicas: 2,
  maxReplicas: 8,
  scaleMetric: 'http_requests_per_second',
} as const;

export const WORKER_SCALING_PROFILE = {
  mode: 'queue-consumer',
  minReplicas: 1,
  maxReplicas: 12,
  scaleMetric: 'queue_lag',
} as const;

export const CACHE_KEY_POLICY = {
  delimiter: ':',
  prefixShape: 'domain-purpose',
  concreteShape: 'prefix:version:id',
} as const;
