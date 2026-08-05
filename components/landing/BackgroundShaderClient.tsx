"use client";

import dynamic from "next/dynamic";

const BackgroundShader = dynamic(
  () => import("@/components/landing/BackgroundShader").then((m) => m.BackgroundShader),
  {
    ssr: false,
    loading: () => null,
  }
);

export default function BackgroundShaderClient() {
  return <BackgroundShader />;
}
