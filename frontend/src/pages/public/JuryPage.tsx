import React from "react";
import JuryPortal from "../../components/jury/JuryPortal";
import SEO from "../../components/layout/SEO";

const JuryPage: React.FC = () => {
  return (
    <>
      <SEO title="Jury Portal - AI Verse" description="Jury evaluation portal for AI Verse events." noIndex={true} />
      <JuryPortal />
    </>
  );
};

export default JuryPage;
