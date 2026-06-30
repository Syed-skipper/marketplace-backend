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
    paymentLogger.info('Creating payment intent', { orderId, provider });

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      paymentLogger.warn('Payment intent failed: order not found', { orderId, provider });
      throw new NotFoundError('Order not found');
    }
    if (order.status !== 'PAYMENT_PENDING') {
      paymentLogger.warn('Payment intent failed: invalid order status', {
        orderId,
        provider,
        status: order.status,
      });
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
      const existing = await prisma.payment.findFirst({
        where: { orderId, provider: 'RAZORPAY', status: 'PENDING' },
      });
      if (existing?.transactionId) {
        paymentLogger.info('Reusing existing Razorpay order', {
          orderId,
          razorpayOrderId: existing.transactionId,
        });
        return {
          payment: existing,
          razorpayOrderId: existing.transactionId,
          keyId: env.RAZORPAY_KEY_ID,
          amount: Math.round(amount * 100),
          currency: 'INR',
        };
      }

      try {
        const razorpayOrder = await this.razorpay.orders.create({
          amount: Math.round(amount * 100),
          currency: 'INR',
          receipt: order.orderNumber,
          notes: { orderId, orderNumber: order.orderNumber },
        });

        paymentLogger.info('Razorpay order created', {
          orderId,
          razorpayOrderId: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
        });

        const payment = await prisma.payment.create({
          data: {
            orderId,
            provider: 'RAZORPAY',
            transactionId: razorpayOrder.id,
            status: 'PENDING',
            amount,
            metadata: {
              razorpay_order_id: razorpayOrder.id,
              amount: razorpayOrder.amount,
              currency: razorpayOrder.currency,
              receipt: razorpayOrder.receipt,
            },
          },
        });

        return {
          payment,
          razorpayOrderId: razorpayOrder.id,
          keyId: env.RAZORPAY_KEY_ID,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
        };
      } catch (err) {
        paymentLogger.error('Razorpay order creation failed', {
          orderId,
          orderNumber: order.orderNumber,
          amount: Math.round(amount * 100),
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    }

    paymentLogger.error('Payment provider not configured', { orderId, provider });
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

  async verifyRazorpayCheckout(
    userId: string,
    input: {
      orderId: string;
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    },
  ) {
    paymentLogger.info('Verifying Razorpay checkout', {
      userId,
      orderId: input.orderId,
      razorpayOrderId: input.razorpayOrderId,
      razorpayPaymentId: input.razorpayPaymentId,
    });

    if (!env.RAZORPAY_KEY_SECRET) {
      paymentLogger.error('Razorpay verify failed: secret not configured');
      throw new InfrastructureError('Razorpay not configured');
    }

    const order = await prisma.order.findUnique({ where: { id: input.orderId } });
    if (!order || order.userId !== userId) {
      paymentLogger.warn('Razorpay verify failed: order not found or unauthorized', {
        orderId: input.orderId,
        userId,
        orderFound: Boolean(order),
      });
      throw new NotFoundError('Order not found');
    }

    if (order.status === 'PAID') {
      paymentLogger.info('Razorpay verify: order already paid', {
        orderId: input.orderId,
        razorpayPaymentId: input.razorpayPaymentId,
      });
      const payment = await prisma.payment.findFirst({
        where: { orderId: input.orderId, provider: 'RAZORPAY', status: 'SUCCESS' },
      });
      return { order, payment, alreadyPaid: true };
    }

    if (order.status !== 'PAYMENT_PENDING') {
      paymentLogger.warn('Razorpay verify failed: order not awaiting payment', {
        orderId: input.orderId,
        status: order.status,
      });
      throw new DomainError('Order is not awaiting payment');
    }

    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`)
      .digest('hex');

    if (expectedSignature !== input.razorpaySignature) {
      paymentLogger.warn('Razorpay verify failed: invalid signature', {
        orderId: input.orderId,
        razorpayOrderId: input.razorpayOrderId,
        razorpayPaymentId: input.razorpayPaymentId,
      });
      throw new DomainError('Invalid payment signature');
    }

    const payment = await prisma.payment.findFirst({
      where: {
        orderId: input.orderId,
        provider: 'RAZORPAY',
        transactionId: input.razorpayOrderId,
      },
    });
    if (!payment) {
      paymentLogger.warn('Razorpay verify failed: payment record not found', {
        orderId: input.orderId,
        razorpayOrderId: input.razorpayOrderId,
      });
      throw new NotFoundError('Payment record not found');
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'SUCCESS',
        transactionId: input.razorpayPaymentId,
        metadata: {
          ...(typeof payment.metadata === 'object' && payment.metadata !== null
            ? (payment.metadata as Record<string, unknown>)
            : {}),
          razorpay_order_id: input.razorpayOrderId,
          razorpay_payment_id: input.razorpayPaymentId,
          razorpay_signature: input.razorpaySignature,
          verifiedAt: new Date().toISOString(),
        },
      },
    });

    const updatedOrder = await this.orderService.transitionStatus(input.orderId, 'PAID');
    paymentLogger.info('Razorpay payment verified', {
      orderId: input.orderId,
      razorpayPaymentId: input.razorpayPaymentId,
    });

    await eventBus.publish({
      type: DomainEventType.PAYMENT_SUCCESS,
      payload: {
        orderId: input.orderId,
        transactionId: input.razorpayPaymentId,
      },
      occurredAt: new Date(),
    });

    return {
      order: updatedOrder,
      payment: await prisma.payment.findUnique({ where: { id: payment.id } }),
      alreadyPaid: false,
    };
  }

  getRazorpayPublicConfig() {
    if (!env.RAZORPAY_KEY_ID) {
      throw new InfrastructureError('Razorpay not configured');
    }
    return { keyId: env.RAZORPAY_KEY_ID };
  }

  async handleRazorpayWebhook(body: Record<string, unknown>, signature: string) {
    const event = body.event as string;
    paymentLogger.info('Razorpay webhook received', { event });

    const expected = crypto
      .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET ?? '')
      .update(JSON.stringify(body))
      .digest('hex');

    if (signature !== expected) {
      paymentLogger.warn('Razorpay webhook rejected: invalid signature', { event });
      throw new DomainError('Invalid webhook signature');
    }

    const payload = body.payload as {
      payment?: {
        entity: {
          order_id: string;
          id: string;
          error_code?: string;
          error_description?: string;
          error_reason?: string;
        };
      };
    };

    if (event === 'payment.captured') {
      const payment = await prisma.payment.findFirst({
        where: { transactionId: payload.payment?.entity.order_id },
      });
      if (payment) {
        await this.markPaymentSuccess(payment.orderId, payload.payment!.entity.id, 'RAZORPAY');
      } else {
        paymentLogger.warn('Razorpay payment.captured: no matching payment record', {
          razorpayOrderId: payload.payment?.entity.order_id,
          razorpayPaymentId: payload.payment?.entity.id,
        });
      }
      return;
    }

    if (event === 'payment.failed') {
      const entity = payload.payment?.entity;
      paymentLogger.warn('Razorpay payment.failed webhook', {
        razorpayOrderId: entity?.order_id,
        razorpayPaymentId: entity?.id,
        errorCode: entity?.error_code,
        errorDescription: entity?.error_description,
        errorReason: entity?.error_reason,
      });

      if (entity?.order_id) {
        const payment = await prisma.payment.findFirst({
          where: { transactionId: entity.order_id },
        });
        if (payment) {
          await this.markPaymentFailed(payment.orderId, entity.id, {
            source: 'webhook',
            errorCode: entity.error_code,
            errorDescription: entity.error_description,
            errorReason: entity.error_reason,
          });
        } else {
          paymentLogger.warn('Razorpay payment.failed: no matching payment record', {
            razorpayOrderId: entity.order_id,
            razorpayPaymentId: entity.id,
          });
        }
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

  private async markPaymentFailed(
    orderId: string,
    transactionId: string,
    reason?: Record<string, unknown>,
  ) {
    await prisma.payment.updateMany({
      where: { orderId },
      data: { status: 'FAILED', transactionId },
    });

    await this.orderService.transitionStatus(orderId, 'CANCELLED');

    paymentLogger.warn('Payment failed', { orderId, transactionId, ...reason });

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
