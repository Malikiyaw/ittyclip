import type { Metadata } from "next";
import AuthPage from "@/components/AuthPage";

export const metadata: Metadata = {
  title: "Sign in — ittyclip",
  description:
    "Sign in to ittyclip and start clipping your long videos into gold — entirely in your browser.",
};

export default function AuthRoute() {
  return <AuthPage />;
}
