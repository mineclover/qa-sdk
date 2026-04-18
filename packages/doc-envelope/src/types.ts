/**
 * Docs control-plane 계약.
 *
 * Repository 파일이 계속 SSOT다. 이 모듈은 definition docs, PRD, ralph JSON,
 * session, evidence 등 문서형 입력을 원본 schema 병합 없이 조정하기 위한
 * read/index envelope만 정의한다.
 */

export type DocumentMetadata = Readonly<Record<string, unknown>>;

export interface DocumentRawSourcePointer {
  /** repository 상대 경로, 절대 경로, 또는 adapter가 소유한 source path. */
  readonly path: string;
  /** Markdown marker나 JSON pointer 같은 source-local locator. */
  readonly pointer?: string;
  /** adapter/source schema 식별자. control plane은 이 값을 해석하지 않는다. */
  readonly sourceSchema?: string;
  readonly metadata: DocumentMetadata;
}

export interface DocumentLink {
  /** source가 소유한 relation label. 이 계약은 link vocabulary를 새로 만들지 않는다. */
  readonly type: string;
  readonly targetId: string;
  readonly sourceId?: string;
  readonly targetAdapterId?: string;
  readonly metadata: DocumentMetadata;
}

export interface DocumentSource {
  readonly id: string;
  readonly path?: string;
  readonly label?: string;
  readonly rawSource?: DocumentRawSourcePointer;
  readonly metadata: DocumentMetadata;
}

export interface DocumentSection {
  readonly id: string;
  readonly title?: string;
  readonly anchor?: string;
  readonly content?: string;
  readonly order?: number;
  readonly rawSource?: DocumentRawSourcePointer;
  readonly metadata: DocumentMetadata;
}

export interface DocumentTask {
  readonly id: string;
  readonly title: string;
  /** source가 소유한 status 문자열. adapter는 원본 task schema를 보존한다. */
  readonly status?: string;
  readonly evidenceIds: readonly string[];
  readonly rawSource?: DocumentRawSourcePointer;
  readonly metadata: DocumentMetadata;
}

export interface DocumentEvidence {
  readonly id: string;
  /** source가 소유한 evidence kind. 새 control-plane taxonomy가 아니다. */
  readonly kind?: string;
  readonly summary?: string;
  readonly rawSource?: DocumentRawSourcePointer;
  readonly metadata: DocumentMetadata;
}

export interface DocumentDiagnostic {
  readonly code: string;
  /** 기존 diagnostic을 보존하기 위한 source-owned severity 문자열. */
  readonly severity: string;
  readonly message: string;
  readonly rawSource?: DocumentRawSourcePointer;
  readonly metadata: DocumentMetadata;
}

export interface DocumentChange {
  readonly id?: string;
  readonly description: string;
  readonly rawSource: DocumentRawSourcePointer;
  readonly patch?: string;
  readonly metadata: DocumentMetadata;
}

export interface DocumentChangeSet {
  readonly adapterId: string;
  readonly stableId: string;
  readonly familyId?: string;
  readonly summary?: string;
  readonly changes: readonly DocumentChange[];
  readonly diagnostics: readonly DocumentDiagnostic[];
  readonly metadata: DocumentMetadata;
}

export interface DocumentEnvelope {
  readonly adapterId: string;
  readonly kind: string;
  readonly stableId: string;
  readonly familyId?: string;
  readonly path: string;
  readonly metadata: DocumentMetadata;
  readonly links: readonly DocumentLink[];
  readonly sources: readonly DocumentSource[];
  readonly sections: readonly DocumentSection[];
  readonly tasks: readonly DocumentTask[];
  readonly evidence: readonly DocumentEvidence[];
  readonly diagnostics: readonly DocumentDiagnostic[];
  readonly rawSource: DocumentRawSourcePointer;
}

export interface DocumentCollectionQuery {
  readonly kind?: string;
  readonly stableIds?: readonly string[];
  readonly familyId?: string;
  readonly paths?: readonly string[];
  readonly metadata?: DocumentMetadata;
}

export interface DocumentAdapterCapabilities {
  /** adapter가 DocumentChangeSet 출력을 명시적으로 materialize할 수 있을 때만 true. */
  readonly write: boolean;
  /** adapter가 source-owned document shape 간 변환을 수행할 수 있을 때만 true. */
  readonly transform: boolean;
}

export type DocumentAdapterCapabilityDeclaration =
  Partial<DocumentAdapterCapabilities>;

export interface DocumentAdapter {
  readonly id: string;
  readonly capabilities: DocumentAdapterCapabilities;
  listDocuments(query?: DocumentCollectionQuery): Promise<readonly DocumentEnvelope[]>;
  getDocument(stableId: string): Promise<DocumentEnvelope | null>;
}

export type RawSourcePointerInput =
  Omit<DocumentRawSourcePointer, "metadata"> & {
    readonly metadata?: DocumentMetadata | null;
  };

export type DocumentLinkInput =
  Omit<DocumentLink, "metadata"> & {
    readonly metadata?: DocumentMetadata | null;
  };

export type DocumentSourceInput =
  Omit<DocumentSource, "metadata" | "rawSource"> & {
    readonly rawSource?: RawSourcePointerInput | null;
    readonly metadata?: DocumentMetadata | null;
  };

export type DocumentSectionInput =
  Omit<DocumentSection, "metadata" | "rawSource"> & {
    readonly rawSource?: RawSourcePointerInput | null;
    readonly metadata?: DocumentMetadata | null;
  };

export type DocumentTaskInput =
  Omit<DocumentTask, "metadata" | "rawSource" | "evidenceIds"> & {
    readonly evidenceIds?: readonly string[] | null;
    readonly rawSource?: RawSourcePointerInput | null;
    readonly metadata?: DocumentMetadata | null;
  };

export type DocumentEvidenceInput =
  Omit<DocumentEvidence, "metadata" | "rawSource"> & {
    readonly rawSource?: RawSourcePointerInput | null;
    readonly metadata?: DocumentMetadata | null;
  };

export type DocumentDiagnosticInput =
  Omit<DocumentDiagnostic, "metadata" | "rawSource"> & {
    readonly rawSource?: RawSourcePointerInput | null;
    readonly metadata?: DocumentMetadata | null;
  };

export interface DocumentEnvelopeInput {
  readonly adapterId: string;
  readonly kind: string;
  readonly stableId: string;
  readonly familyId?: string | null;
  readonly path: string;
  readonly metadata?: DocumentMetadata | null;
  readonly links?: readonly DocumentLinkInput[] | null;
  readonly sources?: readonly DocumentSourceInput[] | null;
  readonly sections?: readonly DocumentSectionInput[] | null;
  readonly tasks?: readonly DocumentTaskInput[] | null;
  readonly evidence?: readonly DocumentEvidenceInput[] | null;
  readonly diagnostics?: readonly DocumentDiagnosticInput[] | null;
  readonly rawSource: RawSourcePointerInput;
}
