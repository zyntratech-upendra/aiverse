import React, { useEffect } from "react";

export interface SEOProps {
  title: string;
  description: string;
  keywords?: string;
  url?: string;
  image?: string;
  type?: string;
  noIndex?: boolean;
  schema?: Record<string, any> | Array<Record<string, any>>;
}

const PRODUCTION_DOMAIN = "https://aiversevitb.in";

const SEO: React.FC<SEOProps> = ({
  title,
  description,
  keywords,
  url,
  image,
  type = "website",
  noIndex = false,
  schema,
}) => {
  useEffect(() => {
    // 1. Page Title
    const fullTitle = title.toLowerCase().includes("ai verse") ? title : `AI Verse VITB | ${title}`;
    document.title = fullTitle;

    // Helper function to create or update meta tags
    const updateMetaTag = (name: string, content: string, isProperty = false) => {
      const attribute = isProperty ? "property" : "name";
      let element = document.querySelector(`meta[${attribute}="${name}"]`);

      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, name);
        document.head.appendChild(element);
      }

      element.setAttribute("content", content);
    };

    // Helper to update link tags
    const updateLinkTag = (rel: string, href: string) => {
      let element = document.querySelector(`link[rel="${rel}"]`);

      if (!element) {
        element = document.createElement("link");
        element.setAttribute("rel", rel);
        document.head.appendChild(element);
      }

      element.setAttribute("href", href);
    };

    // 2. Robots Directives (Strict noindex for private portals, rich indexing for public pages)
    if (noIndex) {
      updateMetaTag("robots", "noindex, nofollow");
      updateMetaTag("googlebot", "noindex, nofollow");
    } else {
      updateMetaTag("robots", "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1");
      updateMetaTag("googlebot", "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1");
    }

    // 3. Meta Description
    updateMetaTag("description", description);
    updateMetaTag("og:description", description, true);
    updateMetaTag("twitter:description", description);

    // 4. Site Name & App Identity
    updateMetaTag("og:site_name", "AI Verse VITB", true);
    updateMetaTag("og:type", type, true);
    updateMetaTag("og:locale", "en_US", true);
    updateMetaTag("application-name", "AI Verse VITB");
    updateMetaTag("apple-mobile-web-app-title", "AI Verse VITB");

    // 5. Meta Keywords
    const baseKeywords = "aiversevitb.in, aiversevitb, AI Verse VITB, aiverse vitb, VIT Bhimavaram, Vishnu Institute of Technology, AI & Data Science, Student Technical Club, Hackathons, Coding Competitions";
    const combinedKeywords = keywords ? `${keywords}, ${baseKeywords}` : baseKeywords;
    updateMetaTag("keywords", combinedKeywords);

    // 6. Title Tags for OG & Twitter
    updateMetaTag("og:title", fullTitle, true);
    updateMetaTag("twitter:title", fullTitle);

    // 7. Favicon & Touch Icons
    updateLinkTag("icon", "/ai_verse.png");
    updateLinkTag("apple-touch-icon", "/ai_verse.png");

    // 8. Canonical & URL Tags
    let fullUrl = PRODUCTION_DOMAIN;
    if (url) {
      fullUrl = url.startsWith("http") ? url : `${PRODUCTION_DOMAIN}${url.startsWith("/") ? "" : "/"}${url}`;
    } else if (typeof window !== "undefined") {
      fullUrl = `${PRODUCTION_DOMAIN}${window.location.pathname}${window.location.search}`;
    }
    updateMetaTag("og:url", fullUrl, true);
    updateMetaTag("twitter:url", fullUrl);
    updateLinkTag("canonical", fullUrl);

    // 9. Social Media Image Cards
    const fullImage = image
      ? (image.startsWith("http") ? image : `${PRODUCTION_DOMAIN}${image.startsWith("/") ? "" : "/"}${image}`)
      : `${PRODUCTION_DOMAIN}/event-banner.png`;
    updateMetaTag("og:image", fullImage, true);
    updateMetaTag("og:image:secure_url", fullImage, true);
    updateMetaTag("og:image:alt", fullTitle, true);
    updateMetaTag("og:image:type", "image/png", true);
    updateMetaTag("twitter:image", fullImage);
    updateMetaTag("twitter:image:alt", fullTitle);
    updateMetaTag("twitter:card", "summary_large_image");
    updateMetaTag("twitter:site", "@aiverse_vitb");
    updateMetaTag("twitter:creator", "@aiverse_vitb");

    // 10. Dynamic JSON-LD Structured Data Schema
    const scriptId = "dynamic-route-schema";
    let scriptTag = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (schema) {
      if (!scriptTag) {
        scriptTag = document.createElement("script");
        scriptTag.id = scriptId;
        scriptTag.type = "application/ld+json";
        document.head.appendChild(scriptTag);
      }
      scriptTag.text = JSON.stringify(schema);
    } else if (scriptTag) {
      scriptTag.remove();
    }

    return () => {
      const dynamicScript = document.getElementById(scriptId);
      if (dynamicScript) dynamicScript.remove();
    };
  }, [title, description, keywords, url, image, type, noIndex, schema]);

  return null;
};

export default SEO;
