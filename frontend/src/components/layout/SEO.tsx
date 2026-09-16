import React from "react";
import { Helmet } from "react-helmet-async";

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
  const fullTitle = title.toLowerCase().includes("ai verse") ? title : `AI Verse VITB | ${title}`;
  
  let fullUrl = PRODUCTION_DOMAIN;
  if (url) {
    fullUrl = url.startsWith("http") ? url : `${PRODUCTION_DOMAIN}${url.startsWith("/") ? "" : "/"}${url}`;
  } else if (typeof window !== "undefined") {
    fullUrl = `${PRODUCTION_DOMAIN}${window.location.pathname}${window.location.search}`;
  }

  const fullImage = image
    ? (image.startsWith("http") ? image : `${PRODUCTION_DOMAIN}${image.startsWith("/") ? "" : "/"}${image}`)
    : `${PRODUCTION_DOMAIN}/event-banner.png`;

  const baseKeywords = "aiversevitb.in, aiversevitb, AI Verse VITB, aiverse vitb, VIT Bhimavaram, Vishnu Institute of Technology, AI & Data Science, Student Technical Club, Hackathons, Coding Competitions";
  const combinedKeywords = keywords ? `${keywords}, ${baseKeywords}` : baseKeywords;

  return (
    <Helmet>
      {/* Title */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={combinedKeywords} />

      {/* Application Meta */}
      <meta name="application-name" content="AI Verse VITB" />
      <meta name="apple-mobile-web-app-title" content="AI Verse VITB" />

      {/* Robots Directives */}
      {noIndex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
      )}
      {noIndex ? (
        <meta name="googlebot" content="noindex, nofollow" />
      ) : (
        <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
      )}

      {/* Canonical Link */}
      <link rel="canonical" href={fullUrl} />

      {/* Open Graph (Facebook/LinkedIn) */}
      <meta property="og:site_name" content="AI Verse VITB" />
      <meta property="og:type" content={type} />
      <meta property="og:locale" content="en_US" />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={fullImage} />
      <meta property="og:image:secure_url" content={fullImage} />
      <meta property="og:image:alt" content={fullTitle} />
      <meta property="og:image:type" content="image/png" />

      {/* Twitter Cards */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@aiverse_vitb" />
      <meta name="twitter:creator" content="@aiverse_vitb" />
      <meta name="twitter:url" content={fullUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullImage} />
      <meta name="twitter:image:alt" content={fullTitle} />

      {/* Icons */}
      <link rel="icon" href="/ai_verse.png" />
      <link rel="apple-touch-icon" href="/ai_verse.png" />

      {/* JSON-LD Structured Data Schema */}
      {schema && (
        <script type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      )}
    </Helmet>
  );
};

export default SEO;

