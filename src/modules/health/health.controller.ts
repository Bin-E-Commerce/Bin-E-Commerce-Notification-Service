import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectConnection } from "@nestjs/mongoose";
import type { Connection } from "mongoose";

@Controller("health")
export class HealthController {
  constructor(
    private readonly config: ConfigService,
    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  @Get()
  check() {
    const mongoStatus = this.mongoStatus();
    const smtpConfigured = Boolean(
      this.config.get<string>("SMTP_USER") &&
        this.config.get<string>("SMTP_PASSWORD"),
    );

    return {
      status: mongoStatus === "up" && smtpConfigured ? "ok" : "degraded",
      service: "notification-service",
      version: this.config.get<string>("APP_VERSION", "1.0.0"),
      environment: this.config.get<string>("NODE_ENV", "development"),
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      checks: {
        http: { status: "ok" },
        kafka: {
          status: "configured",
          brokers: this.config
            .get<string>("KAFKA_BROKERS", "localhost:9092")
            .split(",")
            .map((broker) => broker.trim())
            .filter(Boolean),
        },
        mongodb: {
          status: mongoStatus,
          name: this.connection.name,
          host: this.connection.host,
        },
        smtp: {
          status: smtpConfigured ? "configured" : "missing_credentials",
          host: this.config.get<string>("SMTP_HOST", "smtp.gmail.com"),
          port: this.config.get<number>("SMTP_PORT", 587),
        },
        memory: this.memoryUsage(),
      },
    };
  }

  private mongoStatus(): "up" | "down" | "connecting" | "disconnecting" {
    switch (this.connection.readyState) {
      case 1:
        return "up";
      case 2:
        return "connecting";
      case 3:
        return "disconnecting";
      default:
        return "down";
    }
  }

  private memoryUsage() {
    const usage = process.memoryUsage();
    return {
      status: "ok",
      rssMb: Math.round(usage.rss / 1024 / 1024),
      heapUsedMb: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(usage.heapTotal / 1024 / 1024),
    };
  }
}
