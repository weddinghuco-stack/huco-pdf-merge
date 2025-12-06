import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { Toaster } from "sonner";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Toaster
        position='bottom-right'
        duration={5000}
        toastOptions={{
          unstyled: true,
          classNames: {
            toast: "toast",
            title: "title",
            error: "error",
            info: "info",
            description: "description",
            actionButton: "action-button",
            cancelButton: "cancel-button",
            closeButton: "close-button"
          }
        }}
      />
      <Component {...pageProps} />
    </>
  );
}
