import React, { useEffect } from "react";

interface SEOProps {
  title: string;
  description: string;
  keywords?: string;
  url?: string;
}

const SEO: React.FC<SEOProps> = ({ title, description, keywords, url }) => {
  useEffect(() => {
    // 1. Update page title
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

    // 2. Update meta description
    updateMetaTag("description", description);
    updateMetaTag("og:description", description, true);
    updateMetaTag("twitter:description", description);

    // 3. Update site name & app identity
    updateMetaTag("og:site_name", "AI Verse VITB", true);
    updateMetaTag("application-name", "AI Verse VITB");
    updateMetaTag("apple-mobile-web-app-title", "AI Verse VITB");

    // 4. Update meta keywords (if provided)
    if (keywords) {
      updateMetaTag("keywords", `${keywords}, aiversevitb, AI Verse VITB, VIT Bhimavaram, AI & Data Science`);
    }

    // 5. Update title tags for OG and Twitter
    updateMetaTag("og:title", fullTitle, true);
    updateMetaTag("twitter:title", fullTitle);

    // 6. Update Favicon Link
    updateLinkTag("icon", "/ai_verse.png");
    updateLinkTag("apple-touch-icon", "/ai_verse.png");

    // 7. Update URL tags
    if (url) {
      updateMetaTag("og:url", url, true);
      updateMetaTag("twitter:url", url);
      updateLinkTag("canonical", url);
    }
  }, [title, description, keywords, url]);

  return null; // This component operates solely via side-effects
};

export default SEO;
