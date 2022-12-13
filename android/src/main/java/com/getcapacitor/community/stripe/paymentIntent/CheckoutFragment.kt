package com.getcapacitor.community.stripe.paymentintent

import android.os.Bundle
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.getcapacitor.JSObject
import com.getcapacitor.PluginCall
import com.stripe.android.model.ConfirmPaymentIntentParams
import com.stripe.android.payments.paymentlauncher.PaymentLauncher
import com.stripe.android.payments.paymentlauncher.PaymentResult
import kotlinx.coroutines.launch

class CheckoutFragment : Fragment() {

    private lateinit var paymentLauncher: PaymentLauncher
    private val emptyObject = JSObject()

    /**
     * Don't forget to set before transitioning this into view
     */
    var call: PluginCall? = null;

    fun getInstance(publishableKey: String, call: PluginCall): CheckoutFragment {

        val bundle = Bundle()
        bundle.putString("publishableKey", publishableKey)
        bundle.putString("paymentMethodId", call.getString("paymentMethodId", null))
        bundle.putString("stripeAccountId", call.getString("stripeAccount", null))
        bundle.putString("paymentIntentClientSecret", call.getString("clientSecret", null))

        val fragment = CheckoutFragment()
        fragment.arguments = bundle
        return fragment
    }

    override fun onCreate(savedInstanceState: Bundle?) {

        super.onCreate(savedInstanceState)

        val publishableKey = arguments?.getString("publishableKey", null)
        val stripeAccountId = arguments?.getString("stripeAccountId", null)

        val paymentMethodId = arguments?.getString("paymentMethodId", null)
        val paymentIntentClientSecret = arguments?.getString("paymentIntentClientSecret", null)

        if (publishableKey == null){
            this.call?.reject("Missing publishableKey", emptyObject)
            return
        } else if (paymentMethodId == null){
            this.call?.reject("Missing paymentMethodId", emptyObject)
            return
        } else if (paymentIntentClientSecret == null){
            this.call?.reject("Missing paymentIntentClientSecret", emptyObject)
            return
        }
        paymentLauncher = PaymentLauncher.Companion.create(
           this,
            publishableKey,
            stripeAccountId,
             ::onPaymentResult
        )
        startCheckout(paymentMethodId, paymentIntentClientSecret)
    }

    /**
     * Open PaymentIntent confirm dialog
     */
    fun startCheckout(paymentMethodId: String, paymentIntentClientSecret: String) {

        val confirmParams = ConfirmPaymentIntentParams.createWithPaymentMethodId(
            paymentMethodId,
            paymentIntentClientSecret,
        )

       lifecycleScope.launch {
            paymentLauncher.confirm(confirmParams)
       }
    }

    private fun onPaymentResult(paymentResult: PaymentResult) {
        when (paymentResult) {
            is PaymentResult.Completed -> {
                call?.resolve(JSObject().put("paymentResult", PaymentIntentEvents.Completed.webEventName))
            }
            is PaymentResult.Canceled -> {
                call?.resolve(JSObject().put("paymentResult", PaymentIntentEvents.Canceled.webEventName))
            }
            is PaymentResult.Failed -> {
                // This string comes from the PaymentIntent's error message.
                // See here: https://stripe.com/docs/api/payment_intents/object#payment_intent_object-last_payment_error-message
                call?.resolve(JSObject().put("error", paymentResult.throwable.message))
            }
        }
    }
}