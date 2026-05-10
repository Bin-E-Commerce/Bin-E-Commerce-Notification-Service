import { NestFactory } from "@nestjs/core";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Transport } from "@nestjs/microservices";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
  });

  app.getHttpAdapter().getInstance().set("trust proxy", 1);

  const config = app.get(ConfigService);
  const port = config.get<number>("PORT", 3006);
  const brokers = config
    .get<string>("KAFKA_BROKERS", "localhost:9092")
    .split(",")
    .map((broker) => broker.trim())
    .filter(Boolean);

  app.connectMicroservice({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: "notification-service",
        brokers,
      },
      consumer: {
        groupId: "notification-service",
      },
    },
  });

  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableCors({ origin: false });

  if (config.get<string>("NODE_ENV") !== "production") {
    const doc = new DocumentBuilder()
      .setTitle("Notification Service")
      .setVersion("1.0")
      .build();
    SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, doc));
  }

  app.enableShutdownHooks();

  await app.startAllMicroservices();
  await app.listen(port);
  console.log(`[notification-service] Running on port ${port}`);
}

bootstrap();
