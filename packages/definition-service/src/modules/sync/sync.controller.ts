import { Controller, Get, Post, Inject, NotFoundException } from "@nestjs/common";
import { SyncService } from "./sync.service.js";

@Controller("sync")
export class SyncController {
  constructor(@Inject(SyncService) private readonly sync: SyncService) {}

  @Post()
  async run() {
    return this.sync.run();
  }

  @Get()
  status() {
    const result = this.sync.getLastResult();
    if (!result) throw new NotFoundException("아직 동기화 실행 이력 없음");
    return result;
  }
}
