import { describe, it, expect } from 'vitest';
import { toUpperSnake, toPascal, toConstKey, toEnumValue, toTsConstKey } from './naming.js';

describe('naming', () => {
  describe('toUpperSnake', () => {
    it('소문자를 대문자로 변환', () => {
      expect(toUpperSnake('k8s_cluster')).toBe('K8S_CLUSTER');
    });
  });

  describe('toPascal', () => {
    it('snake_case → PascalCase', () => {
      expect(toPascal('k8s_cluster')).toBe('K8sCluster');
      expect(toPascal('k8s_workload_type')).toBe('K8sWorkloadType');
      expect(toPascal('apm_signal_type')).toBe('ApmSignalType');
    });
  });

  describe('toConstKey', () => {
    it('하이픈을 언더스코어로 변환', () => {
      expect(toConstKey('prod-east')).toBe('PROD_EAST');
    });
  });

  describe('toEnumValue', () => {
    it('축 ID + entry를 protobuf enum 값으로 변환', () => {
      expect(toEnumValue('k8s_cluster', 'prod-east')).toBe('K8S_CLUSTER_PROD_EAST');
      expect(toEnumValue('k8s_cluster', 'UNSPECIFIED')).toBe('K8S_CLUSTER_UNSPECIFIED');
    });

    it('특수문자를 언더스코어로 변환', () => {
      expect(toEnumValue('git_repo', 'qa-sdk')).toBe('GIT_REPO_QA_SDK');
    });
  });

  describe('toTsConstKey', () => {
    it('entry를 TypeScript const key로 변환', () => {
      expect(toTsConstKey('prod-east')).toBe('PROD_EAST');
      expect(toTsConstKey('deployment')).toBe('DEPLOYMENT');
      expect(toTsConstKey('qa-sdk')).toBe('QA_SDK');
    });
  });
});
