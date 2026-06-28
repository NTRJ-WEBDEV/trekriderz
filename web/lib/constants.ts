export const BUSINESS_WA = process.env.NEXT_PUBLIC_BUSINESS_WHATSAPP ?? '919999999999';

export const waHref = (msg: string) =>
  `https://wa.me/${BUSINESS_WA}?text=${encodeURIComponent(msg)}`;

export const waBareHref = `https://wa.me/${BUSINESS_WA}`;
