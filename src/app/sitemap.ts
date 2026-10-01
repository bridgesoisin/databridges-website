import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://databridges.ie",
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: "https://databridges.ie/services",
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: "https://databridges.ie/work",
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: "https://databridges.ie/seo-aeo",
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: "https://databridges.ie/about",
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: "https://databridges.ie/faq",
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: "https://databridges.ie/contact",
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];
}
