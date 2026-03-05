import type { Metadata } from "next";
import ContactForm from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Contact | DataBridges",
  description:
    "Get in touch with DataBridges. Book a free discovery call with Oisín Bridges — AI consultant and Power Platform developer based in Kilcock, Co. Kildare.",
};

export default function ContactPage() {
  return (
    <>
      {/* HERO */}
      <section
        aria-labelledby="contact-hero-heading"
        className="bg-navy py-32 px-6"
      >
        <div className="mx-auto max-w-5xl">
          <h1
            id="contact-hero-heading"
            className="font-syne text-6xl font-extrabold text-white"
          >
            Let&apos;s Talk
          </h1>
          <p className="text-cyan text-2xl mt-2">
            (Briefly. Like humans.)
          </p>
          <p className="text-gray-300 text-lg max-w-xl mt-4">
            Tell us what&apos;s driving you mad. We&apos;ll tell you whether
            AI can fix it. No scripts, no jargon, no pressure.
          </p>
        </div>
      </section>

      {/* CONTACT SECTION */}
      <section
        aria-labelledby="contact-form-heading"
        className="py-20 px-6"
        style={{ backgroundColor: "var(--color-offwhite)" }}
      >
        <div className="mx-auto max-w-5xl grid grid-cols-1 md:grid-cols-5 gap-16">
          {/* LEFT — FORM (60%) */}
          <div className="md:col-span-3">
            <h2 id="contact-form-heading" className="sr-only">
              Contact Form
            </h2>
            <ContactForm />
          </div>

          {/* RIGHT — DETAILS (40%) */}
          <div className="md:col-span-2">
            <div>
              <p className="text-xs uppercase tracking-widest text-cyan mb-2">
                Email
              </p>
              <a
                href="mailto:hello@databridges.ie"
                className="text-navy font-medium hover:text-cyan transition-colors duration-200"
              >
                hello@databridges.ie
              </a>
            </div>

            <div className="mt-8">
              <p className="text-xs uppercase tracking-widest text-cyan mb-2">
                LinkedIn
              </p>
              <a
                href="https://linkedin.com/company/databridges"
                target="_blank"
                rel="noopener noreferrer"
                className="text-navy font-medium hover:text-cyan transition-colors duration-200 block"
              >
                linkedin.com/company/databridges
              </a>
              <a
                href="https://linkedin.com/in/oisin-bridges"
                target="_blank"
                rel="noopener noreferrer"
                className="text-navy font-medium hover:text-cyan transition-colors duration-200 block mt-1"
              >
                linkedin.com/in/oisin-bridges
              </a>
            </div>

            <div className="mt-8">
              <p className="text-xs uppercase tracking-widest text-cyan mb-2">
                Location
              </p>
              <p className="text-navy font-medium">
                Kilcock, Co. Kildare, Ireland
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Working with teams across Ireland
              </p>
            </div>

            <div className="mt-8">
              <p className="text-xs uppercase tracking-widest text-cyan mb-2">
                Response time
              </p>
              <p className="text-sm text-gray-500">
                Usually within one working day.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
