import { Suspense } from "react";
import { ProductScreen } from "@/screens/ProductScreen";

export default function Page() {
  return (
    <Suspense>
      <ProductScreen />
    </Suspense>
  );
}
