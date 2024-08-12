import { WebPlugin } from '@capacitor/core';
import { defineCustomElements as stripeDefineCustomElements } from '@stripe-elements/stripe-elements/loader';
import { loadStripe } from '@stripe/stripe-js';
import { ApplePayEventsEnum, GooglePayEventsEnum, PaymentFlowEventsEnum, PaymentIntentEventsEnum, PaymentSheetEventsEnum } from './definitions';
import { isPlatform } from './shared/platform';
export class StripeWeb extends WebPlugin {
    constructor() {
        super({
            name: 'Stripe',
            platforms: ['web'],
        });
        this.waitForElm = async (el, selector) => {
            return new Promise(resolve => {
                if (el.querySelector(selector)) {
                    return resolve(el.querySelector(selector));
                }
                const observer = new MutationObserver(() => {
                    if (el.querySelector(selector)) {
                        resolve(el.querySelector(selector));
                        observer.disconnect();
                    }
                });
                observer.observe(el, {
                    childList: true,
                    subtree: true
                });
            });
        };
    }
    // Example method returning PluginListenerHandlePromise
    /* async addListener(): PluginListenerHandlePromise {
      const handle: PluginListenerHandle = {
        remove: () => {
          console.log('Listener removed');
        }
      };
  
      const promise = Promise.resolve(handle) as PluginListenerHandlePromise;
      promise.remove = handle.remove;
  
      return promise;
    } */
    async retrieveSetupIntent(options) {
        var _a, _b, _c, _d;
        if (!(window === null || window === void 0 ? void 0 : window.Stripe) || !this.publishableKey) {
            return {
                paymentResult: PaymentIntentEventsEnum.FailedToLoad
            };
        }
        console.log(options);
        const stripe = window.Stripe(this.publishableKey, { stripeAccount: options.stripeAccount });
        const res = await stripe.retrieveSetupIntent(options.clientSecret).then(pir => pir);
        if (((_a = res.setupIntent) === null || _a === void 0 ? void 0 : _a.status) === 'succeeded') {
            this.notifyListeners(PaymentIntentEventsEnum.Completed, null);
            return {
                paymentResult: PaymentIntentEventsEnum.Completed,
            };
        }
        this.notifyListeners(PaymentIntentEventsEnum.Failed, (_b = res.setupIntent) === null || _b === void 0 ? void 0 : _b.last_setup_error);
        return {
            paymentResult: PaymentIntentEventsEnum.Failed,
            error: ((_c = res === null || res === void 0 ? void 0 : res.setupIntent) === null || _c === void 0 ? void 0 : _c.last_setup_error) ? (_d = res === null || res === void 0 ? void 0 : res.setupIntent) === null || _d === void 0 ? void 0 : _d.last_setup_error.message : undefined
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
    async addAddressElement(paymentSheet, clientSecret, address) {
        var _a, _b, _c;
        if (!window.Stripe && this.publishableKey && !this.elements) {
            await loadStripe(this.publishableKey);
        }
        if (window.Stripe && this.publishableKey && !this.elements) {
            const stripe = window.Stripe(this.publishableKey, { stripeAccount: this.stripeAccount });
            this.elements = stripe.elements({
                clientSecret
            });
        }
        const el = await paymentSheet.getStripePaymentSheetElement();
        const cardEl = await this.waitForElm(el, '#stripe-card-element');
        const add = document.createElement('stripe-address-sheet');
        add.setAttribute('id', 'address-element');
        (_a = cardEl === null || cardEl === void 0 ? void 0 : cardEl.querySelector('.payment-info')) === null || _a === void 0 ? void 0 : _a.appendChild(add);
        this.addressElement = this.addressElement ? this.addressElement : (_b = this.elements) === null || _b === void 0 ? void 0 : _b.create('address', {
            mode: 'billing',
            defaultValues: {
                name: address === null || address === void 0 ? void 0 : address.userName,
                address: (address === null || address === void 0 ? void 0 : address.countryCode) ? {
                    line1: (address === null || address === void 0 ? void 0 : address.lineOne) ? address.lineOne : undefined,
                    line2: (address === null || address === void 0 ? void 0 : address.lineTwo) ? address.lineTwo : undefined,
                    city: (address === null || address === void 0 ? void 0 : address.city) ? address.city : undefined,
                    state: (address === null || address === void 0 ? void 0 : address.state) ? address.state : undefined,
                    postal_code: (address === null || address === void 0 ? void 0 : address.postCode) ? address.postCode : undefined,
                    country: address === null || address === void 0 ? void 0 : address.countryCode,
                } : undefined
            }
        });
        // await this.waitForElm(paymentSheet, '#address-element');
        (_c = this.addressElement) === null || _c === void 0 ? void 0 : _c.mount('#address-element');
    }
    async createPaymentFlow(options) {
        var _a;
        if (!this.publishableKey) {
            this.notifyListeners(PaymentFlowEventsEnum.FailedToLoad, null);
            return;
        }
        stripeDefineCustomElements(window);
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
        await this.addAddressElement(this.paymentSheet, options.paymentIntentClientSecret || options.setupIntentClientSecret, options.address);
        this.notifyListeners(PaymentFlowEventsEnum.Loaded, null);
        return this.paymentSheet;
    }
    async presentPaymentFlow() {
        var _a, _b, _c, _d, _e, _f;
        if (!this.paymentSheet) {
            throw new Error();
        }
        this.notifyListeners(PaymentFlowEventsEnum.Opened, null);
        this.paymentSheet.handleSubmit = async (event, submitEventProps) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
            event.preventDefault();
            if (!((_a = this.paymentSheet) === null || _a === void 0 ? void 0 : _a.intentClientSecret)) {
                throw new Error('intentClientSecret is not defined');
            }
            const cardEl = submitEventProps.cardNumberElement;
            if (!cardEl || this.addressElement === undefined) {
                console.error('card element is not defined ', submitEventProps, this.addressElement, cardEl);
                return;
            }
            const addressHolder = await this.addressElement.getValue().then(res => res.value);
            // console.log('addressHolder', submitEventProps, this.paymentSheet, addressHolder);
            if (this.paymentSheet.intentType === 'payment') {
                const res = await submitEventProps.stripe.confirmCardPayment(this.paymentSheet.intentClientSecret, {
                    payment_method: {
                        card: cardEl,
                        billing_details: {
                            address: {
                                line1: addressHolder === null || addressHolder === void 0 ? void 0 : addressHolder.address.line1,
                                line2: (addressHolder === null || addressHolder === void 0 ? void 0 : addressHolder.address.line2) || undefined,
                                city: (_b = addressHolder === null || addressHolder === void 0 ? void 0 : addressHolder.address) === null || _b === void 0 ? void 0 : _b.city,
                                state: (_c = addressHolder === null || addressHolder === void 0 ? void 0 : addressHolder.address) === null || _c === void 0 ? void 0 : _c.state,
                                postal_code: (_d = addressHolder === null || addressHolder === void 0 ? void 0 : addressHolder.address) === null || _d === void 0 ? void 0 : _d.postal_code,
                                country: (_e = addressHolder === null || addressHolder === void 0 ? void 0 : addressHolder.address) === null || _e === void 0 ? void 0 : _e.country
                            },
                            name: addressHolder === null || addressHolder === void 0 ? void 0 : addressHolder.name,
                        }
                    }
                });
                // console.log('confirmCardSetup', res);
                if (res.error) {
                    // console.error('confirmCardSetup error', res.error);
                    throw new Error(res.error.message);
                }
            }
            const res = await submitEventProps.stripe.confirmCardSetup(this.paymentSheet.intentClientSecret, {
                payment_method: {
                    card: cardEl,
                    billing_details: {
                        address: {
                            line1: addressHolder === null || addressHolder === void 0 ? void 0 : addressHolder.address.line1,
                            line2: (addressHolder === null || addressHolder === void 0 ? void 0 : addressHolder.address.line2) || undefined,
                            city: (_f = addressHolder === null || addressHolder === void 0 ? void 0 : addressHolder.address) === null || _f === void 0 ? void 0 : _f.city,
                            state: (_g = addressHolder === null || addressHolder === void 0 ? void 0 : addressHolder.address) === null || _g === void 0 ? void 0 : _g.state,
                            postal_code: (_h = addressHolder === null || addressHolder === void 0 ? void 0 : addressHolder.address) === null || _h === void 0 ? void 0 : _h.postal_code,
                            country: (_j = addressHolder === null || addressHolder === void 0 ? void 0 : addressHolder.address) === null || _j === void 0 ? void 0 : _j.country
                        },
                        name: addressHolder === null || addressHolder === void 0 ? void 0 : addressHolder.name,
                    }
                }
            });
            // console.log('confirmCardSetup', res);
            if (res.error) {
                // console.error('confirmCardSetup error', res.error);
                throw new Error(res.error.message);
            }
        };
        const props = await this.paymentSheet.present().catch(() => undefined);
        const addressHolder = await ((_a = this.addressElement) === null || _a === void 0 ? void 0 : _a.getValue().then(res => res.value));
        if (props === undefined) {
            this.notifyListeners(PaymentFlowEventsEnum.Canceled, null);
            (_b = document.querySelector('body')) === null || _b === void 0 ? void 0 : _b.removeChild(this.paymentSheet);
            return {
                cardNumber: '',
                error: 'canceled',
                debugError: 'user hit the cancel button'
            };
        }
        const { detail: { stripe, cardNumberElement }, } = props;
        const { token, error } = await stripe.createToken(cardNumberElement, {
            address_line1: addressHolder === null || addressHolder === void 0 ? void 0 : addressHolder.address.line1,
            address_line2: (addressHolder === null || addressHolder === void 0 ? void 0 : addressHolder.address.line2) || undefined,
            address_city: (_c = addressHolder === null || addressHolder === void 0 ? void 0 : addressHolder.address) === null || _c === void 0 ? void 0 : _c.city,
            address_state: (_d = addressHolder === null || addressHolder === void 0 ? void 0 : addressHolder.address) === null || _d === void 0 ? void 0 : _d.state,
            address_zip: (_e = addressHolder === null || addressHolder === void 0 ? void 0 : addressHolder.address) === null || _e === void 0 ? void 0 : _e.postal_code,
            address_country: (_f = addressHolder === null || addressHolder === void 0 ? void 0 : addressHolder.address) === null || _f === void 0 ? void 0 : _f.country,
            name: addressHolder === null || addressHolder === void 0 ? void 0 : addressHolder.name,
        });
        if (error) {
            throw new Error(error.message);
        }
        else if (token === undefined || token.card === undefined) {
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