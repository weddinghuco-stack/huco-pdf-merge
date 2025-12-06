"use client";

import type React from "react";
import { useEffect } from "react";

import { InstallPrompt } from "../components/install-prompt";

const ClientLayout: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          console.log("[SW] Registered successfully:", registration);
        })
        .catch((error) => {
          console.error("[SW] Registration failed:", error);
        });
    }
  }, []);

  return (
    <>
      <InstallPrompt />
      {children}
    </>
  );
};

export default ClientLayout;
