import StripePayments
import Capacitor

class PaymentIntenetExecutor: NSObject, STPAuthenticationContext {
    func authenticationPresentingViewController() -> UIViewController {
        return (UIApplication.shared.keyWindow?.rootViewController)!
    }
    
    // public weak var plugin: CAPPlugin?
    
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
                   let errorMessage = err?.localizedDescription ?? "payment failed"
                   if err != nil {
                       // self.plugin?.notifyListeners(PaymentIntentEvents.Failed.rawValue, data: ["error": errorMessage])
                       call.resolve(["error": errorMessage, "debugError": err?.userInfo ?? ""])
                   } else {
                       // self.plugin?.notifyListeners(PaymentIntentEvents.Failed.rawValue, data: ["error": "payment failed"])
                       call.resolve(["error": errorMessage])
                   }

               case .canceled:
                   //self.plugin?.notifyListeners(PaymentIntentEvents.Cancelled.rawValue, data: ["error": "payment failed"])
                   call.resolve(["paymentResult": PaymentIntentEvents.Cancelled.rawValue]);
               case .succeeded:
                   /* self.plugin?.notifyListeners(PaymentIntentEvents.Succeeded.rawValue, data: ["succeeded": pi!.allResponseFields as! PluginCallResultData]) */
                   call.resolve(["paymentResult": PaymentIntentEvents.Succeeded.rawValue])
            }
            STPAPIClient.shared.stripeAccount = nil
        }
    }
}
