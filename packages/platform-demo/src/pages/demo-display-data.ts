// @def.boundary platform-demo-system
// @def.doc platform-demo-system

import {
  DEMO_ENVS,
  DEMO_REGIONS,
  DEMO_SVCS,
  DEMO_NSS,
  DEMO_KO,
  demoDecodeSvc,
} from "demo-snapshot";

export interface DemoDisplayValue {
  idx1: number;
  id: string;
  ko: string;
  shortKo: string;
}

export interface DemoRefSvcRow {
  pos: number;
  addr: number;
  envId: string;
  envKo: string;
  regionId: string;
  regionKo: string;
  svcId: string;
  svcKo: string;
  svcFullKo: string;
  nsId: string;
  nsKo: string;
  nsFullKo: string;
  label: string;
  title: string;
}

const SHORT_SVC_KO: Record<string, string> = {
  "shopping-web": "쇼핑웹",
  "shopping-backend": "쇼핑BE",
  auth: "인증",
  payment: "결제",
  gateway: "GW",
  "registry-service": "레지스트리",
  "ingest-server": "수집",
  "platform-demo": "데모",
  "content-service": "콘텐츠",
  "infra-controller": "인프라",
  "gate-service": "게이트",
  "query-service": "질의",
  "decode-service": "디코드",
  "platform-demo-api": "데모API",
  "roleplay-web": "롤플레이",
  "viteplus-sdk-smoke": "Vite+",
};

const SHORT_NS_KO: Record<string, string> = {
  shop: "쇼핑",
  cms: "CMS",
};

const SHORT_REGION_KO: Record<string, string> = {
  asia: "아시아",
  usa: "미국",
};

function fullKo(axis: "env" | "region" | "svc" | "ns" | "role" | "event" | "initiator", id: string): string {
  return DEMO_KO[axis][id] ?? id;
}

export function displayValue(
  axis: "env" | "region" | "svc" | "ns" | "role" | "event" | "initiator",
  id: string,
  idx1: number,
): DemoDisplayValue {
  const ko = fullKo(axis, id);
  const shortKo = axis === "svc"
    ? SHORT_SVC_KO[id] ?? ko
    : axis === "ns"
      ? SHORT_NS_KO[id] ?? ko
      : axis === "region"
        ? SHORT_REGION_KO[id] ?? ko
        : ko;

  return { idx1, id, ko, shortKo };
}

export function buildRefSvcRows(addresses: readonly number[]): DemoRefSvcRow[] {
  return addresses.map((addr, i) => {
    const [envIdx, regionIdx, svcIdx, nsIdx] = demoDecodeSvc(addr);
    const envId = DEMO_ENVS[envIdx - 1] ?? "?";
    const regionId = DEMO_REGIONS[regionIdx - 1] ?? "?";
    const svcId = DEMO_SVCS[svcIdx - 1] ?? "?";
    const nsId = DEMO_NSS[nsIdx - 1] ?? "?";
    const svcFullKo = fullKo("svc", svcId);
    const nsFullKo = fullKo("ns", nsId);
    const svcKo = displayValue("svc", svcId, svcIdx).shortKo;
    const nsKo = displayValue("ns", nsId, nsIdx).shortKo;
    const envKo = fullKo("env", envId);
    const regionKo = displayValue("region", regionId, regionIdx).shortKo;

    return {
      pos: i + 1,
      addr,
      envId,
      envKo,
      regionId,
      regionKo,
      svcId,
      svcKo,
      svcFullKo,
      nsId,
      nsKo,
      nsFullKo,
      label: `${svcKo}/${nsKo}`,
      title: `${envId}/${regionId}/${svcId}/${nsId} · service:v1:${addr}`,
    };
  });
}
