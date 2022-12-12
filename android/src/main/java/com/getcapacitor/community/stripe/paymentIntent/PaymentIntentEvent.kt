package com.getcapacitor.community.stripe.paymentintent;

enum class PaymentIntentEvents(val webEventName: String) {
    Loaded("paymentIntentLoaded"),
    FailedToLoad("paymentIntentFailedToLoad"),
    Opened("paymentIntentOpened"),
    FailedToOpen("paymentIntentFailedToOpen"),
    Completed("paymentIntentCompleted"),
    Canceled("paymentIntentCanceled"),
    Failed("paymentIntentFailed"),
    Created("paymentIntentCreated"),
}
