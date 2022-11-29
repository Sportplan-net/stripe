import StripePayments
import Capacitor

class PaymentIntenetExecutor: NSObject, STPAuthenticationContext {
    func authenticationPresentingViewController() -> UIViewController {
        return (UIApplication.shared.keyWindow?.rootViewController)!
    }
    
    public weak var plugin: CAPPlugin?
    
    @objc func confirmPaymentIntent(_ call: CAPPluginCall) {
            let stripeAccount = call.getString("stripeAccount") ?? ""
            let clientSecret = call.getString("clientSecret") ?? ""
            let paymentMethodId = call.getString("paymentMethodId") ?? ""

            if (clientSecret.isEmpty || paymentMethodId.isEmpty) {
                call.reject("Missing params")
                return
            }
            
            if stripeAccount != "" {
                STPAPIClient.shared.stripeAccount = stripeAccount
            }
            let pip: STPPaymentIntentParams = STPPaymentIntentParams.init(clientSecret: clientSecret)
            pip.paymentMethodId = paymentMethodId
            let pm = STPPaymentHandler.shared()
            pm.confirmPayment(pip, with: self) { (status, pi, err) in
                       switch status {
                       case .failed:
                           if err != nil {
                               let errorMessage = err?.localizedDescription ?? "payment failed"
                               self.plugin?.notifyListeners(PaymentIntentEvents.Failed.rawValue, data: ["error": errorMessage])
                               call.reject(errorMessage)
                           } else {
                               self.plugin?.notifyListeners(PaymentIntentEvents.Failed.rawValue, data: ["error": "payment failed"])
                               call.reject("payment failed")
                           }

                       case .canceled:
                           self.plugin?.notifyListeners(PaymentIntentEvents.Cancelled.rawValue, data: ["error": "payment failed"])
                           call.reject("user cancelled the transaction")

                       case .succeeded:
                           self.plugin?.notifyListeners(PaymentIntentEvents.Succeeded.rawValue, data: ["succeeded": pi!.allResponseFields as! PluginCallResultData])
                           call.resolve(pi!.allResponseFields as! PluginCallResultData)
                       }
                   }
        }
}
