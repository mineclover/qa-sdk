import { Controller, Get, Post, Inject, NotFoundException } from "@nestjs/common";
import { SyncService } from "./sync.service.js";

@Controller("sync")
export class SyncController {
  constructor(@Inject(SyncService) private readonly sync: SyncService) {}

  /** file → DB 동기화 */
  @Post()
  async run() {
    return this.sync.run();
  }

  /** DB → file 역동기화 (메타데이터를 frontmatter에 기록) */
  @Post("to-files")
  async runReverse() {
    return this.sync.runReverse();
  }

  @Get()
  status() {
    const result = this.sync.getLastResult();
    if (!result) throw new NotFoundException("아직 동기화 실행 이력 없음");
    return result;
  }

  @Get("to-files")
  reverseStatus() {
    const result = this.sync.getLastReverseResult();
    if (!result) throw new NotFoundException("아직 역동기화 실행 이력 없음");
    return result;
  }
}
