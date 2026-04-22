// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { Body, Controller, NotFoundException, Post } from "@nestjs/common";
import { z } from "zod";
import { BitmapIssuerService } from "./bitmap-issuer.service.js";

const issueSchema = z.object({ userId: z.string().min(1) });

@Controller("bitmap")
export class BitmapController {
  constructor(private readonly issuer: BitmapIssuerService) {}

  @Post("issue")
  async issue(@Body() body: unknown) {
    const { userId } = issueSchema.parse(body);
    const bm = await this.issuer.issueForUser(userId);
    if (!bm) throw new NotFoundException(`User not found: ${userId}`);
    return {
      ...bm,
      mask: Buffer.from(bm.mask).toString("base64"),
    };
  }
}
