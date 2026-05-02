import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { supabase } from "@/lib/supabase";
import { setAuthTokenGetter } from "@workspace/api-client-react";

declare const OneSignal: any;

setAuthTokenGetter(async () => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
});

window.addEventListener("load", () => {
  if (typeof OneSignal !== "undefined") {
    try {
      OneSignal.init({
        appId: "529e4cd6-308d-4161-98be-22faea476b79",
        notifyButton: { enable: false },
        allowLocalhostAsSecureOrigin: true,
      });
    } catch (e) {
      console.warn("OneSignal init failed:", e);
    }
  }
});

createRoot(document.getElementById("root")!).render(<App />);
