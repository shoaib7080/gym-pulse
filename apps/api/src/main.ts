import { NestFactory } from '@nestjs/core';
import { API_PREFIX } from '@gympulse/shared';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix(API_PREFIX);

  // Security headers middleware
  app.use((_req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Request correlation middleware
  app.use(new RequestIdMiddleware().use);

  // Request body payload limits
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  // Global exception filter with standardized error shape & requestId
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Graceful shutdown hooks
  app.enableShutdownHooks();

  // Trusted CORS origins configuration
  const rawOrigins = process.env.TRUSTED_ORIGINS;
  const trustedOrigins = rawOrigins
    ? rawOrigins.split(',').map((o) => o.trim())
    : [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
      ];

  app.enableCors({
    origin: trustedOrigins,
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}/${API_PREFIX}`);
}

bootstrap();
