export function buildDealAlertMessage(destination: string, price: number) {
  const roundedPrice = Math.round(price);

  return `FarePing alert: ${destination} flights found around $${roundedPrice}. Open the app to review the deal.`;
}
