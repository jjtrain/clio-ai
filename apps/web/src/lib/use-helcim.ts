"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const HELCIM_SCRIPT_URL =
  "https://secure.helcim.app/helcim-pay/services/start.js";

interface HelcimTransactionResult {
  transactionId: string;
  approvalCode: string;
  cardNumber: string;
  cardType: string;
  amount: string;
  hash: string;
  rawResponse: string;
}

interface UseHelcimOptions {
  onSuccess: (result: HelcimTransactionResult) => void;
  onError: (error: string) => void;
  onClose?: () => void;
}

declare global {
  interface Window {
    appendHelcimPayIframe?: (checkoutToken: string) => void;
  }
}

export function useHelcim({ onSuccess, onError, onClose }: UseHelcimOptions) {
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const callbacksRef = useRef({ onSuccess, onError, onClose });

  // Keep callbacks ref current without triggering re-effects
  callbacksRef.current = { onSuccess, onError, onClose };

  // Lazy-load the HelcimPay.js script
  useEffect(() => {
    const existingScript = document.querySelector(
      `script[src="${HELCIM_SCRIPT_URL}"]`
    );
    if (existingScript) {
      setIsScriptLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = HELCIM_SCRIPT_URL;
    script.async = true;
    script.onload = () => setIsScriptLoaded(true);
    script.onerror = () => {
      console.error("Failed to load HelcimPay.js script");
      setIsScriptLoaded(false);
    };
    document.head.appendChild(script);
  }, []);

  // Listen for postMessage events from the Helcim iframe
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // Only handle messages from Helcim
      if (
        typeof event.data !== "object" ||
        !event.data ||
        !event.data.eventName
      ) {
        return;
      }

      const { eventName, eventStatus, eventMessage } = event.data;

      if (eventName === "helcim-pay-js-transaction") {
        if (eventStatus === "APPROVED") {
          const rawResponse = JSON.stringify(event.data);
          callbacksRef.current.onSuccess({
            transactionId: event.data.transactionId || "",
            approvalCode: event.data.approvalCode || "",
            cardNumber: event.data.cardNumber || "",
            cardType: event.data.cardType || "",
            amount: event.data.amount || "",
            hash: event.data.hash || "",
            rawResponse,
          });
          setIsProcessing(false);
        } else {
          callbacksRef.current.onError(
            eventMessage || "Payment was not approved"
          );
          setIsProcessing(false);
        }
      } else if (eventName === "helcim-pay-js-modal-closed") {
        callbacksRef.current.onClose?.();
        setIsProcessing(false);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const openCheckout = useCallback(
    (checkoutToken: string) => {
      if (!isScriptLoaded || !window.appendHelcimPayIframe) {
        onError("Payment script not loaded yet. Please try again.");
        return;
      }
      setIsProcessing(true);
      window.appendHelcimPayIframe(checkoutToken);
    },
    [isScriptLoaded, onError]
  );

  return { isScriptLoaded, openCheckout, isProcessing };
}
