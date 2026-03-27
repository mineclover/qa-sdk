import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
} from "@nestjs/common";
import { CatalogHttpError } from "./catalog.service.js";

@Catch(CatalogHttpError)
export class CatalogExceptionFilter implements ExceptionFilter {
  catch(exception: CatalogHttpError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<{
      status(code: number): { send(body: unknown): unknown };
    }>();

    return response.status(exception.status).send(exception.body);
  }
}
