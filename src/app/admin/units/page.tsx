import { Suspense } from "react";
import { UnitScreen } from "@/screens/UnitScreen";

export default function Page() {
  return (
    <Suspense>
      <UnitScreen />
    </Suspense>
  );
}
