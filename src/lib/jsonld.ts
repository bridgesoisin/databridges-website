// Central identity graph for structured data (SEO + AEO).
// Single source of truth so every @id cross-reference resolves consistently.
// Constants + tiny helpers only, no dependency.

export const SITE_URL = "https://databridges.ie";
export const ORG_ID = `${SITE_URL}/#organization`;
export const PERSON_ID = `${SITE_URL}/#oisin`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

export const organizationLd = {
  "@type": ["Organization", "LocalBusiness", "ProfessionalService"],
  "@id": ORG_ID,
  name: "DataBridges",
  url: SITE_URL,
  legalName: "DataBridges",
  description:
    "Practical improvement, responsible automation, technology implementation and training.",
  email: "oisin@databridges.ie",
  telephone: "+353 85 136 4920",
  logo: { "@type": "ImageObject", url: `${SITE_URL}/images/logo-wordmark.png` },
  image: `${SITE_URL}/images/og-card.jpg`,
  address: {
    "@type": "PostalAddress",
    addressLocality: "Kilcock",
    addressRegion: "Co. Kildare",
    addressCountry: "IE",
  },
  geo: { "@type": "GeoCoordinates", latitude: 53.4013, longitude: -6.6706 },
  areaServed: [
    { "@type": "Country", name: "Ireland" },
    { "@type": "AdministrativeArea", name: "Leinster" },
    { "@type": "AdministrativeArea", name: "County Kildare" },
  ],
  knowsAbout: [
    "Process improvement",
    "Responsible automation",
    "Artificial Intelligence",
    "Microsoft Power Platform",
    "Power Automate",
    "SharePoint automation",
    "Answer Engine Optimisation",
    "Microsoft Copilot",
    "AI training",
  ],
  sameAs: [
    "https://www.linkedin.com/company/databridges",
    "https://www.linkedin.com/in/oisin-bridges",
  ],
};

export const personLd = {
  "@type": "Person",
  "@id": PERSON_ID,
  name: "Oisín Bridges",
  givenName: "Oisín",
  familyName: "Bridges",
  url: `${SITE_URL}/about`,
  image: `${SITE_URL}/images/headshot-oisin.jpeg`,
  worksFor: { "@id": ORG_ID },
  email: "oisin@databridges.ie",
  telephone: "+353 85 136 4920",
  knowsAbout: [
    "Artificial Intelligence",
    "Machine Learning",
    "Microsoft Power Platform",
    "SharePoint",
    "Data Science",
    "Answer Engine Optimisation",
  ],
  sameAs: ["https://www.linkedin.com/in/oisin-bridges"],
};

export const websiteLd = {
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  url: SITE_URL,
  name: "DataBridges",
  publisher: { "@id": ORG_ID },
  inLanguage: "en-IE",
};

// Breadcrumb helper, call per subpage.
export function breadcrumbLd(trail: { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: t.name,
      item: `${SITE_URL}${t.path}`,
    })),
  };
}

// Wrap any node list into a single @graph script payload.
export function graph(...nodes: object[]) {
  return { "@context": "https://schema.org", "@graph": nodes };
}
