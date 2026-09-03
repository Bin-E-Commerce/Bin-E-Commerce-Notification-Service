import { Module } from "@nestjs/common";
import { EmailService } from "./application/services/email.service";

@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
