import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes } from 'mongoose';

export type EmailDeliveryDocument = HydratedDocument<EmailDelivery>;

// Schema lưu riêng trạng thái gửi email để SMTP lỗi không làm mất khả năng retry.
@Schema({ collection: 'email_deliveries', timestamps: true })
export class EmailDelivery {
    @Prop({ required: true, unique: true, index: true })
    dedupeKey: string;

    @Prop({
        required: true,
        enum: [
            'SHIPMENT_STATUS',
            'ORDER_CREATED',
            'ORDER_CANCELLED',
            'RETURN_STATUS',
            'WALLET_FINANCE_STATUS',
        ],
    })
    kind:
        | 'SHIPMENT_STATUS'
        | 'ORDER_CREATED'
        | 'ORDER_CANCELLED'
        | 'RETURN_STATUS'
        | 'WALLET_FINANCE_STATUS';

    @Prop({ required: true })
    to: string;

    @Prop({ type: SchemaTypes.Mixed, required: true })
    payload: Record<string, unknown>;

    @Prop({ required: true, enum: ['PENDING', 'PROCESSING', 'SENT'] })
    status: 'PENDING' | 'PROCESSING' | 'SENT';

    @Prop({ required: true, default: 0 })
    attemptCount: number;

    @Prop({ required: true, index: true })
    availableAt: Date;

    @Prop({ type: Date, default: null })
    sentAt: Date | null;

    @Prop({ type: String, default: null })
    lastError: string | null;

    createdAt: Date;
    updatedAt: Date;
}

export const EmailDeliverySchema = SchemaFactory.createForClass(EmailDelivery);

EmailDeliverySchema.index({ status: 1, availableAt: 1, createdAt: 1 });
