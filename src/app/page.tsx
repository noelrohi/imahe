import { redirect } from "next/navigation";

export default function Page() {
  redirect("/login");
  return <div>Hello World</div>;
}
