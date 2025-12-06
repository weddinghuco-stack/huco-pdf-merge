"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      queueMicrotask(() => setIsInstalled(true));
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    const handleAppInstalled = () => {
      navigator.serviceWorker.ready.then((reg) => {
        reg.active?.postMessage({
          type: "CACHE_URLS",
          payload: ["/"]
        });
      });
      console.log("[App] PWA was installed");
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[App] User response to install prompt: ${outcome}`);

    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setShowPrompt(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  if (!showPrompt || isInstalled) {
    return null;
  }

  return (
    <div className='fixed top-4 left-4 right-4 bg-card border border-border rounded-lg shadow-lg p-4 z-50 max-w-sm'>
      <div className='flex items-start gap-3'>
        <div className='flex-1'>
          <h3 className='font-semibold text-foreground mb-1'>Install App</h3>
          <p className='text-sm mb-3 text-muted-foreground'>Install this app to use offline with full features.</p>
          <div className='flex gap-2'>
            <button onClick={handleInstall} className='flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity'>
              <Download className='w-4 h-4' />
              Install
            </button>
            <button onClick={handleDismiss} className='px-3 py-2 bg-muted text-muted-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity'>
              Later
            </button>
          </div>
        </div>
        <button onClick={handleDismiss} className='text-muted-foreground hover:text-foreground transition-colors'>
          <X className='w-5 h-5' />
        </button>
      </div>
    </div>
  );
}
