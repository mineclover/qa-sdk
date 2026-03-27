import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
} from "@nestjs/common";
import { ServiceModuleHttpError } from "./service-topology.service.js";

@Catch(ServiceModuleHttpError)
export class ServiceExceptionFilter implements ExceptionFilter {
  catch(exception: ServiceModuleHttpError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<{
      status(code: number): { send(body: unknown): unknown };
    }>();

    return response.status(exception.status).send(exception.body);
  }
}
