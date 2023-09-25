package com.getcapacitor.community.stripe;

import android.content.ContentResolver;
import android.content.res.Resources;
import android.net.Uri;
import androidx.activity.ComponentActivity;

import com.getcapacitor.Bridge;
import com.getcapacitor.JSObject;
import com.getcapacitor.Logger;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.community.stripe.googlepay.GooglePayExecutor;
import com.getcapacitor.community.stripe.helper.MetaData;
import com.getcapacitor.community.stripe.identityverification.IdentityVerificationSheetExecutor;
import com.getcapacitor.community.stripe.paymentintent.CheckoutFragment;
import com.getcapacitor.community.stripe.paymentflow.PaymentFlowExecutor;
import com.getcapacitor.community.stripe.paymentintent.PaymentIntentEvents;
import com.getcapacitor.community.stripe.paymentsheet.PaymentSheetExecutor;
import com.stripe.android.PaymentConfiguration;
import com.stripe.android.Stripe;
import com.stripe.android.core.AppInfo;
import com.stripe.android.googlepaylauncher.GooglePayLauncher;
import com.stripe.android.identity.IdentityVerificationSheet;
import com.stripe.android.model.SetupIntent;
import com.stripe.android.model.StripeIntent;
import com.stripe.android.paymentsheet.PaymentSheet;
import org.jetbrains.annotations.NotNull;
import java.util.Objects;

@CapacitorPlugin(name = "Stripe", requestCodes = { 9972, 50000, 50001, 6000 })
public class StripePlugin extends Plugin {

    private String publishableKey;
    private String lastStripeAccountId = "";
    private String paymentSheetCallbackId;
    private String paymentFlowCallbackId;
    private String googlePayCallbackId;

    private String identityVerificationCallbackId;

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

    private final IdentityVerificationSheetExecutor identityVerificationSheetExecutor = new IdentityVerificationSheetExecutor(
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
                    new GooglePayLauncher.Config(
                        metaData.googlePayEnvironment,
                        metaData.countryCode,
                        metaData.displayName,
                        metaData.emailAddressRequired,
                        new GooglePayLauncher.BillingAddressConfig(
                            metaData.billingAddressRequired,
                            Objects.equals(metaData.billingAddressFormat, "Full")
                                ? GooglePayLauncher.BillingAddressConfig.Format.Full
                                : GooglePayLauncher.BillingAddressConfig.Format.Min,
                            metaData.phoneNumberRequired
                        )
                    ),
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

        if (metaData.enableIdentifier) {
            Resources resources = getActivity().getApplicationContext().getResources();
            int resourceId = resources.getIdentifier("ic_launcher", "mipmap", getActivity().getPackageName());
            Uri icon = new Uri.Builder()
                .scheme(ContentResolver.SCHEME_ANDROID_RESOURCE)
                .authority(resources.getResourcePackageName(resourceId))
                .appendPath(resources.getResourceTypeName(resourceId))
                .appendPath(resources.getResourceEntryName(resourceId))
                .build();

            this.identityVerificationSheetExecutor.verificationSheet =
                IdentityVerificationSheet.Companion.create(
                    getActivity(),
                    new IdentityVerificationSheet.Configuration(icon),
                    verificationFlowResult -> {
                        // handle verificationResult
                        if (verificationFlowResult instanceof IdentityVerificationSheet.VerificationFlowResult.Completed) {
                            // The user has completed uploading their documents.
                            // Let them know that the verification is processing.
                            this.identityVerificationSheetExecutor.onVerificationCompleted(bridge, identityVerificationCallbackId);
                        } else if (verificationFlowResult instanceof IdentityVerificationSheet.VerificationFlowResult.Canceled) {
                            // The user did not complete uploading their documents.
                            // You should allow them to try again.
                            this.identityVerificationSheetExecutor.onVerificationCancelled(bridge, identityVerificationCallbackId);
                        } else if (verificationFlowResult instanceof IdentityVerificationSheet.VerificationFlowResult.Failed) {
                            // If the flow fails, you should display the localized error
                            // message to your user using throwable.getLocalizedMessage()
                            this.identityVerificationSheetExecutor.onVerificationFailed(bridge, identityVerificationCallbackId);
                        }
                    }
                );
        }
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
    public void retrieveSetupIntent(final PluginCall call){
        final String stripeAccountId = call.getString("stripeAccount", null);
        final String clientSecret = call.getString("clientSecret", null);

        if (publishableKey == null) {
            publishableKey = call.getString("publishableKey");

            if (publishableKey == null || publishableKey.equals("")) {
                call.reject("you must provide a valid key");
                return;
            }
        }
        if(clientSecret == null) {
            call.reject("you must provide a valid clientSecret");
            return;
        }
        SetupIntent si = null;
        try {
            si = new Stripe(getContext(), publishableKey, stripeAccountId)
                    .retrieveSetupIntentSynchronous(clientSecret, stripeAccountId);
        } catch (Exception e) {
            call.reject("error", e.getLocalizedMessage());
        }

        if (si != null && si.getStatus().equals(StripeIntent.Status.Succeeded)) {
            notifyListeners(PaymentIntentEvents.Completed.getWebEventName(), new JSObject().put("paymentResult", PaymentIntentEvents.Completed.getWebEventName()));
            call.resolve(new JSObject().put("paymentResult", PaymentIntentEvents.Completed.getWebEventName()));
        } else if (si == null ) {
            final JSObject ret = new JSObject().put("error", "Failed to fetch SetupIntent");
            ret.put("paymentResult", PaymentIntentEvents.Failed.getWebEventName());

            notifyListeners(PaymentIntentEvents.Failed.getWebEventName(), new JSObject().put("paymentResult", PaymentIntentEvents.Completed.getWebEventName()));
            call.resolve(ret);
        } else if(!si.getStatus().equals(StripeIntent.Status.Succeeded)) {
            final JSObject ret = new JSObject().put("error", si.getLastErrorMessage());
            ret.put("paymentResult", PaymentIntentEvents.Failed.getWebEventName());

            notifyListeners(PaymentIntentEvents.Failed.getWebEventName(), new JSObject().put("paymentResult", PaymentIntentEvents.Completed.getWebEventName()));
            call.resolve(ret);
        }
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
    public void createIdentityVerificationSheet(final PluginCall call) {
        identityVerificationSheetExecutor.createIdentityVerificationSheet(call);
    }

    @PluginMethod
    public void presentIdentityVerificationSheet(final PluginCall call) {
        identityVerificationCallbackId = call.getCallbackId();
        bridge.saveCall(call);

        identityVerificationSheetExecutor.presentIdentityVerificationSheet(call);
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

        /* this.paymentSheetFragment = new CheckOutFragment().getInstance();
        this.paymentSheetFragment.setCall(call);
        getActivity().getSupportFragmentManager()
                .beginTransaction()
                .add(0, this.paymentSheetFragment, "CheckOutActivity")
                .commit(); */

    }

    @PluginMethod
    public void presentPaymentFlow(final PluginCall call) {
        paymentFlowCallbackId = call.getCallbackId();
        bridge.saveCall(call);


        paymentFlowExecutor.presentPaymentFlow(call);
        // this.paymentSheetFragment.presentPaymentFlow(call);
    }

    @PluginMethod
    public void confirmPaymentFlow(final PluginCall call) {
        paymentFlowCallbackId = call.getCallbackId();
        bridge.saveCall(call);

        paymentFlowExecutor.confirmPaymentFlow(call);
        /* this.paymentSheetFragment.setCall(call);
        this.paymentSheetFragment.confirmPaymentFlow(call); */
    }

    @PluginMethod
    public void clean(final PluginCall call) {
        /* Logger.info("Cleaning....");
        try {
            getActivity().getSupportFragmentManager()
                    .beginTransaction()
                    .remove(this.paymentSheetFragment)
                    .commit();
        } catch (Exception e) {
            call.reject("error", e);
            return;
        } */
        call.resolve();
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
