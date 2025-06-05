import { SignUpForm } from "@/components/auth/sign-up-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Signup",
  description: "Signup page",
};

export default function SignupPage() {
  return <SignUpForm />;
}
