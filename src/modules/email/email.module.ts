import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EmailDeliveryService } from '@/modules/email/application/services/email-delivery.service';
import { EmailService } from '@/modules/email/application/services/email.service';
import {
    EmailDelivery,
    EmailDeliverySchema,
} from '@/modules/email/infrastructure/schemas/email-delivery.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: EmailDelivery.name, schema: EmailDeliverySchema },
        ]),
    ],
    providers: [EmailService, EmailDeliveryService],
    exports: [EmailService, EmailDeliveryService],
})
export class EmailModule {}
