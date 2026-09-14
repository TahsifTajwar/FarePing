"use client";

import { ExternalLink, LoaderCircle, RefreshCw } from "lucide-react";
import { useState } from "react";
import { apiUrl } from "../lib/api";

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
  itineraryType: "ROUND_TRIP" | "SPLIT_ONE_WAYS" | "ONE_WAY";
  legs: Array<{
    direction: "OUTBOUND" | "RETURN";
    originAirport: string;
    destinationAirport: string;
    departDate: string;
  }>;
};

export function VerifiedPriceAction({
  bookingLink,
  bookingTokens = [],
  currency,
  initialPrice,
  itineraryType,
  legs
}: VerifiedPriceActionProps) {
  const [verifiedPrice, setVerifiedPrice] = useState<VerifiedPrice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bookingSelections = buildBookingSelections(bookingTokens, itineraryType, legs);
  const canVerify = bookingSelections.length > 0;

  async function verifyPrice() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(apiUrl("/api/flights/booking-price"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingSelections })
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
      <p className="text-[10px] font-bold uppercase text-white/38">
        {verifiedPrice ? "Verified price" : "From"}
      </p>
      <p className="mt-1 whitespace-nowrap text-3xl font-semibold text-[#c9f8e4]">
        {verifiedPrice?.currency ?? currency} {verifiedPrice?.totalPrice ?? initialPrice}
      </p>
      {verifiedPrice?.sellers.length ? (
        <p className="mt-1 max-w-56 text-xs text-white/45 lg:ml-auto">
          {verifiedPrice.sellers.join(" + ")}
        </p>
      ) : null}

      <div className="mt-3 grid gap-2">
        {canVerify && !verifiedPrice ? (
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#9ff3d0] px-4 text-sm font-semibold text-[#07110f] transition hover:bg-white disabled:cursor-wait disabled:bg-white/20 disabled:text-white/45"
            disabled={loading}
            onClick={verifyPrice}
            type="button"
          >
            {loading ? (
              <LoaderCircle className="animate-spin" size={16} aria-hidden="true" />
            ) : (
              <RefreshCw size={15} aria-hidden="true" />
            )}
            {loading ? "Checking..." : "Verify price"}
          </button>
        ) : null}

        {bookingLink && (!canVerify || verifiedPrice) ? (
          <a
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#9ff3d0] px-4 text-sm font-semibold text-[#07110f] transition hover:bg-white"
            href={bookingLink}
            rel="noreferrer"
            target="_blank"
          >
            View booking
            <ExternalLink size={15} aria-hidden="true" />
          </a>
        ) : null}
      </div>

      {error ? <p className="mt-2 max-w-64 text-xs text-[#ffaaa2] lg:ml-auto">{error}</p> : null}
    </div>
  );
}

function buildBookingSelections(
  bookingTokens: string[],
  itineraryType: VerifiedPriceActionProps["itineraryType"],
  legs: VerifiedPriceActionProps["legs"]
) {
  const outboundLeg = legs.find((leg) => leg.direction === "OUTBOUND");
  const returnLeg = legs.find((leg) => leg.direction === "RETURN");

  if (!outboundLeg || bookingTokens.length === 0) return [];

  if (itineraryType === "SPLIT_ONE_WAYS") {
    if (!returnLeg || bookingTokens.length !== 2) return [];

    return [
      buildSelection(bookingTokens[0], "ONE_WAY", outboundLeg),
      buildSelection(bookingTokens[1], "ONE_WAY", returnLeg)
    ];
  }

  if (itineraryType === "ROUND_TRIP") {
    if (!returnLeg || bookingTokens.length !== 1) return [];

    return [
      {
        ...buildSelection(bookingTokens[0], "ROUND_TRIP", outboundLeg),
        returnDate: returnLeg.departDate
      }
    ];
  }

  return bookingTokens.length === 1
    ? [buildSelection(bookingTokens[0], "ONE_WAY", outboundLeg)]
    : [];
}

function buildSelection(
  bookingToken: string,
  tripType: "ROUND_TRIP" | "ONE_WAY",
  leg: VerifiedPriceActionProps["legs"][number]
) {
  return {
    bookingToken,
    tripType,
    originAirport: leg.originAirport,
    destinationAirport: leg.destinationAirport,
    departureDate: leg.departDate
  };
}
