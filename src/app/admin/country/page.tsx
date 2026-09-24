import { Suspense } from "react";
import { CountryScreen } from "@/screens/CountryScreen";

export default function Page() {
  return (
    <Suspense>
      <CountryScreen />
    </Suspense>
  );
}
