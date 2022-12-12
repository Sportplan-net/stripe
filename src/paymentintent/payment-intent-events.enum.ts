export enum PaymentIntentEventsEnum {
    Loaded = "paymentIntentLoaded",
    FailedToLoad = "paymentIntentFailedToLoad",
    Completed = "paymentIntentCompleted",
    Canceled = "paymentIntentCanceled",
    Failed = "paymentIntentFailed"
}

export type PaymentIntentResultInterface =
PaymentIntentEventsEnum.Completed
    | PaymentIntentEventsEnum.Canceled
    | PaymentIntentEventsEnum.Failed
    | PaymentIntentEventsEnum.FailedToLoad