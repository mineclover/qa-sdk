// @def.boundary sim-auth-api
// 시뮬용 monotonic counter — production catalog API와 분리 (spec §9 Stage 3).
//
// prefix별 stable version을 1부터 시작하는 정수로 관리하고, bump마다 retired 누적.
// VersionTag grammar로 round-trip 검증해 식별자 일관성 보장.
import { Injectable, Optional } from "@nestjs/common";
import { buildVersionTag, parseVersionTag } from "sim-identifier-grammar";

export interface BumpResult {
  /** 대상 prefix (예: "sim.bitmap"). */
  prefix: string;
  /** bump 직전 stable VersionTag (예: "v1"). */
  oldVersion: string;
  /** bump 직후 stable VersionTag (예: "v2"). */
  newVersion: string;
  /** ISO-8601 bump 시각. */
  bumpedAt: string;
}

export interface BitmapVersionServiceOptions {
  /** 결정론적 테스트용 시계 주입. */
  nowImpl?: () => Date;
}

interface PrefixState {
  current: number;
  retired: number[];
}

@Injectable()
export class BitmapVersionService {
  private readonly state = new Map<string, PrefixState>();
  private readonly now: () => Date;

  constructor(@Optional() opts?: BitmapVersionServiceOptions) {
    this.now = opts?.nowImpl ?? (() => new Date());
  }

  /** 현재 stable VersionTag 반환. lazy 초기화. */
  getCurrent(prefix: string): string {
    return this.tagOf(this.ensure(prefix).current);
  }

  /** stable → retired, 새 stable += 1. */
  bump(prefix: string): BumpResult {
    const s = this.ensure(prefix);
    const oldValue = s.current;
    s.retired.push(oldValue);
    s.current = oldValue + 1;
    const old = this.tagOf(oldValue);
    const next = this.tagOf(s.current);
    // grammar round-trip 검증 — 식별자 형식 invariant 보장.
    parseVersionTag(old);
    parseVersionTag(next);
    return {
      prefix,
      oldVersion: old,
      newVersion: next,
      bumpedAt: this.now().toISOString(),
    };
  }

  /** retired VersionTag 누적 목록. */
  listRetired(prefix: string): string[] {
    return this.ensure(prefix).retired.map((v) => this.tagOf(v));
  }

  private tagOf(value: number): string {
    return buildVersionTag({ axis: "version", value, state: "stable" });
  }

  private ensure(prefix: string): PrefixState {
    let s = this.state.get(prefix);
    if (!s) {
      s = { current: 1, retired: [] };
      this.state.set(prefix, s);
    }
    return s;
  }
}
