import type { PluginListenerHandle } from '@capacitor/core';

import type { PaymentIntentEventsEnum, PaymentIntentResultInterface } from './payment-intent-events.enum';

export interface PaymentIntentDefinitions {
  confirmPaymentIntent(options: {
    clientSecret: string;
    paymentMethodId: string;
    stripeAccount?: string;
  }): Promise<{
    paymentResult: PaymentIntentResultInterface;
  }>;

  addListener(
    eventName: PaymentIntentEventsEnum.Loaded,
    listenerFunc: () => void,
  ): PluginListenerHandle;

  addListener(
    eventName: PaymentIntentEventsEnum.FailedToLoad,
    listenerFunc: (error: string) => void,
  ): PluginListenerHandle;

  addListener(
    eventName: PaymentIntentEventsEnum.Completed,
    listenerFunc: () => void,
  ): PluginListenerHandle;

  addListener(
    eventName: PaymentIntentEventsEnum.Canceled,
    listenerFunc: () => void,
  ): PluginListenerHandle;

  addListener(
    eventName: PaymentIntentEventsEnum.Failed,
    listenerFunc: (error: string) => void,
  ): PluginListenerHandle;
}
