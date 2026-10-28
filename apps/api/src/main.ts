import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true }); // rawBody: payment webhook signatures
  const config = app.get(ConfigService);

  app.use(helmet());
  app.use(cookieParser());
  const corsOrigins: (string | RegExp)[] = config.get<string>('CORS_ORIGINS', '').split(',').filter(Boolean);
  // Flutter web / local dev on any localhost port (opt-in).
  if (config.get<string>('CORS_ALLOW_LOCALHOST') === 'true') {
    corsOrigins.push(/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/);
  }
  app.enableCors({ origin: corsOrigins, credentials: true });

  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
  app.enableShutdownHooks();

  const swagger = new DocumentBuilder()
    .setTitle('E-Commerce API')
    .setDescription('Multi-vendor e-commerce platform REST API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));

  const port = config.get<number>('API_PORT', 4000);
  await app.listen(port);
  Logger.log(`API running on http://localhost:${port}/api/v1  (docs: /api/docs)`, 'Bootstrap');
}

void bootstrap();
