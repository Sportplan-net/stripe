import { WebPlugin } from '@capacitor/core';
import type { FormSubmitEvent } from '@stripe-elements/stripe-elements/dist/types/interfaces';
import type { Stripe, StripeCardNumberElement } from '@stripe/stripe-js';

import type {
  ApplePayResultInterface,
  CreateApplePayOption,
  CreateGooglePayOption,
  CreateIdentityVerificationSheetOption,
  CreatePaymentFlowOption,
  CreatePaymentSheetOption,
  GooglePayResultInterface,
  IdentityVerificationSheetResultInterface,
  PaymentFlowResultInterface,
  PaymentIntentResultInterface,
  PaymentSheetResultInterface,
  StripeInitializationOptions, StripePaymentSheet, StripePlugin, StripeRequestButton
} from './definitions';
import { ApplePayEventsEnum, GooglePayEventsEnum, PaymentFlowEventsEnum, PaymentIntentEventsEnum, PaymentSheetEventsEnum } from './definitions';
import { isPlatform } from './shared/platform';



export class StripeWeb extends WebPlugin implements StripePlugin {
  private publishableKey: string | undefined;
  private stripeAccount: string | undefined;
  private paymentSheet: StripePaymentSheet | undefined;

  private flowStripe: Stripe | undefined;
  private flowCardNumberElement: StripeCardNumberElement | undefined;

  private requestApplePay: StripeRequestButton | undefined;
  private requestApplePayOptions: CreateApplePayOption | undefined;

  private requestGooglePay: StripeRequestButton | undefined;
  private requestGooglePayOptions: CreateGooglePayOption | undefined;

  constructor() {
    super({
      name: 'Stripe',
      platforms: ['web'],
    });
  }

  async clean(): Promise<void> {
    return;
  }

  async retrieveSetupIntent(options: {
    clientSecret: string;
    stripeAccount?: string;
  }): Promise<{
    paymentResult: PaymentIntentResultInterface;
    error?: string;
  }> {
    if (!window || !window.Stripe || !this.publishableKey) {
      return {
        paymentResult: PaymentIntentEventsEnum.FailedToLoad
      }
    }
    console.log(options);
    const stripe = window.Stripe(this.publishableKey, { stripeAccount: options.stripeAccount });
    const res = await stripe.retrieveSetupIntent(options.clientSecret).then(pir => pir);
    if (res?.setupIntent?.status === 'succeeded') {
      this.notifyListeners(PaymentIntentEventsEnum.Completed, null);
      return {
        paymentResult: PaymentIntentEventsEnum.Completed,
      };
    }
    this.notifyListeners(PaymentIntentEventsEnum.Failed, res.setupIntent?.last_setup_error);
    return {
      paymentResult: PaymentIntentEventsEnum.Failed,
      error: res.setupIntent?.last_setup_error ? res.setupIntent?.last_setup_error.message : undefined
    };
  }

  async confirmPaymentIntent(options: {
    clientSecret: string;
    paymentMethodId: string;
    stripeAccount?: string;
  }): Promise<
    { paymentResult?: PaymentIntentResultInterface; error?: string; debugError?: unknown }
  > {
    if (!window || !window.Stripe || !this.publishableKey) {
      return {
        paymentResult: PaymentIntentEventsEnum.FailedToLoad
      }
    }
    const stripe = window.Stripe(this.publishableKey, { stripeAccount: options.stripeAccount });
    const { error: confirmError } = await stripe.confirmCardPayment(options.clientSecret, { payment_method: options.paymentMethodId });
    if (confirmError) {
      this.notifyListeners(PaymentIntentEventsEnum.Failed, confirmError);
      return {
        paymentResult: PaymentIntentEventsEnum.Failed,
      };
    } else {
      this.notifyListeners(PaymentIntentEventsEnum.Completed, null);
      return {
        paymentResult: PaymentIntentEventsEnum.Completed,
      };
    }
  }

  async initialize(options: StripeInitializationOptions): Promise<void> {
    if (typeof options.publishableKey !== 'string' || options.publishableKey.trim().length === 0) {
      throw new Error('you must provide a valid key');
    }
    this.publishableKey = options.publishableKey;

    if (options.stripeAccount) {
      this.stripeAccount = options.stripeAccount;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async createIdentityVerificationSheet(_options: CreateIdentityVerificationSheetOption): Promise<void> {
    // TODO: what is web.ts for?
  }

  presentIdentityVerificationSheet(): Promise<{
    identityVerificationResult: IdentityVerificationSheetResultInterface;
  }> {
    throw new Error('Method not implemented.');
  }

  async createPaymentSheet(options: CreatePaymentSheetOption): Promise<void> {
    if (!this.publishableKey) {
      this.notifyListeners(PaymentSheetEventsEnum.FailedToLoad, null);
      return;
    }

    this.paymentSheet = document.createElement('stripe-payment-sheet');
    document.querySelector('body')?.appendChild(this.paymentSheet);
    await customElements.whenDefined('stripe-payment-sheet');

    this.paymentSheet.publishableKey = this.publishableKey;

    if (this.stripeAccount) {
      this.paymentSheet.stripeAccount = this.stripeAccount;
    }

    this.paymentSheet.applicationName = '@capacitor-community/stripe';

    this.paymentSheet.intentClientSecret = options.paymentIntentClientSecret;
    this.paymentSheet.intentType = 'payment';
    if (options.withZipCode !== undefined) {
      this.paymentSheet.zip = options.withZipCode;
    }

    this.notifyListeners(PaymentSheetEventsEnum.Loaded, null);
  }

  async presentPaymentSheet(): Promise<{
    paymentResult: PaymentSheetResultInterface;
  }> {
    if (!this.paymentSheet) {
      throw new Error();
    }

    const props = await this.paymentSheet.present();
    if (props === undefined) {
      this.notifyListeners(PaymentSheetEventsEnum.Canceled, null);
      return {
        paymentResult: PaymentSheetEventsEnum.Canceled,
      };
    }

    const {
      detail: { stripe, cardNumberElement },
    } = props as {
      detail: FormSubmitEvent;
    };

    const result = await stripe.createPaymentMethod({
      type: 'card',
      card: cardNumberElement,
    });
    this.paymentSheet.updateProgress('success');
    this.paymentSheet.remove();

    if (result.error !== undefined) {
      this.notifyListeners(PaymentSheetEventsEnum.Failed, null);
      return {
        paymentResult: PaymentSheetEventsEnum.Failed,
      };
    }

    this.notifyListeners(PaymentSheetEventsEnum.Completed, null);

    return {
      paymentResult: PaymentSheetEventsEnum.Completed,
    };
  }

  async createPaymentFlow(options: CreatePaymentFlowOption): Promise<StripePaymentSheet | void> {
    if (!this.publishableKey) {
      this.notifyListeners(PaymentFlowEventsEnum.FailedToLoad, null);
      return;
    }

    this.paymentSheet = document.createElement('stripe-payment-sheet');
    document.querySelector('body')?.appendChild(this.paymentSheet);
    await customElements.whenDefined('stripe-payment-sheet');

    this.paymentSheet.publishableKey = this.publishableKey;

    if (this.stripeAccount) {
      this.paymentSheet.stripeAccount = this.stripeAccount;
    }

    this.paymentSheet.applicationName = '@capacitor-community/stripe';

    // eslint-disable-next-line no-prototype-builtins
    if (options.hasOwnProperty('paymentIntentClientSecret')) {
      this.paymentSheet.intentType = 'payment';
      this.paymentSheet.intentClientSecret = options.paymentIntentClientSecret;
    } else {
      this.paymentSheet.intentType = 'setup';
      this.paymentSheet.intentClientSecret = options.setupIntentClientSecret;
    }
    if (options.withZipCode !== undefined) {
      this.paymentSheet.zip = options.withZipCode;
    }

    if (isPlatform(window, 'ios')) {
      this.paymentSheet.buttonLabel = 'Add card';
      this.paymentSheet.sheetTitle = 'Add a card';
    } else {
      this.paymentSheet.buttonLabel = 'Add';
    }

    this.notifyListeners(PaymentFlowEventsEnum.Loaded, null);

    return this.paymentSheet;
  }

  async presentPaymentFlow(): Promise<{
    cardNumber: string;
  }> {
    if (!this.paymentSheet) {
      throw new Error();
    }

    this.notifyListeners(PaymentFlowEventsEnum.Opened, null);
    const props = await this.paymentSheet.present().catch(() => undefined);
    if (props === undefined) {
      this.notifyListeners(PaymentFlowEventsEnum.Canceled, null);
      throw new Error();
    }

    const {
      detail: { stripe, cardNumberElement },
    } = props as {
      detail: FormSubmitEvent;
    };

    const { token } = await stripe.createToken(cardNumberElement);
    if (token === undefined || token.card === undefined) {
      throw new Error();
    }

    this.flowStripe = stripe;
    this.flowCardNumberElement = cardNumberElement;

    this.notifyListeners(PaymentFlowEventsEnum.Created, {
      cardNumber: token.card.last4,
    });
    return {
      cardNumber: token.card.last4,
    };
  }

  async confirmPaymentFlow(): Promise<{
    paymentResult: PaymentFlowResultInterface,
    error?: string;
    debugError?: string;
  }> {
    if (!this.paymentSheet || !this.flowStripe || !this.flowCardNumberElement) {
      throw new Error();
    }

    const result = await this.flowStripe.createPaymentMethod({
      type: 'card',
      card: this.flowCardNumberElement,
    });

    if (result.error !== undefined) {
      this.notifyListeners(PaymentFlowEventsEnum.Failed, null);
      this.paymentSheet.updateProgress('failure');
      this.paymentSheet.remove();

      this.notifyListeners(PaymentFlowEventsEnum.Failed, null);

      return {
        paymentResult: PaymentFlowEventsEnum.Failed,
        error: result.error.message,
        debugError: result.error.decline_code,
      };
    }

    this.paymentSheet.updateProgress('success');
    this.paymentSheet.remove();

    this.notifyListeners(PaymentFlowEventsEnum.Completed, null);
    return {
      paymentResult: PaymentFlowEventsEnum.Completed,
    };
  }

  isApplePayAvailable(): Promise<void> {
    return this.isAvailable('applePay');
  }

  async createApplePay(createApplePayOption: CreateApplePayOption): Promise<void> {
    if (!this.publishableKey) {
      this.notifyListeners(ApplePayEventsEnum.FailedToLoad, null);
      return;
    }
    this.requestApplePay = await this.createPaymentRequestButton();
    this.requestApplePayOptions = createApplePayOption;
    this.notifyListeners(ApplePayEventsEnum.Loaded, null);
  }

  presentApplePay(): Promise<{
    paymentResult: ApplePayResultInterface;
  }> {
    return this.presentPaymentRequestButton(
      'applePay',
      this.requestApplePay,
      this.requestApplePayOptions,
      ApplePayEventsEnum
    ) as Promise<{
      paymentResult: ApplePayResultInterface;
    }>;
  }

  isGooglePayAvailable(): Promise<void> {
    return this.isAvailable('googlePay');
  }

  async createGooglePay(createGooglePayOption: CreateGooglePayOption): Promise<void> {
    if (!this.publishableKey) {
      this.notifyListeners(GooglePayEventsEnum.FailedToLoad, null);
      return;
    }
    this.requestGooglePay = await this.createPaymentRequestButton();
    this.requestGooglePayOptions = createGooglePayOption;
    this.notifyListeners(GooglePayEventsEnum.Loaded, null);
  }

  presentGooglePay(): Promise<{
    paymentResult: GooglePayResultInterface;
  }> {
    return this.presentPaymentRequestButton(
      'googlePay',
      this.requestGooglePay,
      this.requestGooglePayOptions,
      GooglePayEventsEnum
    ) as Promise<{
      paymentResult: GooglePayResultInterface;
    }>;
  }

  private async isAvailable(type: 'applePay' | 'googlePay'): Promise<void> {
    const requestButton = document.createElement('stripe-payment-request-button');
    requestButton.id = `isAvailable-${type}`;
    document.querySelector('body')?.appendChild(requestButton);
    await customElements.whenDefined('stripe-payment-request-button');

    if (this.publishableKey) {
      requestButton.publishableKey = this.publishableKey;
    }

    if (this.stripeAccount) {
      requestButton.stripeAccount = this.stripeAccount;
    }

    requestButton.applicationName = '@capacitor-community/stripe';
    return await requestButton.isAvailable(type).finally(() => requestButton.remove());
  }

  private async createPaymentRequestButton(): Promise<StripeRequestButton> {
    const requestButton = document.createElement('stripe-payment-request-button');
    document.querySelector('body')?.appendChild(requestButton);
    await customElements.whenDefined('stripe-payment-request-button');

    if (this.publishableKey) {
      requestButton.publishableKey = this.publishableKey;
    }

    if (this.stripeAccount) {
      requestButton.stripeAccount = this.stripeAccount;
    }

    requestButton.applicationName = '@capacitor-community/stripe';

    return requestButton;
  }

  private async presentPaymentRequestButton(
    type: 'applePay' | 'googlePay',
    requestButton: StripeRequestButton | undefined,
    requestButtonOptions: CreateApplePayOption | CreateGooglePayOption | undefined,
    EventsEnum: typeof ApplePayEventsEnum | typeof GooglePayEventsEnum
  ): Promise<{
    paymentResult: ApplePayResultInterface | GooglePayResultInterface;
  }> {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve) => {
      if (requestButton === undefined || requestButtonOptions === undefined || this.publishableKey === undefined) {
        this.notifyListeners(EventsEnum.Failed, null);
        return resolve({
          paymentResult: EventsEnum.Failed,
        });
      }

      await requestButton.setPaymentRequestOption({
        country: requestButtonOptions.countryCode!.toUpperCase(),
        currency: requestButtonOptions.currency!.toLowerCase(),
        total: requestButtonOptions.paymentSummaryItems![requestButtonOptions.paymentSummaryItems!.length - 1],
        disableWallets: type === 'applePay' ? ['googlePay', 'browserCard'] : ['applePay', 'browserCard'],
        requestPayerName: true,
        requestPayerEmail: true,
      });

      // await this.requestButton.setPaymentRequestShippingAddressEventHandler(async (event, stripe) => {});
      const intentClientSecret = requestButtonOptions.paymentIntentClientSecret;
      await requestButton.setPaymentMethodEventHandler(async (event, stripe) => {
        const { paymentIntent, error: confirmError } = await stripe.confirmCardPayment(
          intentClientSecret,
          {
            payment_method: event.paymentMethod.id,
          },
          { handleActions: false }
        );
        if (confirmError) {
          event.complete('fail');
          this.notifyListeners(EventsEnum.Failed, confirmError);
          return resolve({
            paymentResult: EventsEnum.Failed,
          });
        }
        if (paymentIntent?.status === 'requires_action') {
          const { error: confirmError } = await stripe.confirmCardPayment(intentClientSecret);
          if (confirmError) {
            event.complete('fail');
            this.notifyListeners(EventsEnum.Failed, confirmError);
            return resolve({
              paymentResult: EventsEnum.Failed,
            });
          }
        }
        event.complete('success');
        this.notifyListeners(EventsEnum.Completed, null);
        return resolve({
          paymentResult: EventsEnum.Completed,
        });
      });
      await requestButton.initStripe(this.publishableKey, {
        stripeAccount: this.stripeAccount,
        showButton: false,
      });
    });
  }
}
