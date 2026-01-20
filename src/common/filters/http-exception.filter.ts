import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const responseBody =
      exception instanceof HttpException ? exception.getResponse() : null;

    const message =
      typeof responseBody === 'string'
        ? responseBody
        : (responseBody as any)?.message || 'Internal server error';

    const error =
      typeof responseBody === 'object' && responseBody
        ? (responseBody as any)?.error
        : undefined;

    const requestId = (request as any).requestId;

    const payload = {
      statusCode: status,
      message,
      error,
      path: request.url,
      method: request.method,
      timestamp: new Date().toISOString(),
      requestId,
    };

    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} - ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`[${request.method}] ${request.url} - ${message}`);
    }

    response.status(status).json(payload);
  }
}
