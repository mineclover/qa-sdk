import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
} from "@nestjs/common";
import { DashboardHttpError } from "./dashboard-http-error.js";

@Catch(DashboardHttpError)
export class DashboardExceptionFilter implements ExceptionFilter {
  catch(exception: DashboardHttpError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<{
      status(code: number): { send(body: unknown): unknown };
    }>();

    return response.status(exception.status).send(exception.body);
  }
}
