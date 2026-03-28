import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
} from "@nestjs/common";
import { AxisHttpError } from "./axis.service.js";

@Catch(AxisHttpError)
export class AxisExceptionFilter implements ExceptionFilter {
  catch(exception: AxisHttpError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<{
      status(code: number): { send(body: unknown): unknown };
    }>();

    return response.status(exception.status).send(exception.body);
  }
}
