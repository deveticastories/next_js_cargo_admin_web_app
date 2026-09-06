import { redirect } from "next/navigation";

/** The admin panel is the whole app for now — send visitors straight there. */
export default function Home() {
  redirect("/admin");
}
