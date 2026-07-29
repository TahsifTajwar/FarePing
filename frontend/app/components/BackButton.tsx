"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type BackButtonProps = {
  fallbackHref?: string;
};

export function BackButton({ fallbackHref = "/" }: BackButtonProps) {
  const router = useRouter();

  function handleBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  }

  return (
    <button
      className="inline-flex h-10 w-fit items-center gap-2 rounded-full border border-cyan-100/20 bg-white/[0.06] px-4 text-sm font-semibold text-cyan-100 backdrop-blur-md transition hover:bg-white/10"
      onClick={handleBack}
      type="button"
    >
      <ArrowLeft size={16} aria-hidden="true" />
      Back
    </button>
  );
}
