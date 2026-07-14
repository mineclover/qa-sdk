// @def.boundary sim-auth-api
// @def.doc authorization-ontology-bitmap-pipeline

import { Body, Controller, Inject, Post, UseFilters } from '@nestjs/common';
import { z } from 'zod';
import { DomainExceptionFilter } from '@qa-sdk/sim-domain-slice-kit';
import { BitmapIssueQuery } from '../../application/queries/bitmap-issue.query.js';
import { UserNotFoundForBitmapException } from '../../domain/index.js';
import type { BitmapIssueWireResult } from '../../domain/index.js';

const issueSchema = z.object({ userId: z.string().min(1) });

/**
 * POST /bitmap/issue
 * 요청: { userId }
 * 응답: { prefix, v, maskBase64, issuedAt, expiresAt, issuer, signature }
 *   - maskBase64는 VersionedBitmap.mask(Uint8Array)를 base64 인코딩한 문자열.
 *
 * Read-mostly 슬라이스 — read-model query (BitmapIssueQuery) 만 호출.
 */
@Controller('bitmap')
@UseFilters(DomainExceptionFilter)
export class BitmapController {
  constructor(@Inject(BitmapIssueQuery) private readonly issuer: BitmapIssueQuery) {}

  @Post('issue')
  async issue(@Body() body: unknown): Promise<BitmapIssueWireResult> {
    const { userId } = issueSchema.parse(body);
    const bm = await this.issuer.issueForUser(userId);
    if (!bm) throw new UserNotFoundForBitmapException(userId);
    return {
      prefix: bm.prefix,
      v: bm.v,
      maskBase64: Buffer.from(bm.mask).toString('base64'),
      issuedAt: bm.issuedAt,
      expiresAt: bm.expiresAt,
      issuer: bm.issuer,
      signature: bm.signature,
    };
  }
}
