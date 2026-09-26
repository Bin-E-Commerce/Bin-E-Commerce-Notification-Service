import { Module } from '@nestjs/common';
import { EmailService } from '@/modules/email/application/services/email.service';

@Module({
    providers: [EmailService],
    exports: [EmailService],
})
export class EmailModule {}
