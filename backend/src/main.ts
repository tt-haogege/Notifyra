import { NestFactory } from '@nestjs/core';
import { json } from 'express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { TransformInterceptor } from './shared/response.interceptor';
import { AllExceptionsFilter } from './shared/all-exceptions.filter';
import 'dotenv/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.use(json({ limit: '5mb' }));

  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
