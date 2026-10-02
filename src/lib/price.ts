// Deterministic across Node/Chrome ICU versions, including UAH's currency symbol.
export function formatPrice(amount: number, currency: string) {
  const [integer, decimals] = amount.toFixed(2).split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  const symbol =
    ({ UAH: "₴", USD: "$", EUR: "€", PLN: "zł" } as Record<string, string>)[
      currency
    ] || currency;
  return `${grouped},${decimals}\u00a0${symbol}`;
}
