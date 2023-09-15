import { WebPlugin } from '@capacitor/core';
import { ApplePayEventsEnum, GooglePayEventsEnum, PaymentFlowEventsEnum, PaymentSheetEventsEnum, PaymentIntentEventsEnum } from './definitions';
import { isPlatform } from './shared/platform';
export class StripeWeb extends WebPlugin {
    constructor() {
        super({
            name: 'Stripe',
            platforms: ['web'],
        });
    }
    async retrievePaymentIntent(options) {
        if (!window || !window.Stripe || !this.publishableKey) {
            return {
                paymentResult: PaymentIntentEventsEnum.FailedToLoad
            };
        }
        console.log(options);
        const stripe = window.Stripe(this.publishableKey, { stripeAccount: options.stripeAccount });
        const paymentIntent = await stripe.retrievePaymentIntent(options.clientSecret).then(pir => pir.paymentIntent);
        if ((paymentIntent === null || paymentIntent === void 0 ? void 0 : paymentIntent.status) === 'succeeded') {
            this.notifyListeners(PaymentIntentEventsEnum.Completed, null);
            return {
                paymentResult: PaymentIntentEventsEnum.Completed,
            };
        }
        this.notifyListeners(PaymentIntentEventsEnum.Failed, paymentIntent === null || paymentIntent === void 0 ? void 0 : paymentIntent.last_payment_error);
        return {
            paymentResult: PaymentIntentEventsEnum.Failed,
            error: (paymentIntent === null || paymentIntent === void 0 ? void 0 : paymentIntent.last_payment_error) ? paymentIntent === null || paymentIntent === void 0 ? void 0 : paymentIntent.last_payment_error.message : undefined
        };
    }
    async confirmPaymentIntent(options) {
        if (!window || !window.Stripe || !this.publishableKey) {
            return {
                paymentResult: PaymentIntentEventsEnum.FailedToLoad
            };
        }
        const stripe = window.Stripe(this.publishableKey, { stripeAccount: options.stripeAccount });
        const { error: confirmError } = await stripe.confirmCardPayment(options.clientSecret, { payment_method: options.paymentMethodId });
        if (confirmError) {
            this.notifyListeners(PaymentIntentEventsEnum.Failed, confirmError);
            return {
                paymentResult: PaymentIntentEventsEnum.Failed,
            };
        }
        else {
            this.notifyListeners(PaymentIntentEventsEnum.Completed, null);
            return {
                paymentResult: PaymentIntentEventsEnum.Completed,
            };
        }
    }
    async initialize(options) {
        if (typeof options.publishableKey !== 'string' || options.publishableKey.trim().length === 0) {
            throw new Error('you must provide a valid key');
        }
        this.publishableKey = options.publishableKey;
        if (options.stripeAccount) {
            this.stripeAccount = options.stripeAccount;
        }
    }
    async createPaymentSheet(options) {
        var _a;
        if (!this.publishableKey) {
            this.notifyListeners(PaymentSheetEventsEnum.FailedToLoad, null);
            return;
        }
        this.paymentSheet = document.createElement('stripe-payment-sheet');
        (_a = document.querySelector('body')) === null || _a === void 0 ? void 0 : _a.appendChild(this.paymentSheet);
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
    async presentPaymentSheet() {
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
        const { detail: { stripe, cardNumberElement }, } = props;
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
    async createPaymentFlow(options) {
        var _a;
        if (!this.publishableKey) {
            this.notifyListeners(PaymentFlowEventsEnum.FailedToLoad, null);
            return;
        }
        this.paymentSheet = document.createElement('stripe-payment-sheet');
        (_a = document.querySelector('body')) === null || _a === void 0 ? void 0 : _a.appendChild(this.paymentSheet);
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
        }
        else {
            this.paymentSheet.intentType = 'setup';
            this.paymentSheet.intentClientSecret = options.setupIntentClientSecret;
        }
        if (options.withZipCode !== undefined) {
            this.paymentSheet.zip = options.withZipCode;
        }
        if (isPlatform(window, 'ios')) {
            this.paymentSheet.buttonLabel = 'Add card';
            this.paymentSheet.sheetTitle = 'Add a card';
        }
        else {
            this.paymentSheet.buttonLabel = 'Add';
        }
        this.notifyListeners(PaymentFlowEventsEnum.Loaded, null);
        return this.paymentSheet;
    }
    async presentPaymentFlow() {
        if (!this.paymentSheet) {
            throw new Error();
        }
        this.notifyListeners(PaymentFlowEventsEnum.Opened, null);
        const props = await this.paymentSheet.present().catch(() => undefined);
        if (props === undefined) {
            this.notifyListeners(PaymentFlowEventsEnum.Canceled, null);
            throw new Error();
        }
        const { detail: { stripe, cardNumberElement }, } = props;
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
    async confirmPaymentFlow() {
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
    isApplePayAvailable() {
        return this.isAvailable('applePay');
    }
    async createApplePay(createApplePayOption) {
        if (!this.publishableKey) {
            this.notifyListeners(ApplePayEventsEnum.FailedToLoad, null);
            return;
        }
        this.requestApplePay = await this.createPaymentRequestButton();
        this.requestApplePayOptions = createApplePayOption;
        this.notifyListeners(ApplePayEventsEnum.Loaded, null);
    }
    presentApplePay() {
        return this.presentPaymentRequestButton('applePay', this.requestApplePay, this.requestApplePayOptions, ApplePayEventsEnum);
    }
    isGooglePayAvailable() {
        return this.isAvailable('googlePay');
    }
    async createGooglePay(createGooglePayOption) {
        if (!this.publishableKey) {
            this.notifyListeners(GooglePayEventsEnum.FailedToLoad, null);
            return;
        }
        this.requestGooglePay = await this.createPaymentRequestButton();
        this.requestGooglePayOptions = createGooglePayOption;
        this.notifyListeners(GooglePayEventsEnum.Loaded, null);
    }
    presentGooglePay() {
        return this.presentPaymentRequestButton('googlePay', this.requestGooglePay, this.requestGooglePayOptions, GooglePayEventsEnum);
    }
    async isAvailable(type) {
        var _a;
        const requestButton = document.createElement('stripe-payment-request-button');
        requestButton.id = `isAvailable-${type}`;
        (_a = document.querySelector('body')) === null || _a === void 0 ? void 0 : _a.appendChild(requestButton);
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
    async createPaymentRequestButton() {
        var _a;
        const requestButton = document.createElement('stripe-payment-request-button');
        (_a = document.querySelector('body')) === null || _a === void 0 ? void 0 : _a.appendChild(requestButton);
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
    async presentPaymentRequestButton(type, requestButton, requestButtonOptions, EventsEnum) {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve) => {
            if (requestButton === undefined || requestButtonOptions === undefined || this.publishableKey === undefined) {
                this.notifyListeners(EventsEnum.Failed, null);
                return resolve({
                    paymentResult: EventsEnum.Failed,
                });
            }
            await requestButton.setPaymentRequestOption({
                country: requestButtonOptions.countryCode.toUpperCase(),
                currency: requestButtonOptions.currency.toLowerCase(),
                total: requestButtonOptions.paymentSummaryItems[requestButtonOptions.paymentSummaryItems.length - 1],
                disableWallets: type === 'applePay' ? ['googlePay', 'browserCard'] : ['applePay', 'browserCard'],
                requestPayerName: true,
                requestPayerEmail: true,
            });
            // await this.requestButton.setPaymentRequestShippingAddressEventHandler(async (event, stripe) => {});
            const intentClientSecret = requestButtonOptions.paymentIntentClientSecret;
            await requestButton.setPaymentMethodEventHandler(async (event, stripe) => {
                const { paymentIntent, error: confirmError } = await stripe.confirmCardPayment(intentClientSecret, {
                    payment_method: event.paymentMethod.id,
                }, { handleActions: false });
                if (confirmError) {
                    event.complete('fail');
                    this.notifyListeners(EventsEnum.Failed, confirmError);
                    return resolve({
                        paymentResult: EventsEnum.Failed,
                    });
                }
                if ((paymentIntent === null || paymentIntent === void 0 ? void 0 : paymentIntent.status) === 'requires_action') {
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
//# sourceMappingURL=web.js.map