package com.getcapacitor.community.stripe.models;

import android.app.Activity;
import android.content.Context;

import androidx.activity.ComponentActivity;
import androidx.annotation.Nullable;
import androidx.core.util.Supplier;
import com.getcapacitor.JSObject;
import com.getcapacitor.Logger;
import com.getcapacitor.PluginCall;
import com.getcapacitor.Plugin;
import com.google.android.gms.common.util.BiConsumer;

public abstract class Executor {

    protected Supplier<Context> contextSupplier;
    protected final Supplier<Activity> activitySupplier;
    protected BiConsumer<String, JSObject> notifyListenersFunction;
    protected final String logTag;

    // Eventually we can change the notification directly here!
    protected void notifyListeners(String eventName, JSObject data) {
        notifyListenersFunction.accept(eventName, data);
    }

    /**
     * Resolve a call fetched with bridge.getSavedCall(callbackId), tolerating null.
     *
     * The saved call is null when Android destroyed and recreated the host Activity while a
     * Stripe sheet was open (low memory, or "Don't keep activities"): the new plugin instance
     * has no callbackId and the new Bridge has no saved calls, yet Stripe still delivers the
     * sheet's result to the new instance. The WebView has reloaded, so there is no JS promise
     * left to settle — the caller has already emitted the outcome via notifyListeners.
     */
    protected void resolveSavedCall(@Nullable PluginCall call, String method, JSObject ret) {
        if (call == null) {
            Logger.warn(logTag, "stripe-null-saved-call: " + method + " result arrived with no saved PluginCall (Activity recreated?); delivered as event only: " + ret);
            return;
        }
        call.resolve(ret);
    }

    /** Reject counterpart of {@link #resolveSavedCall}. */
    protected void rejectSavedCall(@Nullable PluginCall call, String method, String message) {
        if (call == null) {
            Logger.warn(logTag, "stripe-null-saved-call: " + method + " result arrived with no saved PluginCall (Activity recreated?); delivered as event only: " + message);
            return;
        }
        call.reject(message);
    }

    public Executor(
        Supplier<Context> contextSupplier,
        Supplier<Activity> activitySupplier,
        BiConsumer<String, JSObject> notifyListenersFunction,
        String pluginLogTag,
        String executorTag
    ) {
        this.contextSupplier = contextSupplier;
        this.activitySupplier = activitySupplier;
        this.notifyListenersFunction = notifyListenersFunction;
        this.logTag = pluginLogTag + "|" + executorTag;
    }
}
