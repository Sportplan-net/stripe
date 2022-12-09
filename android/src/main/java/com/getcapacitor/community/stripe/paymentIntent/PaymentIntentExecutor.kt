package com.getcapacitor.community.stripe.paymentIntent

import android.app.Activity
import android.content.Context
import androidx.activity.ComponentActivity
import androidx.core.util.Supplier
import com.getcapacitor.Bridge
import com.getcapacitor.JSObject
import com.getcapacitor.PluginCall
import com.getcapacitor.community.stripe.models.Executor
import com.google.android.gms.common.util.BiConsumer
import com.stripe.android.model.ConfirmPaymentIntentParams
import com.stripe.android.model.ConfirmSetupIntentParams
import com.stripe.android.payments.paymentlauncher.PaymentLauncher
import com.stripe.android.payments.paymentlauncher.PaymentResult

class PaymentIntentExecutor (
    contextSupplier: Supplier<Context?>?,
    activitySupplier: Supplier<Activity?>?,
    componentActivitySupplier: Supplier<ComponentActivity?>?,
    notifyListenersFunction: BiConsumer<String?, JSObject?>?,
    pluginLogTag: String?
) : Executor(
    contextSupplier,
    activitySupplier,
    componentActivitySupplier,
    notifyListenersFunction,
    pluginLogTag,
    "PaymentIntentExecutor"
) {
    @JvmField
    var paymentLauncher: PaymentLauncher? = null;

    // private val emptyObject = JSObject()
    // private var stripeInstance: Stripe? = null

    init {
        this.contextSupplier = contextSupplier
        /*val (publishableKey, stripeAccountId) = PaymentConfiguration.getInstance(this.activitySupplier.get())
        try{
            paymentLauncher = componentActivitySupplier?.get()?.let {
                PaymentLauncher.Companion.create(
                    it,
                    publishableKey,
                    stripeAccountId,
                    :: onPaymentResult
                )
            }
        } catch (e: Exception) {

        }*/
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
                notifyListenersFunction.accept(PaymentResult.Completed.toString(), JSObject().put("paymentResult", paymentResult.toString()))
                call.resolve(JSObject().put("paymentResult", paymentResult))
            }
            is PaymentResult.Canceled -> {
                notifyListenersFunction.accept(PaymentResult.Canceled.toString(), JSObject().put("paymentResult", paymentResult.toString()))
                call.resolve(JSObject().put("PaymentResult.Canceled.toString()", paymentResult))
            }
            is PaymentResult.Failed -> {
                // This string comes from the PaymentIntent's error message.
                // See here: https://stripe.com/docs/api/payment_intents/object#payment_intent_object-last_payment_error-message
                notifyListenersFunction.accept("Failed", JSObject().put("paymentResult", paymentResult.throwable.message))
                call.reject("Failed", JSObject().put("paymentResult", paymentResult.throwable.message))
            }
        }
    }

    /*fun confirmPaymentIntent(call: PluginCall) {
        val paymentIntentClientSecret = call.getString("clientSecret", null)
        val paymentMethodId = call.getString("paymentMethodId", null)
        val stripeAccountId = call.getString("stripeAccount", null)
        val confirmParams = ConfirmPaymentIntentParams.createWithPaymentMethodId(
            paymentMethodId!!, paymentIntentClientSecret!!, null, false
        )
        paymentLauncher.confirm(confirmParams)
        stripeInstance = Stripe(contextSupplier.get(), stripeAccountId!!)
        val activity = ComponentActivity()
        activity.registerForActivityResult(
            activitySupplier.get(),
            object : ActivityResultCallback<Any?> {
                fun handleOnActivityResult(requestCode: Int?, resultCode: Int?, data: Intent?) {}
            })
        stripeInstance!!.confirmPayment(ComponentActivity(), params)
    }*/
}