// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import { toDocumentId, toOwnerId, toProjectId } from './document.ids.js';
import { InvalidDocumentTitleException } from './document.exceptions.js';
import type { DocumentProps, DocumentSnapshot } from './document.types.js';

/**
 * Document Aggregate Root.
 *
 * - private constructor + named factories (create / rehydrate)
 * - 모든 상태 전이는 새 인스턴스 반환 (불변)
 * - invariant: title 비어 있으면 ValidationError
 */
export class DocumentEntity {
  private constructor(private readonly props: DocumentProps) {}

  static create(input: {
    readonly id: string;
    readonly projectId: string;
    readonly title: string;
    readonly ownerId: string;
    readonly now?: Date;
  }): DocumentEntity {
    if (input.title.trim().length === 0) {
      throw new InvalidDocumentTitleException();
    }
    const now = input.now ?? new Date();
    return new DocumentEntity({
      id: toDocumentId(input.id),
      projectId: toProjectId(input.projectId),
      title: input.title,
      currentVersion: 0,
      ownerId: toOwnerId(input.ownerId),
      createdAt: now,
      updatedAt: now,
    });
  }

  static rehydrate(snapshot: DocumentSnapshot): DocumentEntity {
    return new DocumentEntity({
      id: toDocumentId(snapshot.id),
      projectId: toProjectId(snapshot.projectId),
      title: snapshot.title,
      currentVersion: snapshot.currentVersion,
      ownerId: toOwnerId(snapshot.ownerId),
      createdAt: new Date(snapshot.createdAt),
      updatedAt: new Date(snapshot.updatedAt),
    });
  }

  /** 부분 업데이트 — title/projectId/ownerId 중 일부 변경 시 새 인스턴스. */
  update(
    patch: { readonly projectId?: string; readonly title?: string; readonly ownerId?: string },
    now = new Date(),
  ): DocumentEntity {
    if (patch.title !== undefined && patch.title.trim().length === 0) {
      throw new InvalidDocumentTitleException();
    }
    return new DocumentEntity({
      ...this.props,
      projectId:
        patch.projectId !== undefined ? toProjectId(patch.projectId) : this.props.projectId,
      title: patch.title ?? this.props.title,
      ownerId: patch.ownerId !== undefined ? toOwnerId(patch.ownerId) : this.props.ownerId,
      updatedAt: now,
    });
  }

  /** 새 버전 생성 시 currentVersion 증가. */
  incrementVersion(now = new Date()): DocumentEntity {
    return new DocumentEntity({
      ...this.props,
      currentVersion: this.props.currentVersion + 1,
      updatedAt: now,
    });
  }

  toSnapshot(): DocumentSnapshot {
    return {
      id: this.props.id,
      projectId: this.props.projectId,
      title: this.props.title,
      currentVersion: this.props.currentVersion,
      ownerId: this.props.ownerId,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
    };
  }

  get id(): string {
    return this.props.id;
  }

  get currentVersion(): number {
    return this.props.currentVersion;
  }

  get title(): string {
    return this.props.title;
  }
}
