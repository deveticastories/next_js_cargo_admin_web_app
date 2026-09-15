import { Suspense } from "react";
import { CustomersScreen } from "@/screens/CustomersScreen";

export default function Page() {
  return (
    <Suspense>
      <CustomersScreen />
    </Suspense>
  );
}
