public enum PaymentIntentEvents: String {
    case Failed = "paymentIntentFailed"
    case Cancelled = "paymentIntentCancelled"
    case Succeeded = "paymentIntentCompleted"
}
