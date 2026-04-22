// @def.boundary sim-auth-api
// @def.doc authorization-ontology-bitmap-pipeline

import { Body, Controller, NotFoundException, Post } from "@nestjs/common";
import { z } from "zod";
import { BitmapIssuerService } from "./bitmap-issuer.service.js";

const issueSchema = z.object({ userId: z.string().min(1) });

@Controller("bitmap")
export class BitmapController {
  constructor(private readonly issuer: BitmapIssuerService) {}

  /**
   * POST /bitmap/issue
   * 요청: { userId }
   * 응답: { prefix, v, maskBase64, issuedAt, expiresAt, issuer, signature }
   *   - maskBase64는 VersionedBitmap.mask(Uint8Array)를 base64 인코딩한 문자열.
   *     §2 bitmap-pipeline §3 (저장·전달) — JWT embed 대비 표준 명칭.
   */
  @Post("issue")
  async issue(@Body() body: unknown) {
    const { userId } = issueSchema.parse(body);
    const bm = await this.issuer.issueForUser(userId);
    if (!bm) throw new NotFoundException(`User not found: ${userId}`);
    return {
      prefix: bm.prefix,
      v: bm.v,
      maskBase64: Buffer.from(bm.mask).toString("base64"),
      issuedAt: bm.issuedAt,
      expiresAt: bm.expiresAt,
      issuer: bm.issuer,
      signature: bm.signature,
    };
  }
}
