import {
  Controller,
  Get,
  Inject,
  Param,
  UseFilters,
} from "@nestjs/common";
import { badRequest, noActiveVersion } from "../../lib/errors.js";
import { PrefixExceptionFilter } from "../prefixes/prefix.exception-filter.js";
import { ResolveService } from "./resolve.service.js";

@UseFilters(new PrefixExceptionFilter())
@Controller()
export class ResolveController {
  constructor(@Inject(ResolveService) private readonly resolveService: ResolveService) {}

  @Get("resolve/active")
  resolveAllActive() {
    return this.resolveService.resolveAllActive();
  }

  @Get("resolve/active/:prefix")
  async getActive(@Param("prefix") prefix: string) {
    const active = await this.resolveService.getActive(prefix);
    if (!active) {
      throw noActiveVersion(prefix);
    }
    return active;
  }

  @Get("resolve/manifest")
  resolveManifest() {
    return this.resolveService.resolveManifest();
  }

  @Get("inspect/:prefix/:versionId/meta")
  inspectMeta(@Param("prefix") prefix: string, @Param("versionId") versionId: string) {
    return this.resolveService.inspectMeta(prefix, versionId);
  }

  @Get("inspect/:prefix/:versionId/keys")
  inspectKeys(@Param("prefix") prefix: string, @Param("versionId") versionId: string) {
    return this.resolveService.inspectKeys(prefix, versionId);
  }

  @Get("inspect/:prefix/:versionId/value/:address")
  inspectValue(
    @Param("prefix") prefix: string,
    @Param("versionId") versionId: string,
    @Param("address") address: string,
  ) {
    const parsedAddress = Number(address);
    if (!Number.isFinite(parsedAddress) || parsedAddress < 0) {
      throw badRequest(`유효하지 않은 주소: ${address}`);
    }
    return this.resolveService.inspectValue(prefix, versionId, parsedAddress);
  }
}
