package com.getcapacitor.community.stripe.paymentintent

import android.app.Activity
import android.content.Context
import androidx.core.util.Supplier
import com.getcapacitor.Bridge
import com.getcapacitor.JSObject
import com.getcapacitor.PluginCall
import com.getcapacitor.community.stripe.models.Executor
import com.google.android.gms.common.util.BiConsumer
import com.stripe.android.model.ConfirmPaymentIntentParams
import com.stripe.android.payments.paymentlauncher.PaymentLauncher
import com.stripe.android.payments.paymentlauncher.PaymentResult

class PaymentIntentExecutor (
    contextSupplier: Supplier<Context?>?,
    activitySupplier: Supplier<Activity?>?,
    notifyListenersFunction: BiConsumer<String?, JSObject?>?,
    pluginLogTag: String?
) : Executor(
    contextSupplier,
    activitySupplier,
    notifyListenersFunction,
    pluginLogTag,
    "PaymentIntentExecutor"
) {
    @JvmField
    var paymentLauncher: PaymentLauncher? = null;

    private val emptyObject = JSObject()
    // private var stripeInstance: Stripe? = null

    init {
        this.contextSupplier = contextSupplier
    }


    fun confirmPaymentIntent(call: PluginCall) {
        val paymentIntentClientSecret = call.getString("clientSecret", null)
        val paymentMethodId = call.getString("paymentMethodId", null)
        val confirmParams = ConfirmPaymentIntentParams.createWithPaymentMethodId(
            paymentMethodId!!,
            paymentIntentClientSecret!!,
        )
        if (paymentLauncher == null){
            call.reject("No paymentLauncher")
        }
        paymentLauncher?.confirm(confirmParams)
    }

    fun onPaymentResult(bridge: Bridge, callbackId: String, paymentResult: PaymentResult) {
        val call = bridge.getSavedCall(callbackId)
        // val message =
            when (paymentResult) {
            is PaymentResult.Completed -> {
                notifyListenersFunction.accept(PaymentIntentEvents.Completed.webEventName, emptyObject)
                call.resolve()
            }
            is PaymentResult.Canceled -> {
                notifyListenersFunction.accept(PaymentIntentEvents.Canceled.webEventName, emptyObject)
                call.resolve()
            }
            is PaymentResult.Failed -> {
                // This string comes from the PaymentIntent's error message.
                // See here: https://stripe.com/docs/api/payment_intents/object#payment_intent_object-last_payment_error-message
                notifyListenersFunction.accept(PaymentIntentEvents.Failed.webEventName, JSObject().put("error", paymentResult.throwable.message))
                call.reject(PaymentIntentEvents.Failed.webEventName, JSObject().put("error", paymentResult.throwable.message))
            }
        }
    }
}