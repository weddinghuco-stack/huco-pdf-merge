import "@/src/styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { Toaster } from "sonner";
import ClientLayout from "./wraper";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ClientLayout>
      <Head>
        <meta name='viewport' content='minimum-scale=1, initial-scale=1, width=device-width, shrink-to-fit=no, user-scalable=no, viewport-fit=cover' />
      </Head>

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
    </ClientLayout>
  );
}
