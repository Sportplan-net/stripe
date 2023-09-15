package com.getcapacitor.community.stripe;

import android.content.pm.ApplicationInfo;

import androidx.activity.ComponentActivity;
import androidx.annotation.NonNull;

import com.getcapacitor.Bridge;
import com.getcapacitor.JSObject;
import com.getcapacitor.Logger;
import com.getcapacitor.NativePlugin;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.community.stripe.googlepay.GooglePayExecutor;
import com.getcapacitor.community.stripe.helper.MetaData;
import com.getcapacitor.community.stripe.paymentintent.CheckoutFragment;
import com.getcapacitor.community.stripe.paymentflow.PaymentFlowExecutor;
import com.getcapacitor.community.stripe.paymentintent.PaymentIntentEvents;
import com.getcapacitor.community.stripe.paymentsheet.PaymentSheetExecutor;
import com.stripe.android.ApiResultCallback;
import com.stripe.android.PaymentConfiguration;
import com.stripe.android.Stripe;
import com.stripe.android.core.AppInfo;
import com.stripe.android.googlepaylauncher.GooglePayLauncher;
import com.stripe.android.model.PaymentIntent;
import com.stripe.android.model.StripeIntent;
import com.stripe.android.payments.paymentlauncher.PaymentLauncher;
import com.stripe.android.paymentsheet.PaymentSheet;
import org.jetbrains.annotations.NotNull;

import java.util.ArrayList;

@CapacitorPlugin(name = "Stripe", requestCodes = { 9972, 50000, 50001, 6000 })
public class StripePlugin extends Plugin {

    private String publishableKey;
    private String lastStripeAccountId = "";
    private String paymentSheetCallbackId;
    private String paymentFlowCallbackId;
    private String googlePayCallbackId;

    private MetaData metaData;

    private static final String APP_INFO_NAME = "@capacitor-community/stripe";

    private final PaymentSheetExecutor paymentSheetExecutor = new PaymentSheetExecutor(
        this::getContext,
            this::notifyListeners,
        getLogTag()
    );

    private final PaymentFlowExecutor paymentFlowExecutor = new PaymentFlowExecutor(
        this::getContext,
        this::getActivity,
        this::notifyListeners,
        getLogTag()
    );

    /**
     * Gets a plugin log tag with the child's class name as subTag.
     */
    /*private String getComponentActivity() {
        return this.bridge.get
    }*/

    private final GooglePayExecutor googlePayExecutor = new GooglePayExecutor(
        this::getContext,
        this::getActivity,
        this::notifyListeners,
        getLogTag()
    );

    /**
     * Update the StripeAccountId on PaymentConfiguration
     * @param sentStripeAccountId
     * @param force
     * @return boolean if updated
     */
    private boolean updatePaymentConfiguration(final String sentStripeAccountId, final boolean force) {
        final boolean update = force || sentStripeAccountId != lastStripeAccountId;
        // Could do publishableKey too but seems not needed, would be odd to change....
        if (update) {
            lastStripeAccountId = sentStripeAccountId;
            Logger.info("updatePaymentConfiguration with new stripeAccountId.");
            PaymentConfiguration.init(getContext(), publishableKey, sentStripeAccountId);
        }
        return update;
    }

    @Override
    public void load() {
        metaData = new MetaData(this::getContext);
        if (metaData.enableGooglePay) {
            this.publishableKey = metaData.publishableKey;

            PaymentConfiguration.init(getContext(), metaData.publishableKey, metaData.stripeAccount);
            Stripe.setAppInfo(AppInfo.create(APP_INFO_NAME));

            this.googlePayExecutor.googlePayLauncher =
                new GooglePayLauncher(
                    getActivity(),
                    new GooglePayLauncher.Config(metaData.googlePayEnvironment, metaData.countryCode, metaData.displayName),
                    (boolean isReady) -> this.googlePayExecutor.isAvailable = isReady,
                    (@NotNull GooglePayLauncher.Result result) ->
                        this.googlePayExecutor.onGooglePayResult(bridge, googlePayCallbackId, result)
                );
        } else {
            Logger.info("Plugin didn't prepare Google Pay.");
        }

        this.paymentSheetExecutor.paymentSheet =
            new PaymentSheet(
                getActivity(),
                result -> {
                    this.paymentSheetExecutor.onPaymentSheetResult(bridge, paymentSheetCallbackId, result);
                }
            );

        this.paymentFlowExecutor.flowController =
            PaymentSheet.FlowController.create(
                getActivity(),
                paymentOption -> {
                    this.paymentFlowExecutor.onPaymentOption(bridge, paymentFlowCallbackId, paymentOption);
                },
                result -> {
                    this.paymentFlowExecutor.onPaymentFlowResult(bridge, paymentFlowCallbackId, result);
                }
            );
    }

    @PluginMethod
    public void initialize(final PluginCall call) {
        try {
            final String stripeAccountId = call.getString("stripeAccount", null);
            if (publishableKey == null) {
                publishableKey = call.getString("publishableKey");

                if (publishableKey == null || publishableKey.equals("")) {
                    call.reject("you must provide a valid key");
                    return;
                }
                PaymentConfiguration.init(getContext(), publishableKey, stripeAccountId);
                Stripe.setAppInfo(AppInfo.create(APP_INFO_NAME));
            } else if (this.updatePaymentConfiguration(stripeAccountId, false)) {
                Logger.info("PaymentConfiguration.init was re initialised");
            } else {
                Logger.info("PaymentConfiguration.init was run at load");
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("unable to set publishable key: " + e.getLocalizedMessage(), e);
        }
    }
    @PluginMethod
    public void retrievePaymentIntent(final PluginCall call){
        final String stripeAccountId = call.getString("stripeAccount", null);
        final String clientSecret = call.getString("clientSecret", null);

        if (publishableKey == null) {
            publishableKey = call.getString("publishableKey");

            if (publishableKey == null || publishableKey.equals("")) {
                call.reject("you must provide a valid key");
                return;
            }
        }
        if(clientSecret == null){
            call.reject("you must provide a valid clientSecret");
            return;
        }
        new Stripe(getContext(), publishableKey, stripeAccountId)
                .retrievePaymentIntent(clientSecret, stripeAccountId, new ApiResultCallback<>() {
                    @Override
                    public void onSuccess(@NonNull PaymentIntent paymentIntent) {
                        if (paymentIntent.getStatus().equals(StripeIntent.Status.Succeeded)) {
                            notifyListeners(PaymentIntentEvents.Completed.getWebEventName(), new JSObject().put("paymentResult", PaymentIntentEvents.Completed.getWebEventName()));
                            call.resolve(new JSObject().put("paymentResult", PaymentIntentEvents.Completed.getWebEventName()));
                            return;
                        }
                        if (!paymentIntent.getStatus().equals(StripeIntent.Status.Succeeded)) {
                            final JSObject ret = new JSObject().put("error", paymentIntent.getLastErrorMessage());
                            ret.put("paymentResult", PaymentIntentEvents.Failed.getWebEventName());

                            notifyListeners(PaymentIntentEvents.Failed.getWebEventName(), new JSObject().put("paymentResult", PaymentIntentEvents.Completed.getWebEventName()));
                            call.resolve(ret);
                        }
                    }

                    @Override
                    public void onError(@NonNull Exception e) {
                        call.reject("error", e.getLocalizedMessage());
                    }
                });
    }

    @PluginMethod
    public void confirmPaymentIntent(final PluginCall call) {

        var currentFragment = new CheckoutFragment().getInstance(this.publishableKey, call);
        currentFragment.setCall(call);
        getActivity().getSupportFragmentManager()
            .beginTransaction()
            .add(R.id.webview, currentFragment, "CheckoutActivity")
                .commit();
    }

    @PluginMethod
    public void createPaymentSheet(final PluginCall call) {
        paymentSheetExecutor.createPaymentSheet(call);
    }

    @PluginMethod
    public void presentPaymentSheet(final PluginCall call) {
        paymentSheetCallbackId = call.getCallbackId();
        bridge.saveCall(call);

        paymentSheetExecutor.presentPaymentSheet(call);
    }

    @PluginMethod
    public void createPaymentFlow(final PluginCall call) {
        paymentFlowExecutor.createPaymentFlow(call);
    }

    @PluginMethod
    public void presentPaymentFlow(final PluginCall call) {
        paymentFlowCallbackId = call.getCallbackId();
        bridge.saveCall(call);

        paymentFlowExecutor.presentPaymentFlow(call);
    }

    @PluginMethod
    public void confirmPaymentFlow(final PluginCall call) {
        paymentFlowCallbackId = call.getCallbackId();
        bridge.saveCall(call);

        paymentFlowExecutor.confirmPaymentFlow(call);
    }

    @PluginMethod
    public void isApplePayAvailable(final PluginCall call) {
        call.unimplemented("Not implemented on Android.");
    }

    @PluginMethod
    public void createApplePay(final PluginCall call) {
        call.unimplemented("Not implemented on Android.");
    }

    @PluginMethod
    public void presentApplePay(final PluginCall call) {
        call.unimplemented("Not implemented on Android.");
    }

    @PluginMethod
    public void isGooglePayAvailable(final PluginCall call) {
        googlePayExecutor.isGooglePayAvailable(call);
    }

    @PluginMethod
    public void createGooglePay(final PluginCall call) {
        googlePayExecutor.createGooglePay(call);
    }

    @PluginMethod
    public void presentGooglePay(final PluginCall call) {
        googlePayCallbackId = call.getCallbackId();
        bridge.saveCall(call);

        googlePayExecutor.presentGooglePay(call);
    }

    @Override
    public Bridge getBridge() {
        return super.getBridge();
    }

    public ComponentActivity getComponentActivity() {
        return super.getActivity();
    }
}
