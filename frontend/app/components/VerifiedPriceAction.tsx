"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";

type VerifiedPrice = {
  totalPrice: number;
  currency: string;
  sellers: string[];
};

type VerifiedPriceActionProps = {
  bookingLink?: string | null;
  bookingTokens?: string[];
  currency: string;
  initialPrice: number;
};

export function VerifiedPriceAction({
  bookingLink,
  bookingTokens = [],
  currency,
  initialPrice
}: VerifiedPriceActionProps) {
  const [verifiedPrice, setVerifiedPrice] = useState<VerifiedPrice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const canVerify = bookingTokens.length > 0;

  async function verifyPrice() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("http://localhost:4000/api/flights/booking-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingTokens })
      });
      const data = (await response.json()) as VerifiedPrice & { message?: string };

      if (!response.ok) {
        throw new Error(data.message ?? "Could not verify this price.");
      }

      setVerifiedPrice(data);
    } catch (verificationError) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : "Could not verify this price."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="lg:text-right">
      <p className="text-xs font-semibold text-slate-500">
        {verifiedPrice ? "Verified price" : "From"}
      </p>
      <p className="text-3xl font-semibold text-cyan-100">
        {verifiedPrice?.currency ?? currency} {verifiedPrice?.totalPrice ?? initialPrice}
      </p>
      {verifiedPrice?.sellers.length ? (
        <p className="mt-1 max-w-56 text-xs text-slate-400 lg:ml-auto">
          {verifiedPrice.sellers.join(" + ")}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2 lg:justify-end">
        {canVerify && !verifiedPrice ? (
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-cyan-100 px-4 text-sm font-semibold text-[#07111f] hover:bg-white disabled:cursor-wait disabled:bg-slate-500"
            disabled={loading}
            onClick={verifyPrice}
            type="button"
          >
            {loading ? <LoaderCircle className="animate-spin" size={16} aria-hidden="true" /> : null}
            {loading ? "Checking..." : "Verify price"}
          </button>
        ) : null}

        {bookingLink && (!canVerify || verifiedPrice) ? (
          <a
            className="inline-flex h-10 items-center justify-center rounded-md bg-cyan-100 px-4 text-sm font-semibold text-[#07111f] hover:bg-white"
            href={bookingLink}
            rel="noreferrer"
            target="_blank"
          >
            View booking
          </a>
        ) : null}
      </div>

      {error ? <p className="mt-2 max-w-64 text-xs text-red-200 lg:ml-auto">{error}</p> : null}
    </div>
  );
}
