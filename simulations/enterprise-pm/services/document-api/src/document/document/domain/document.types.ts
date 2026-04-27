// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import type { DocumentId, OwnerId, ProjectId } from "./document.ids.js";

/** 도메인 entity 의 내부 props (불변, branded ids). */
export interface DocumentProps {
  readonly id: DocumentId;
  readonly projectId: ProjectId;
  readonly title: string;
  readonly currentVersion: number;
  readonly ownerId: OwnerId;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** 영속/와이어 직렬화 형 — branding 제거, ISO 문자열. */
export interface DocumentSnapshot {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly currentVersion: number;
  readonly ownerId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}
