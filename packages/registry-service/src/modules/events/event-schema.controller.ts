import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Put,
  Query,
  UseFilters,
} from "@nestjs/common";
import { EventExceptionFilter } from "./event.exception-filter.js";
import { EventSchemaService } from "./event-schema.service.js";

@UseFilters(new EventExceptionFilter())
@Controller("api/event-schemas")
export class EventSchemaController {
  constructor(@Inject(EventSchemaService) private readonly eventSchemas: EventSchemaService) {}

  @Get()
  list(@Query("catalog") catalogId?: string, @Query("service") serviceId?: string) {
    return this.eventSchemas.list(catalogId ?? "demo", serviceId);
  }

  @Get(":serviceId/:eventKey/:version")
  get(
    @Param("serviceId") serviceId: string,
    @Param("eventKey") eventKey: string,
    @Param("version") eventVersion: string,
    @Query("catalog") catalogId?: string,
  ) {
    return this.eventSchemas.get(catalogId ?? "demo", serviceId, eventKey, eventVersion);
  }

  @Get(":serviceId/:eventKey")
  listVersions(
    @Param("serviceId") serviceId: string,
    @Param("eventKey") eventKey: string,
    @Query("catalog") catalogId?: string,
  ) {
    return this.eventSchemas.listVersions(catalogId ?? "demo", serviceId, eventKey);
  }

  @Put(":serviceId/:eventKey/:version")
  upsert(
    @Param("serviceId") serviceId: string,
    @Param("eventKey") eventKey: string,
    @Param("version") eventVersion: string,
    @Query("catalog") catalogId: string | undefined,
    @Body() body: unknown,
  ) {
    return this.eventSchemas.upsert(catalogId ?? "demo", serviceId, eventKey, eventVersion, body);
  }

  @Delete(":serviceId/:eventKey/:version")
  remove(
    @Param("serviceId") serviceId: string,
    @Param("eventKey") eventKey: string,
    @Param("version") eventVersion: string,
    @Query("catalog") catalogId?: string,
  ) {
    return this.eventSchemas.remove(catalogId ?? "demo", serviceId, eventKey, eventVersion);
  }
}
