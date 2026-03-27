import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
} from "@nestjs/common";
import { EventHttpError } from "./event-http-error.js";

@Catch(EventHttpError)
export class EventExceptionFilter implements ExceptionFilter {
  catch(exception: EventHttpError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<{
      status(code: number): { send(body: unknown): unknown };
    }>();

    return response.status(exception.status).send(exception.body);
  }
}
