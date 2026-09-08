/**
 * Transactional Email Service Helper
 * Dispatches HTML emails via backend /api/send-email (Nodemailer SMTP).
 */

export interface SendResendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  reply_to?: string | string[];
  headers?: Record<string, string>;
}

const sanitizeEmailField = (val?: string | string[], fallback: string = ""): string => {
  if (!val) return fallback;
  if (Array.isArray(val)) return val.map(v => v.replace(/^["']|["']$/g, "").trim()).join(", ");
  const cleaned = val.replace(/^["']|["']$/g, "").trim();
  return cleaned || fallback;
};

export const sendResendEmail = async ({
  to,
  subject,
  html,
  text,
  from,
  reply_to,
  headers,
}: SendResendEmailParams): Promise<{ success: boolean; data?: any; error?: string }> => {
  const recipients = Array.isArray(to) ? to : [to];
  const defaultFrom = (import.meta.env.VITE_RESEND_FROM_EMAIL as string) || "AI Verse <events@aiverse.in>";
  const defaultReplyTo = (import.meta.env.VITE_RESEND_REPLY_TO as string) || "aiverse@vishnu.edu.in";

  const senderEmail = sanitizeEmailField(from, defaultFrom);
  const replyToEmail = sanitizeEmailField(reply_to, defaultReplyTo);

  const emailHeaders: Record<string, string> = {
    "Auto-Submitted": "auto-generated",
    "X-Auto-Response-Suppress": "All",
    "X-Entity-Ref-ID": `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    ...(headers || {})
  };

  const rawBase = (import.meta.env.VITE_API_BASE as string) || 'http://localhost:4000/api';
  const apiBase = rawBase.replace(/\/+$/, '');
  const url = apiBase.endsWith('/api') ? `${apiBase}/send-email` : `${apiBase}/api/send-email`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        to: recipients, 
        subject: (subject || "").trim(), 
        html, 
        text, 
        from: senderEmail, 
        reply_to: replyToEmail,
        headers: emailHeaders,
      }),
    });

    const responseText = await response.text();

    if (!responseText || responseText.trim().startsWith("<!") || responseText.trim().startsWith("<html")) {
      console.error("Email API Error: /api/send-email returned HTML instead of JSON.");
      return { success: false, error: "Email service is not available." };
    }

    let result: any;
    try {
      result = JSON.parse(responseText);
    } catch {
      console.error("Email API Error: Could not parse response:", responseText.substring(0, 200));
      return { success: false, error: `Invalid API response: ${responseText.substring(0, 100)}` };
    }

    if (!response.ok || !result.success) {
      const errorMsg = result.error || result.message || `HTTP ${response.status}`;
      console.error("Email API Error:", errorMsg);
      return { success: false, error: errorMsg };
    }

    return { success: true, data: result };
  } catch (err: any) {
    console.error("Error calling send-email API:", err?.message || err);
    return { success: false, error: err?.message || "Network error sending email" };
  }
};
