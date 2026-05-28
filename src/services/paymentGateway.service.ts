import crypto from 'crypto';

const getWebhookSecret = () =>
  process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET || 'cleanzy-local-gateway-secret';

export type PaymentIntent = {
  payment_intent_id: string;
  checkout_url: string;
  amount: number;
  currency: string;
  status: 'requires_payment_method';
};

export type PaymentWebhookPayload = {
  event_type: string;
  booking_id: string;
  payment_intent_id: string;
  amount: number;
  mode: string;
  transaction_status: string;
};

export const createPaymentIntent = (params: {
  bookingId: string;
  amount: number;
  currency?: string;
}): PaymentIntent => {
  const paymentIntentId = `pi_${crypto.randomUUID()}`;

  return {
    payment_intent_id: paymentIntentId,
    checkout_url: `https://payments.cleanzy.local/checkout/${paymentIntentId}`,
    amount: params.amount,
    currency: params.currency || 'INR',
    status: 'requires_payment_method',
  };
};

export const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
    .join(',')}}`;
};

export const signGatewayPayload = (payload: unknown): string =>
  crypto.createHmac('sha256', getWebhookSecret()).update(stableStringify(payload)).digest('hex');

export const isValidGatewaySignature = (payload: unknown, signature?: string): boolean => {
  if (!signature) {
    return false;
  }

  const expected = signGatewayPayload(payload);
  const signatureBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  return (
    signatureBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  );
};

