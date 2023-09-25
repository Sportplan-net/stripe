package com.getcapacitor.community.stripe.paymentflow

import android.content.Context
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import com.getcapacitor.JSObject
import com.getcapacitor.Logger
import com.getcapacitor.PluginCall
import com.google.android.gms.wallet.WalletConstants.PaymentMethod
import com.stripe.android.PaymentConfiguration
import com.stripe.android.paymentsheet.CreateIntentCallback
import com.stripe.android.paymentsheet.CreateIntentResult
import com.stripe.android.paymentsheet.PaymentSheet
import com.stripe.android.paymentsheet.PaymentSheetResult
import com.stripe.android.paymentsheet.model.PaymentOption

class CheckOutFragment : Fragment() {

    /**
     * Don't forget to set before transitioning this into view
     */
    var call: PluginCall? = null;

    private lateinit var flowController: PaymentSheet.FlowController
    private var paymentConfiguration: PaymentSheet.Configuration? = null

    /// protected lateinit var notifyListenersFunction: BiConsumer<String, JSObject>;

    // val createIntentCallback = CreateIntentCallback { paymentMethod, shouldSavePaymentMethod -> this.onCreateIntent(paymentMethod, shouldSavePaymentMethod) }

    // val paymentSheetResultCallback = PaymentSheetResultCallback { paymentSheetResult: PaymentSheetResult -> this.onPaymentFlowResult(paymentSheetResult) }

    fun getInstance(): CheckOutFragment {

        /*val bundle = Bundle()
        bundle.putString("publishableKey", publishableKey)
        bundle.putString("paymentMethodId", call.getString("paymentMethodId", null))
        bundle.putString("stripeAccountId", call.getString("stripeAccount", null))
        bundle.putString("paymentIntentClientSecret", call.getString("clientSecret", null))*/

        val fragment = CheckOutFragment()
        // fragment.arguments = bundle
        return fragment
    }

    fun createPaymentFlow() {

        val paymentIntentClientSecret = call?.getString("paymentIntentClientSecret", null)
        val setupIntentClientSecret = call?.getString("setupIntentClientSecret", null)
        val customerEphemeralKeySecret = call?.getString("customerEphemeralKeySecret", null)
        val customerId = call?.getString("customerId", null)
        if (paymentIntentClientSecret == null && setupIntentClientSecret == null) {
            val errorText = "Invalid Params. This method require paymentIntentClientSecret or setupIntentClientSecret."
            call?.reject(errorText)
            return
        }
        if (customerId != null && customerEphemeralKeySecret == null) {
            val errorText = "Invalid Params. When you set customerId, you must set customerEphemeralKeySecret."
            call?.reject(errorText)
            return
        }
        var merchantDisplayName = call?.getString("merchantDisplayName")
        if (merchantDisplayName == null) {
            merchantDisplayName = ""
        }
        val enableGooglePay = call?.getBoolean("enableGooglePay", false)
        val customer: PaymentSheet.CustomerConfiguration? = customerEphemeralKeySecret?.let { PaymentSheet.CustomerConfiguration(it, customerEphemeralKeySecret) }
        if (!enableGooglePay!!) {
            paymentConfiguration = PaymentSheet.Configuration(merchantDisplayName, customer)
        } else {
            val GooglePayEnvironment = call?.getBoolean("GooglePayIsTesting", false)
            var environment: PaymentSheet.GooglePayConfiguration.Environment = PaymentSheet.GooglePayConfiguration.Environment.Production
            if (GooglePayEnvironment!!) {
                environment = PaymentSheet.GooglePayConfiguration.Environment.Test
            }
            paymentConfiguration = PaymentSheet.Configuration(
                    merchantDisplayName,
                    customer,
                    call?.getString("countryCode", "US")?.let { PaymentSheet.GooglePayConfiguration(environment, it) }
            )
        }
        if (setupIntentClientSecret != null) {
            Logger.info("Spinning up....")
            flowController.configureWithSetupIntent(
                    setupIntentClientSecret,
                    paymentConfiguration
            ) { isReady, error ->
                Logger.info("Span up....")
                if (isReady) {
                    call?.resolve()
                } else {
                    call?.reject(error?.localizedMessage)
                }
            }
        } else if (paymentIntentClientSecret != null) {
            flowController.configureWithPaymentIntent(
                    paymentIntentClientSecret,
                    paymentConfiguration
            ) { success: Boolean, error: Throwable? ->
                if (success) {
                    call?.resolve()
                } else {
                    call?.reject(error?.localizedMessage)
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        Logger.info("Got onDestroy ");
    }


    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        flowController = PaymentSheet.FlowController.create(
                this,
                { paymentOption ->
                    Logger.info("Got onPaymentOption " + paymentOption?.label);
                    if (paymentOption != null) {
                        /*notifyListenersFunction.accept(
                                PaymentFlowEvents.Created.webEventName,
                                JSObject().put("cardNumber", paymentOption.label)
                        )*/
                        call?.resolve(JSObject().put("cardNumber", paymentOption.label))
                    } else {
                        // notifyListenersFunction.accept(PaymentFlowEvents.Canceled.webEventName, JSObject())
                        call?.reject("User close PaymentFlow Sheet")
                    }
                },
                { paymentSheetResult ->
                        Logger.info("Got onPaymentFlowResult ");
                        if (paymentSheetResult == null) {
                            // notifyListenersFunction.accept(PaymentFlowEvents.Canceled.webEventName, JSObject())
                            call?.resolve(JSObject().put("paymentResult", PaymentFlowEvents.Failed.webEventName))
                        } else if (paymentSheetResult is PaymentSheetResult.Canceled) {
                            call?.resolve(JSObject().put("paymentResult", PaymentFlowEvents.Canceled.webEventName))
                        } else if (paymentSheetResult is PaymentSheetResult.Failed) {
                            /*notifyListenersFunction.accept(
                                    PaymentFlowEvents.Failed.webEventName,
                                    JSObject().put("error", paymentSheetResult.error.getLocalizedMessage())
                            )*/
                            call?.resolve(JSObject().put("paymentResult", PaymentFlowEvents.Failed.webEventName)
                                    .put("error", paymentSheetResult.error.getLocalizedMessage()))

                        } else if (paymentSheetResult is PaymentSheetResult.Completed) {
                            //notifyListenersFunction.accept(PaymentFlowEvents.Completed.webEventName, JSObject())
                            call?.resolve(JSObject().put("paymentResult", PaymentFlowEvents.Completed.webEventName))
                        }
                }
        )
        this.createPaymentFlow()
    }

    fun presentPaymentFlow(call: PluginCall) {
        try {
            // this.createPaymentFlow()
            this.call = call;
            Logger.info("PaymentOption label" + flowController.getPaymentOption()?.label);
            flowController.shippingDetails = null

            flowController.presentPaymentOptions()
        } catch (ex: Exception) {
            call?.reject(ex.localizedMessage, ex)
        }
    }

    fun confirmPaymentFlow(call: PluginCall) {
        try {
            flowController.confirm()
        } catch (ex: Exception) {
            call.reject(ex.localizedMessage, ex)
        }
    }


    fun onPaymentOption(paymentOption: PaymentOption?) {

    }

    fun onPaymentFlowResult(paymentSheetResult: PaymentSheetResult?) {
        Logger.info("Got onPaymentFlowResult ");
        if (paymentSheetResult == null) {
            // notifyListenersFunction.accept(PaymentFlowEvents.Canceled.webEventName, JSObject())
            call?.resolve(JSObject().put("paymentResult", PaymentFlowEvents.Failed.webEventName))
        } else if (paymentSheetResult is PaymentSheetResult.Canceled) {
            call?.resolve(JSObject().put("paymentResult", PaymentFlowEvents.Canceled.webEventName))
        } else if (paymentSheetResult is PaymentSheetResult.Failed) {
            /*notifyListenersFunction.accept(
                    PaymentFlowEvents.Failed.webEventName,
                    JSObject().put("error", paymentSheetResult.error.getLocalizedMessage())
            )*/
            call?.resolve(JSObject().put("paymentResult", PaymentFlowEvents.Failed.webEventName)
                    .put("error", paymentSheetResult.error.getLocalizedMessage()))

        } else if (paymentSheetResult is PaymentSheetResult.Completed) {
            //notifyListenersFunction.accept(PaymentFlowEvents.Completed.webEventName, JSObject())
            call?.resolve(JSObject().put("paymentResult", PaymentFlowEvents.Completed.webEventName))
        }
    }
}