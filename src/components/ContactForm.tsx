"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function ContactFormInner() {
  const searchParams = useSearchParams();
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const isSuccess = searchParams.get("success") === "true" || submitted;

  // Next.js runs on the Netlify server runtime, so a native <form> POST would
  // hit the Next server instead of Netlify's form handler. Instead we POST
  // url-encoded data to /__forms.html (a static file Netlify registers as the
  // "contact" form), which records the submission and fires the email
  // notification set in the Netlify dashboard.
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const params = new URLSearchParams();
    new FormData(form).forEach((value, key) =>
      params.append(key, value.toString())
    );

    setStatus("submitting");
    try {
      const res = await fetch("/__forms.html", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      if (!res.ok) throw new Error(`Form POST failed: ${res.status}`);
      setSubmitted(true);
    } catch {
      setStatus("error");
    }
  }

  if (isSuccess) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center">
        <div className="text-4xl mb-4" aria-hidden="true">
          &#10003;
        </div>
        <h3 className="font-syne text-2xl font-bold text-navy mb-3">
          Message received.
        </h3>
        <p className="text-gray-600 text-lg">
          Ois&iacute;n will be in touch shortly, usually within one
          working day.
        </p>
        <a
          href="/contact"
          className="inline-block mt-6 text-cyan-ink font-medium hover:underline transition-colors duration-200"
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
      action="/__forms.html"
      onSubmit={handleSubmit}
      noValidate
    >
      <input type="hidden" name="form-name" value="contact" />
      {/* Honeypot: bots fill this; humans never see it. */}
      <p hidden aria-hidden="true">
        <label>
          Do not fill this in: <input name="bot-field" tabIndex={-1} autoComplete="off" />
        </label>
      </p>

      <div className="space-y-6">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-navy mb-2"
          >
            Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            className="bg-white border border-gray-200 rounded-xl px-4 py-3 w-full text-navy focus:border-cyan focus:ring-2 focus:ring-cyan/20 outline-none transition-[border-color,box-shadow] duration-200"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-navy mb-2"
          >
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            className="bg-white border border-gray-200 rounded-xl px-4 py-3 w-full text-navy focus:border-cyan focus:ring-2 focus:ring-cyan/20 outline-none transition-[border-color,box-shadow] duration-200"
          />
        </div>

        <div>
          <label
            htmlFor="organisation"
            className="block text-sm font-medium text-navy mb-2"
          >
            Organisation
          </label>
          <input
            type="text"
            id="organisation"
            name="organisation"
            placeholder="Where do you work? (optional)"
            className="bg-white border border-gray-200 rounded-xl px-4 py-3 w-full text-navy placeholder:text-gray-500 focus:border-cyan focus:ring-2 focus:ring-cyan/20 outline-none transition-[border-color,box-shadow] duration-200"
          />
        </div>

        <div>
          <label
            htmlFor="message"
            className="block text-sm font-medium text-navy mb-2"
          >
            Message
          </label>
          <textarea
            id="message"
            name="message"
            rows={6}
            required
            placeholder="e.g. We have three people manually copying data between spreadsheets every Monday morning and it's taking about two hours each time..."
            className="bg-white border border-gray-200 rounded-xl px-4 py-3 w-full text-navy placeholder:text-gray-500 focus:border-cyan focus:ring-2 focus:ring-cyan/20 outline-none transition-[border-color,box-shadow] duration-200 resize-y"
          />
        </div>

        <button
          type="submit"
          disabled={status === "submitting"}
          className="bg-cyan text-navy font-semibold px-8 py-4 rounded-full text-base w-full hover:bg-cyan/90 transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {status === "submitting" ? "Sending…" : "Send it over →"}
        </button>

        {status === "error" && (
          <p role="alert" className="text-sm text-navy/80 text-center">
            Something went wrong sending that. Please email{" "}
            <a
              href="mailto:oisin@databridges.ie"
              className="text-cyan-ink font-medium hover:underline"
            >
              oisin@databridges.ie
            </a>{" "}
            directly and I&apos;ll get straight back to you.
          </p>
        )}
      </div>
    </form>
  );
}

export default function ContactForm() {
  return (
    <Suspense
      fallback={
        <div className="animate-pulse bg-gray-200 rounded-2xl h-[37rem]" />
      }
    >
      <ContactFormInner />
    </Suspense>
  );
}
