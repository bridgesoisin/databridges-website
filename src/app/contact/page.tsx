import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with DataBridges — AI consulting and automation for Irish businesses. Based in Kilcock, Co. Kildare.",
};

export default function ContactPage() {
  return (
    <>
      {/* Page header */}
      <section className="bg-[#0A1E3D] text-white py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">Get in Touch</h1>
          <p className="text-gray-300 text-lg leading-relaxed">
            No forms to fill out that go into a void. No sales calls. Just a conversation about
            what you need.
          </p>
        </div>
      </section>

      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Contact form */}
          <div>
            <h2 className="text-2xl font-bold text-[#0A1E3D] mb-6">Send a Message</h2>
            <form
              name="contact"
              method="POST"
              data-netlify="true"
              netlify-honeypot="bot-field"
              className="space-y-5"
            >
              {/* Netlify required hidden inputs */}
              <input type="hidden" name="form-name" value="contact" />

              {/* Honeypot */}
              <div className="hidden">
                <label>
                  Don&apos;t fill this out if you&apos;re human:
                  <input name="bot-field" />
                </label>
              </div>

              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Your name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#3DE0E8] focus:border-transparent transition"
                  placeholder="Jane Smith"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#3DE0E8] focus:border-transparent transition"
                  placeholder="jane@example.ie"
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={5}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#3DE0E8] focus:border-transparent transition resize-none"
                  placeholder="Tell us what you're working on or what you need help with…"
                />
              </div>

              <button
                type="submit"
                className="bg-[#0A1E3D] text-white px-8 py-3 rounded-full font-semibold hover:bg-[#3DE0E8] hover:text-[#0A1E3D] transition-colors w-full sm:w-auto"
              >
                Send Message
              </button>
            </form>
          </div>

          {/* Contact details */}
          <div className="lg:pt-2">
            <h2 className="text-2xl font-bold text-[#0A1E3D] mb-6">Other Ways to Reach Us</h2>
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Email</h3>
                <a
                  href="mailto:hello@databridges.ie"
                  className="text-[#3DE0E8] hover:text-[#0A1E3D] transition-colors font-medium"
                >
                  hello@databridges.ie
                </a>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-1">LinkedIn</h3>
                <a
                  href="https://linkedin.com/company/databridges"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#3DE0E8] hover:text-[#0A1E3D] transition-colors font-medium inline-flex items-center gap-1"
                >
                  DataBridges on LinkedIn
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Location</h3>
                <p className="text-gray-600">Kilcock, Co. Kildare, Ireland</p>
                <p className="text-sm text-gray-400 mt-1">
                  Working with clients across Ireland — remote and on-site.
                </p>
              </div>

              <div className="bg-gray-50 rounded-2xl p-6">
                <p className="text-sm text-gray-600 leading-relaxed">
                  <span className="font-semibold text-gray-900">Response time:</span> Usually
                  within one business day. If it's urgent, say so in your message.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
