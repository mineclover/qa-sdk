import { PrefixDecoder } from "index-meta";
import type { PrefixDecoderConfig, DecodeMap } from "index-meta";

interface CacheEntry {
  decoder: PrefixDecoder;
  loadedAt: number;
}

/**
 * prefix/version별 PrefixDecoder 인스턴스 캐시.
 *
 * DecodeMap 번들을 외부에서 주입하여 decoder를 생성·캐싱한다.
 * TTL 만료 시 다음 접근에서 재생성한다.
 */
export class DecoderPool {
  private readonly _cache = new Map<string, CacheEntry>();
  private readonly _ttlMs: number;

  constructor(ttlMs: number = 60_000) {
    this._ttlMs = ttlMs;
  }

  private _key(prefix: string, version: string): string {
    return `${prefix}:${version}`;
  }

  /** decoder 등록 (외부에서 DecodeMap 번들 제공) */
  load(config: PrefixDecoderConfig): PrefixDecoder {
    const decoder = new PrefixDecoder(config);
    const key = this._key(decoder.indexId, decoder.versionId);
    this._cache.set(key, { decoder, loadedAt: Date.now() });
    return decoder;
  }

  /** DecodeMap으로 직접 등록 (refs 없이) */
  loadMap(map: DecodeMap): PrefixDecoder {
    return this.load({ map });
  }

  /** decoder 조회. TTL 만료 시 null 반환. */
  get(prefix: string, version: string): PrefixDecoder | null {
    const key = this._key(prefix, version);
    const entry = this._cache.get(key);
    if (!entry) return null;

    if (this._ttlMs > 0 && Date.now() - entry.loadedAt > this._ttlMs) {
      this._cache.delete(key);
      return null;
    }

    return entry.decoder;
  }

  /** 캐시된 모든 prefix/version 목록 */
  keys(): string[] {
    return [...this._cache.keys()];
  }

  /** 캐시된 모든 decoder 반환 (TTL 만료 항목은 제거 후 제외) */
  *values(): IterableIterator<PrefixDecoder> {
    const now = Date.now();
    for (const [key, entry] of this._cache) {
      if (this._ttlMs > 0 && now - entry.loadedAt > this._ttlMs) {
        this._cache.delete(key);
        continue;
      }
      yield entry.decoder;
    }
  }

  /** 특정 decoder 제거 */
  evict(prefix: string, version: string): boolean {
    return this._cache.delete(this._key(prefix, version));
  }

  /** 전체 캐시 초기화 */
  clear(): void {
    this._cache.clear();
  }

  get size(): number {
    return this._cache.size;
  }
}
