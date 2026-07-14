import { describe, expect, it } from 'vitest';
import { CONTENT_TYPE_AXIS, CONTENT_TYPE_IDS, getContentTypeEntry } from './content-types.js';
import { createPromoGridComposition } from './presets.js';
import {
  serializeMotionComposition,
  parseMotionComposition,
  validateMotionComposition,
  MOTION_COMPOSITION_SCHEMA_V1,
} from './io.js';

describe('콘텐츠 타입 축', () => {
  it('5종 타입이 등록되어 있다', () => {
    expect(CONTENT_TYPE_IDS).toEqual(['dom', 'image', 'video', 'svg', 'canvas']);
    expect(CONTENT_TYPE_AXIS).toHaveLength(5);
  });

  it('각 타입에 id/label/description이 있다', () => {
    for (const entry of CONTENT_TYPE_AXIS) {
      expect(entry.id).toBeTruthy();
      expect(entry.label).toBeTruthy();
      expect(entry.description).toBeTruthy();
    }
  });

  it('image 타입은 src 필수, alt/objectFit 선택', () => {
    const image = getContentTypeEntry('image');
    expect(image).toBeDefined();
    const srcProp = image!.properties.find((p) => p.key === 'src');
    expect(srcProp?.required).toBe(true);
    const altProp = image!.properties.find((p) => p.key === 'alt');
    expect(altProp?.required).toBe(false);
    const fitProp = image!.properties.find((p) => p.key === 'objectFit');
    expect(fitProp?.options).toEqual(['cover', 'contain', 'fill', 'none']);
  });

  it('video 타입은 src 필수, poster/muted/loop 선택', () => {
    const video = getContentTypeEntry('video');
    expect(video).toBeDefined();
    expect(video!.properties.find((p) => p.key === 'src')?.required).toBe(true);
    expect(video!.properties.find((p) => p.key === 'poster')?.required).toBe(false);
    expect(video!.properties.find((p) => p.key === 'muted')?.type).toBe('boolean');
  });

  it('dom 타입은 속성이 없다', () => {
    const dom = getContentTypeEntry('dom');
    expect(dom!.properties).toHaveLength(0);
  });

  it('preset의 다양한 콘텐츠 타입이 라운드트립을 통과한다', () => {
    const comp = createPromoGridComposition();
    const json = serializeMotionComposition(comp);
    const parsed = parseMotionComposition(json);

    const cardA = parsed.layers.find((l) => l.id === 'card-a');
    expect(cardA?.content).toMatchObject({ type: 'image', src: '/assets/card-a.png' });

    const cardB = parsed.layers.find((l) => l.id === 'card-b');
    expect(cardB?.content).toMatchObject({ type: 'svg', viewBox: '0 0 240 160' });

    const chip = parsed.layers.find((l) => l.id === 'chip');
    expect(chip?.content).toMatchObject({ type: 'dom' });
  });

  it('축에 없는 콘텐츠 타입은 검증 실패한다', () => {
    const comp = createPromoGridComposition();
    const broken = {
      ...comp,
      layers: [{ ...comp.layers[0], content: { type: 'webgl' } }, ...comp.layers.slice(1)],
    };
    const issues = validateMotionComposition(broken);
    expect(issues.some((i) => i.includes('webgl'))).toBe(true);
  });

  it('image content에서 src가 빠지면 검증 실패한다', () => {
    const comp = createPromoGridComposition();
    const broken = {
      ...comp,
      layers: comp.layers.map((l) =>
        l.id === 'card-a' ? Object.assign({}, l, { content: { type: 'image' } }) : l,
      ),
    };
    const issues = validateMotionComposition(broken);
    expect(issues.some((i) => i.includes('src') && i.includes('필수'))).toBe(true);
  });
});
