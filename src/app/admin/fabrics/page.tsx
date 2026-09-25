import { Suspense } from "react";
import { FabricScreen } from "@/screens/FabricScreen";

export default function Page() {
  return (
    <Suspense>
      <FabricScreen />
    </Suspense>
  );
}
