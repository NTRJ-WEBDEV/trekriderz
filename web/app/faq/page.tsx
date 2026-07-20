import Breadcrumbs from "@/components/Breadcrumbs";
import FAQAccordion from "@/components/FAQAccordion";
import CTASection from "@/components/CTASection";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Frequently Asked Questions",
  description: "Answers to common questions about booking trips, becoming a guide, listing a homestay, and using TrekRiderz.",
  path: "/faq",
});

const FAQS = [
  { question: "How do I book a trip?", answer: "Browse trips on the Trips page, open the one you like, and either send an enquiry through the form or message us directly on WhatsApp. Our team confirms availability and next steps within 24 hours." },
  { question: "Do I need the app to book?", answer: "You can start an enquiry on the website, but bookings, payments, and trip management happen inside the TrekRiderz app — that's where your itinerary, chat with your group, and safety features live." },
  { question: "How do I become a verified guide?", answer: "Download the TrekRiderz app and register as a guide from your profile. Our team reviews your documents and experience before approving your profile — approved guides can list expeditions and appear in the public Guides directory." },
  { question: "How do I list my homestay or rental vehicle?", answer: "Homestay and rental listings are created and managed from the TrekRiderz app. Once submitted, our team reviews and approves listings before they appear on the website." },
  { question: "What's your cancellation policy?", answer: "Cancellation terms vary by trip and are shown on each trip's detail page. For custom-planned trips, our team will confirm the specific policy when finalizing your booking." },
  { question: "Do you organize international trips?", answer: "Yes — alongside Western Ghats and Himalayan treks, we run curated international tours. Reach out via WhatsApp or the Plan My Trip page to check current international itineraries." },
  { question: "Is TrekRiderz safe for solo travelers?", answer: "Safety is core to how we operate — trip leaders, group vetting, and in-app SOS tools are all part of the TrekRiderz app experience for every trip." },
];

export default function FAQPage() {
  return (
    <>
      <div className="max-w-3xl mx-auto px-5 md:px-8 pt-32 pb-20">
        <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "FAQ", path: "/faq" }]} />
        <div className="text-center mb-12">
          <p className="text-accent text-xs uppercase tracking-widest mb-3 font-semibold">Got Questions?</p>
          <h1 className="font-display text-5xl md:text-7xl text-white mb-4">FAQ</h1>
        </div>
        <FAQAccordion items={FAQS} />
      </div>

      <CTASection
        eyebrow="Still Stuck?"
        title="ASK US DIRECTLY"
        description="Can't find your answer here? Our team responds fast on WhatsApp."
        primaryLabel="Chat on WhatsApp"
        primaryHref="https://wa.me/917339231537"
        secondaryLabel="Contact Page"
        secondaryHref="/contact"
      />
    </>
  );
}
