import { NestFactory } from '@nestjs/core';
import { API_PREFIX } from '@gympulse/shared';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix(API_PREFIX);
  app.enableCors({
    origin: ['http://localhost:5173'],
    credentials: true,
  });
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}/${API_PREFIX}`);
}
bootstrap();
