"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ContactFormInner() {
  const searchParams = useSearchParams();
  const isSuccess = searchParams.get("success") === "true";

  if (isSuccess) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center">
        <div className="text-4xl mb-4" aria-hidden="true">
          &#10003;
        </div>
        <h3
          className="text-2xl font-bold text-navy mb-3"
          style={{ fontFamily: "var(--font-syne)" }}
        >
          Message received.
        </h3>
        <p
          className="text-gray-600 text-lg"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          Ois&iacute;n will be in touch shortly &mdash; usually within one
          working day.
        </p>
        <a
          href="/contact"
          className="inline-block mt-6 text-cyan font-medium hover:underline transition-colors duration-200"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          &larr; Back to contact
        </a>
      </div>
    );
  }

  return (
    <form
      name="contact"
      method="POST"
      data-netlify="true"
      data-netlify-honeypot="bot-field"
      action="/contact?success=true"
    >
      <input type="hidden" name="form-name" value="contact" />
      <input type="hidden" name="bot-field" />

      <div className="space-y-6">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-navy mb-2"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            className="bg-white border border-gray-200 rounded-xl px-4 py-3 w-full text-navy focus:border-cyan focus:ring-2 focus:ring-cyan/20 outline-none transition-all duration-200"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-navy mb-2"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            className="bg-white border border-gray-200 rounded-xl px-4 py-3 w-full text-navy focus:border-cyan focus:ring-2 focus:ring-cyan/20 outline-none transition-all duration-200"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          />
        </div>

        <div>
          <label
            htmlFor="organisation"
            className="block text-sm font-medium text-navy mb-2"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            Organisation
          </label>
          <input
            type="text"
            id="organisation"
            name="organisation"
            placeholder="Where do you work? (optional)"
            className="bg-white border border-gray-200 rounded-xl px-4 py-3 w-full text-navy placeholder:text-gray-400 focus:border-cyan focus:ring-2 focus:ring-cyan/20 outline-none transition-all duration-200"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          />
        </div>

        <div>
          <label
            htmlFor="message"
            className="block text-sm font-medium text-navy mb-2"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            Message
          </label>
          <textarea
            id="message"
            name="message"
            rows={6}
            required
            placeholder="e.g. We have three people manually copying data between spreadsheets every Monday morning and it's taking about two hours each time..."
            className="bg-white border border-gray-200 rounded-xl px-4 py-3 w-full text-navy placeholder:text-gray-400 focus:border-cyan focus:ring-2 focus:ring-cyan/20 outline-none transition-all duration-200 resize-y"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          />
        </div>

        <button
          type="submit"
          className="bg-cyan text-navy font-semibold px-8 py-4 rounded-full text-base w-full hover:bg-cyan/90 transition-colors duration-200"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          Send it over &rarr;
        </button>
      </div>
    </form>
  );
}

export default function ContactForm() {
  return (
    <Suspense
      fallback={
        <div className="animate-pulse bg-gray-200 rounded-2xl h-96" />
      }
    >
      <ContactFormInner />
    </Suspense>
  );
}
