import { Suspense } from "react";
import { LoginScreen } from "@/screens/LoginScreen";
import "@/app/admin/admin.css";

export default function Page() {
  // LoginScreen reads `?from=` via useSearchParams, which Next.js requires
  // to be wrapped in Suspense so the rest of the page can still prerender.
  return (
    <Suspense>
      <LoginScreen />
    </Suspense>
  );
}
