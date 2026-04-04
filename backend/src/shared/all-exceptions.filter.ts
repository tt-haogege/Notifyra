import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const err = exception.getResponse();
      message =
        typeof err === 'string'
          ? err
          : ((err as { message?: string | string[] }).message?.toString() ??
            exception.message);
    }

    // 4xx → 客户端错误, 5xx → 服务器错误
    const code = status >= HttpStatus.INTERNAL_SERVER_ERROR ? 500 : status;

    this.logger.error(
      `[${status}] ${message}`,
      exception instanceof Error ? exception.stack : '',
    );

    response.status(status).json({
      code,
      data: null,
      message,
    });
  }
}
