import { WebPlugin } from '@capacitor/core';
import type { ApplePayResultInterface, CreateApplePayOption, CreateGooglePayOption, CreateIdentityVerificationSheetOption, CreatePaymentFlowOption, CreatePaymentSheetOption, GooglePayResultInterface, IdentityVerificationSheetResultInterface, PaymentFlowResultInterface, PaymentIntentResultInterface, PaymentSheetResultInterface, StripeInitializationOptions, StripePaymentSheet, StripePlugin } from './definitions';
export declare class StripeWeb extends WebPlugin implements StripePlugin {
    private publishableKey;
    private stripeAccount;
    private paymentSheet;
    private flowStripe;
    private flowCardNumberElement;
    private requestApplePay;
    private requestApplePayOptions;
    private requestGooglePay;
    private requestGooglePayOptions;
    constructor();
    clean(): Promise<void>;
    retrieveSetupIntent(options: {
        clientSecret: string;
        stripeAccount?: string;
    }): Promise<{
        paymentResult: PaymentIntentResultInterface;
        error?: string;
    }>;
    confirmPaymentIntent(options: {
        clientSecret: string;
        paymentMethodId: string;
        stripeAccount?: string;
    }): Promise<{
        paymentResult?: PaymentIntentResultInterface;
        error?: string;
        debugError?: unknown;
    }>;
    initialize(options: StripeInitializationOptions): Promise<void>;
    createIdentityVerificationSheet(_options: CreateIdentityVerificationSheetOption): Promise<void>;
    presentIdentityVerificationSheet(): Promise<{
        identityVerificationResult: IdentityVerificationSheetResultInterface;
    }>;
    createPaymentSheet(options: CreatePaymentSheetOption): Promise<void>;
    presentPaymentSheet(): Promise<{
        paymentResult: PaymentSheetResultInterface;
    }>;
    createPaymentFlow(options: CreatePaymentFlowOption): Promise<StripePaymentSheet | void>;
    presentPaymentFlow(): Promise<{
        cardNumber: string;
    }>;
    confirmPaymentFlow(): Promise<{
        paymentResult: PaymentFlowResultInterface;
        error?: string;
        debugError?: string;
    }>;
    isApplePayAvailable(): Promise<void>;
    createApplePay(createApplePayOption: CreateApplePayOption): Promise<void>;
    presentApplePay(): Promise<{
        paymentResult: ApplePayResultInterface;
    }>;
    isGooglePayAvailable(): Promise<void>;
    createGooglePay(createGooglePayOption: CreateGooglePayOption): Promise<void>;
    presentGooglePay(): Promise<{
        paymentResult: GooglePayResultInterface;
    }>;
    private isAvailable;
    private createPaymentRequestButton;
    private presentPaymentRequestButton;
}
