import type { Metadata } from "next";

export const SITE_URL = "https://trekriderz.com";
export const SITE_NAME = "TrekRiderz";

interface PageMetaInput {
  title: string;
  description: string;
  path: string; // e.g. "/trips/abc-123"
  image?: string;
  type?: "website" | "article";
}

// One place that shapes title/description/OG/Twitter/canonical for every
// page — so a page only supplies content, not the boilerplate each of
// those blocks repeats.
export function buildMetadata({ title, description, path, image, type = "website" }: PageMetaInput): Metadata {
  const url = `${SITE_URL}${path}`;
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  const ogImage = image || `${SITE_URL}/og-default.jpg`;

  return {
    title: fullTitle,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: SITE_NAME,
      type,
      images: [{ url: ogImage }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [ogImage],
    },
  };
}

// JSON-LD builders — return plain objects, rendered via <JsonLd> below.
// Only the schema.org types the site actually has content for.
export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    sameAs: ["https://instagram.com/trekriderz", "https://youtube.com/@trekriderz"],
  };
}

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

export function tripSchema(trip: { title: string; description?: string; cover_photo_url?: string; price_usd?: number; destination?: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: trip.title,
    description: trip.description || undefined,
    image: trip.cover_photo_url || undefined,
    touristType: trip.destination || undefined,
    offers: trip.price_usd ? { "@type": "Offer", priceCurrency: "USD", price: trip.price_usd } : undefined,
  };
}

export function articleSchema(story: { title: string; body?: string; cover_image_url?: string; created_at: string; updated_at?: string; authorName?: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: story.title,
    image: story.cover_image_url ? [story.cover_image_url] : undefined,
    datePublished: story.created_at,
    dateModified: story.updated_at || story.created_at,
    author: story.authorName ? { "@type": "Person", name: story.authorName } : undefined,
  };
}

export function faqSchema(items: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export function placeSchema(place: { name: string; description?: string; cover_image_url?: string; state?: string; country?: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    name: place.name,
    description: place.description || undefined,
    image: place.cover_image_url || undefined,
    address: { "@type": "PostalAddress", addressRegion: place.state || undefined, addressCountry: place.country || "India" },
  };
}
