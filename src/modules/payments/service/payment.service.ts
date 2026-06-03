import Stripe from 'stripe';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { prisma } from '../../../config/database/prisma.client';
import { env } from '../../../config/env';
import { DomainError, NotFoundError, InfrastructureError } from '../../../common/exceptions/errors';
import { OrderService } from '../../orders/service/order.service';
import { eventBus } from '../../../common/events/event-bus';
import { DomainEventType } from '../../../common/events/domain-events';
import { paymentLogger } from '../../../common/utils/logger';
import { PaymentProvider } from '@prisma/client';

export class PaymentService {
  private stripe: Stripe | null = null;
  private razorpay: Razorpay | null = null;
  private orderService = new OrderService();

  constructor() {
    if (env.STRIPE_SECRET_KEY) {
      this.stripe = new Stripe(env.STRIPE_SECRET_KEY);
    }
    if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
      this.razorpay = new Razorpay({
        key_id: env.RAZORPAY_KEY_ID,
        key_secret: env.RAZORPAY_KEY_SECRET,
      });
    }
  }

  async createPaymentIntent(orderId: string, provider: PaymentProvider) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundError('Order not found');
    if (order.status !== 'PAYMENT_PENDING') {
      throw new DomainError('Order is not awaiting payment');
    }

    const amount = Number(order.totalAmount);

    if (provider === 'STRIPE' && this.stripe) {
      const intent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: 'inr',
        metadata: { orderId },
      });

      const payment = await prisma.payment.create({
        data: {
          orderId,
          provider: 'STRIPE',
          transactionId: intent.id,
          status: 'PENDING',
          amount,
          metadata: { clientSecret: intent.client_secret },
        },
      });

      return { payment, clientSecret: intent.client_secret };
    }

    if (provider === 'RAZORPAY' && this.razorpay) {
      const razorpayOrder = await this.razorpay.orders.create({
        amount: Math.round(amount * 100),
        currency: 'INR',
        receipt: order.orderNumber,
      });

      const payment = await prisma.payment.create({
        data: {
          orderId,
          provider: 'RAZORPAY',
          transactionId: razorpayOrder.id,
          status: 'PENDING',
          amount,
          metadata: razorpayOrder as object,
        },
      });

      return { payment, razorpayOrderId: razorpayOrder.id };
    }

    throw new InfrastructureError('Payment provider not configured');
  }

  async handleStripeWebhook(rawBody: Buffer, signature: string) {
    if (!this.stripe || !env.STRIPE_WEBHOOK_SECRET) {
      throw new InfrastructureError('Stripe webhook not configured');
    }

    const event = this.stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as Stripe.PaymentIntent;
      await this.markPaymentSuccess(intent.metadata.orderId, intent.id, 'STRIPE');
    } else if (event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object as Stripe.PaymentIntent;
      await this.markPaymentFailed(intent.metadata.orderId, intent.id);
    }
  }

  async handleRazorpayWebhook(body: Record<string, unknown>, signature: string) {
    const expected = crypto
      .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET ?? '')
      .update(JSON.stringify(body))
      .digest('hex');

    if (signature !== expected) {
      throw new DomainError('Invalid webhook signature');
    }

    const event = body.event as string;
    const payload = body.payload as { payment: { entity: { order_id: string; id: string } } };

    if (event === 'payment.captured') {
      const payment = await prisma.payment.findFirst({
        where: { transactionId: payload.payment.entity.order_id },
      });
      if (payment) {
        await this.markPaymentSuccess(payment.orderId, payload.payment.entity.id, 'RAZORPAY');
      }
    }
  }

  private async markPaymentSuccess(orderId: string, transactionId: string, provider: PaymentProvider) {
    await prisma.payment.updateMany({
      where: { orderId },
      data: { status: 'SUCCESS', transactionId },
    });

    await this.orderService.transitionStatus(orderId, 'PAID');
    paymentLogger.info('Payment success', { orderId, transactionId, provider });

    await eventBus.publish({
      type: DomainEventType.PAYMENT_SUCCESS,
      payload: { orderId, transactionId },
      occurredAt: new Date(),
    });
  }

  private async markPaymentFailed(orderId: string, transactionId: string) {
    await prisma.payment.updateMany({
      where: { orderId },
      data: { status: 'FAILED', transactionId },
    });

    await this.orderService.transitionStatus(orderId, 'CANCELLED');

    await eventBus.publish({
      type: DomainEventType.PAYMENT_FAILED,
      payload: { orderId, transactionId },
      occurredAt: new Date(),
    });
  }

  async refund(paymentId: string, amount?: number) {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
    if (!payment) throw new NotFoundError('Payment not found');

    if (payment.provider === 'STRIPE' && this.stripe && payment.transactionId) {
      await this.stripe.refunds.create({
        payment_intent: payment.transactionId,
        amount: amount ? Math.round(amount * 100) : undefined,
      });
    }

    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'REFUNDED' },
    });

    return payment;
  }
}
