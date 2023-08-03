import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { APP_PORT, APP_VERSION } from './env';
import { LoggingInterceptor } from './logger/logging.interceptor';
import { DtoValidationPipe } from './validation/dto-validation.pipe';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    app.enableShutdownHooks();
    app.disable('x-powered-by');
    app.enableCors();
    app.useGlobalPipes(new DtoValidationPipe());
    app.useGlobalInterceptors(new LoggingInterceptor());

    const config = new DocumentBuilder().setTitle('Wagmi').setDescription('Wagmi api description').setVersion(APP_VERSION).build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('doc', app, document);

    await app.listen(APP_PORT);
}
bootstrap();
