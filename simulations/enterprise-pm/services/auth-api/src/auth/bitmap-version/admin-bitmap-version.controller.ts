// @def.boundary sim-auth-api
// spec §9 응답 shape SSOT + spec §3 InternalIpGuard + spec §11 RFC 7807.
//
// 시뮬용 admin endpoint 2종:
//   POST /admin/bitmap/bump-version  body: { prefix?: string }
//   GET  /admin/bitmap/version?prefix=...
// 외부 IP는 InternalIpGuard에 의해 404 silent.
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { InternalIpGuard } from "sim-internal-network";
import { BitmapVersionService } from "./bitmap-version.service.js";

const DEFAULT_PREFIX = "sim.bitmap";

const PrefixSchema = z
  .string()
  .min(1, { message: "prefix는 빈 문자열일 수 없다" })
  .regex(/^[a-z][a-z0-9.\-_]*$/, {
    message: "prefix는 소문자/숫자/.-_만 허용",
  });

const BumpBodySchema = z.object({ prefix: PrefixSchema.optional() }).strict();
const VersionQuerySchema = z
  .object({ prefix: PrefixSchema.optional() })
  .strict();

@Controller("admin/bitmap")
@UseGuards(InternalIpGuard)
export class AdminBitmapVersionController {
  // vitest 환경은 emitDecoratorMetadata 를 무시하므로 @Inject 토큰을 명시한다.
  constructor(
    @Inject(BitmapVersionService)
    private readonly service: BitmapVersionService,
  ) {}

  @Get("version")
  getVersion(@Query() raw: unknown) {
    const q = parse(VersionQuerySchema, raw, "query");
    const prefix = q.prefix ?? DEFAULT_PREFIX;
    return { prefix, version: this.service.getCurrent(prefix) };
  }

  @Post("bump-version")
  bumpVersion(@Body() raw: unknown) {
    const body = parse(BumpBodySchema, raw ?? {}, "body");
    return this.service.bump(body.prefix ?? DEFAULT_PREFIX);
  }
}

function parse<T>(schema: z.ZodSchema<T>, input: unknown, where: string): T {
  const r = schema.safeParse(input);
  if (r.success) return r.data;
  throw new BadRequestException({
    type: "https://qa-sdk.dev/errors/validation",
    title: "Bad Request",
    status: 400,
    detail: `${where} validation failed: ${r.error.issues
      .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("; ")}`,
  });
}
