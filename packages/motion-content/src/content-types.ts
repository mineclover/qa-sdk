// @def.boundary motion-content-system
import type { MotionLayerContentType } from './model.js';

/** 콘텐츠 타입 속성의 자료형 */
export type ContentPropertyType = 'string' | 'number' | 'boolean';

/** 콘텐츠 타입 속성 정의 */
export interface ContentPropertyDef {
  readonly key: string;
  readonly label: string;
  readonly type: ContentPropertyType;
  readonly required: boolean;
  /** enum 제한이 있으면 허용 값 목록 */
  readonly options?: readonly string[];
}

/** 콘텐츠 타입 축 엔트리 — 각 타입의 메타데이터와 속성 스키마 */
export interface ContentTypeEntry {
  readonly id: MotionLayerContentType;
  readonly label: string;
  readonly description: string;
  /** 타입별 속성 스키마. 검증과 편집기 UI에서 파생 */
  readonly properties: readonly ContentPropertyDef[];
}

/** 콘텐츠 타입 축 — 모든 레이어 콘텐츠 타입의 유일한 정의 */
export const CONTENT_TYPE_AXIS: readonly ContentTypeEntry[] = [
  {
    id: 'dom',
    label: 'DOM',
    description: '범용 DOM 요소. 텍스트/스타일 바인딩 대상',
    properties: [],
  },
  {
    id: 'image',
    label: '이미지',
    description: '정적 이미지 (img 요소)',
    properties: [
      { key: 'src', label: '소스 URL', type: 'string', required: true },
      { key: 'alt', label: '대체 텍스트', type: 'string', required: false },
      {
        key: 'objectFit',
        label: '맞춤',
        type: 'string',
        required: false,
        options: ['cover', 'contain', 'fill', 'none'],
      },
    ],
  },
  {
    id: 'video',
    label: '동영상',
    description: '동영상 요소 (video). 재생 동기화 대상',
    properties: [
      { key: 'src', label: '소스 URL', type: 'string', required: true },
      { key: 'poster', label: '포스터 이미지', type: 'string', required: false },
      { key: 'muted', label: '음소거', type: 'boolean', required: false },
      { key: 'loop', label: '반복', type: 'boolean', required: false },
    ],
  },
  {
    id: 'svg',
    label: 'SVG',
    description: 'SVG 벡터 그래픽',
    properties: [{ key: 'viewBox', label: 'viewBox', type: 'string', required: false }],
  },
  {
    id: 'canvas',
    label: '캔버스',
    description: 'Canvas 2D/WebGL 렌더링 대상',
    properties: [
      { key: 'width', label: '너비', type: 'number', required: false },
      { key: 'height', label: '높이', type: 'number', required: false },
    ],
  },
] as const;

/** id로 축 엔트리를 조회한다 */
export function getContentTypeEntry(typeId: MotionLayerContentType): ContentTypeEntry | undefined {
  return CONTENT_TYPE_AXIS.find((entry) => entry.id === typeId);
}

/** 모든 콘텐츠 타입 id 목록 */
export const CONTENT_TYPE_IDS: readonly MotionLayerContentType[] = CONTENT_TYPE_AXIS.map(
  (entry) => entry.id,
);
