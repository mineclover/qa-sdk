// @def.boundary sim-otel-utils
// @def.doc authorization-ontology-bitmap-pipeline

import { context, propagation } from '@opentelemetry/api';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

/**
 * NestJS의 HttpService(axios)에 traceparent inject 인터셉터 설치.
 *
 * 사용 예시:
 *   @Injectable()
 *   export class PmClient implements OnModuleInit {
 *     constructor(private readonly http: HttpService) {}
 *     onModuleInit() {
 *       installTraceInterceptor(this.http.axiosRef);
 *     }
 *   }
 */
export function installTraceInterceptor(axios: AxiosInstance): number {
  return axios.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const headers = config.headers ?? {};
    propagation.inject(context.active(), headers, {
      set: (h, key, val) => {
        (h as Record<string, string>)[key] = val;
      },
    });
    config.headers = headers;
    return config;
  });
}
