/**
 * AI Verse High-Deliverability Email Templates
 * Designed to satisfy Gmail, Outlook, and modern spam filters:
 * - Proper DOCTYPE, meta tags, and responsive structure
 * - Anti-spam footer with clear sender identification and recipient context
 * - Bulletproof CTA buttons without exposing raw suspicious URLs
 * - Matching clean multipart plain text
 */

interface RegistrationEmailData {
  teamLeadName: string;
  eventTitle: string;
  groupName?: string;
  teamLeadStudentId?: string;
  teamSize?: number;
  transactionId?: string;
  members?: Array<{ name: string; studentId?: string; email?: string }>;
  ticketUrl: string;
}

interface CredentialsEmailData {
  teamLeadName: string;
  eventTitle: string;
  groupName?: string;
  teamEmail: string;
  password: string;
  loginUrl?: string;
}

/**
 * Builds registration confirmation HTML & text emails
 */
export function buildRegistrationConfirmationEmail(data: RegistrationEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    teamLeadName,
    eventTitle,
    groupName,
    teamLeadStudentId,
    teamSize,
    transactionId,
    members,
    ticketUrl,
  } = data;

  const isTeam = !!groupName && groupName !== "Individual RSVP";
  const displayTeam = isTeam ? groupName : "Individual Entry";
  const totalCount = teamSize || ((members?.length || 0) + 1);

  const subject = `Registration Confirmed: ${eventTitle} | AI Verse`;

  const memberRows = members && members.length > 0
    ? members.map((m, i) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px 12px; font-size: 13px; color: #334155;">${i + 2}. ${m.name}</td>
        <td style="padding: 8px 12px; font-size: 13px; color: #64748b; font-family: monospace;">${m.studentId || m.email || "—"}</td>
      </tr>
    `).join("")
    : "";

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${subject}</title>
  <style type="text/css">
    body { margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; }
    table { border-collapse: collapse; }
    .btn:hover { background-color: #1d4ed8 !important; }
  </style>
</head>
<body style="margin: 0; padding: 32px 16px; background-color: #f1f5f9;">
  <div style="display: none; font-size: 1px; color: #f1f5f9; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    Your registration for ${eventTitle} is confirmed. View your entry pass and event details.
  </div>

  <table width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 36px 32px; text-align: center;">
              <div style="font-size: 11px; font-weight: 800; letter-spacing: 2px; color: #93c5fd; text-transform: uppercase; margin-bottom: 8px;">AI VERSE EVENTS</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; line-height: 1.3;">Registration Confirmed</h1>
              <div style="margin-top: 10px; display: inline-block; background-color: rgba(255,255,255,0.15); border-radius: 20px; padding: 4px 14px; color: #e0e7ff; font-size: 12px; font-weight: 600;">
                ✓ Official Entry Pass Ready
              </div>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 32px 24px 32px;">
              <p style="font-size: 16px; line-height: 1.6; color: #0f172a; margin: 0 0 16px 0;">
                Hello <strong>${teamLeadName}</strong>,
              </p>
              <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">
                Great news! Your registration for <strong>${eventTitle}</strong> has been officially verified and confirmed.
              </p>

              <!-- Summary Card -->
              <table width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; margin-bottom: 24px; overflow: hidden;">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0;">
                    <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Event</div>
                    <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 2px;">${eventTitle}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 20px; border-bottom: 1px solid #e2e8f0;">
                    <table width="100%">
                      <tr>
                        <td width="50%">
                          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Team Name</div>
                          <div style="font-size: 14px; font-weight: 700; color: #1e293b; margin-top: 2px;">${displayTeam}</div>
                        </td>
                        <td width="50%">
                          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Total Participants</div>
                          <div style="font-size: 14px; font-weight: 700; color: #1e293b; margin-top: 2px;">${totalCount}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 20px;">
                    <table width="100%">
                      <tr>
                        <td width="50%">
                          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Lead / Reg ID</div>
                          <div style="font-size: 13px; font-weight: 600; color: #334155; margin-top: 2px;">${teamLeadName} (${teamLeadStudentId || "N/A"})</div>
                        </td>
                        ${transactionId ? `
                        <td width="50%">
                          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Reference ID</div>
                          <div style="font-size: 13px; font-weight: 600; color: #334155; font-family: monospace; margin-top: 2px;">${transactionId}</div>
                        </td>` : `
                        <td width="50%">
                          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Status</div>
                          <div style="font-size: 13px; font-weight: 700; color: #16a34a; margin-top: 2px;">Confirmed ✓</div>
                        </td>`}
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${members && members.length > 0 ? `
              <!-- Roster Table -->
              <div style="margin-bottom: 24px;">
                <div style="font-size: 12px; font-weight: 800; color: #334155; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Registered Team Members</div>
                <table width="100%" style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                  <tr style="background-color: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
                    <th align="left" style="padding: 8px 12px; font-size: 11px; color: #475569; text-transform: uppercase;">Name</th>
                    <th align="left" style="padding: 8px 12px; font-size: 11px; color: #475569; text-transform: uppercase;">ID / Email</th>
                  </tr>
                  <tr style="border-bottom: 1px solid #e2e8f0; background-color: #f8fafc;">
                    <td style="padding: 8px 12px; font-size: 13px; font-weight: 700; color: #1e3a8a;">1. ${teamLeadName} (Lead)</td>
                    <td style="padding: 8px 12px; font-size: 13px; color: #64748b; font-family: monospace;">${teamLeadStudentId || "Lead"}</td>
                  </tr>
                  ${memberRows}
                </table>
              </div>
              ` : ""}

              <!-- Call to Action Button -->
              <div style="text-align: center; margin: 32px 0 16px 0;">
                <a href="${ticketUrl}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 15px; font-weight: 800; text-decoration: none; padding: 14px 32px; border-radius: 12px; box-shadow: 0 4px 12px rgba(37,99,235,0.25);">
                  View Entry Pass & QR Code &rarr;
                </a>
              </div>
              <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 8px 0 0 0;">
                Present your QR code pass at the venue entrance desk.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="font-size: 12px; color: #64748b; margin: 0 0 6px 0;">
                <strong>AI Verse Club</strong> • VIT-B
              </p>
              <p style="font-size: 11px; color: #94a3b8; margin: 0; line-height: 1.5;">
                You are receiving this official registration receipt because you registered for ${eventTitle}.<br>
                For questions or support, reply directly to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `AI VERSE - REGISTRATION CONFIRMED`,
    `================================`,
    ``,
    `Hello ${teamLeadName},`,
    ``,
    `Your registration for ${eventTitle} has been confirmed.`,
    ``,
    `EVENT DETAILS:`,
    `- Event: ${eventTitle}`,
    `- Team: ${displayTeam}`,
    `- Lead: ${teamLeadName} (${teamLeadStudentId || "N/A"})`,
    `- Participants: ${totalCount}`,
    transactionId ? `- Reference ID: ${transactionId}` : "",
    `- Status: Confirmed`,
    ``,
    members && members.length > 0
      ? `TEAM MEMBERS:\n` + members.map((m, i) => `${i + 1}. ${m.name} (${m.studentId || m.email})`).join("\n") + "\n"
      : "",
    `VIEW YOUR ENTRY PASS:`,
    `${ticketUrl}`,
    ``,
    `Please present your digital entry pass at the event check-in desk.`,
    ``,
    `Regards,`,
    `AI Verse Team • VIT-B`,
  ].filter(Boolean).join("\n");

  return { subject, html, text };
}

/**
 * Builds team credentials login email
 */
export function buildTeamCredentialsEmail(data: CredentialsEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const { teamLeadName, eventTitle, groupName, teamEmail, password, loginUrl } = data;
  const teamLabel = groupName || teamLeadName || "Team";
  const subject = `Login Credentials for ${eventTitle} — Team ${teamLabel} | AI Verse`;

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 32px 16px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 36px 32px; text-align: center;">
              <div style="font-size: 11px; font-weight: 800; letter-spacing: 2px; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px;">AI VERSE PORTAL</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 800;">Team Access Credentials</h1>
              <p style="margin: 8px 0 0 0; font-size: 13px; color: #cbd5e1;">${eventTitle}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <p style="font-size: 15px; line-height: 1.6; color: #0f172a; margin: 0 0 16px 0;">
                Hello <strong>${teamLeadName}</strong>,
              </p>
              <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">
                Official login credentials for team <strong>"${teamLabel}"</strong> have been provisioned for <strong>${eventTitle}</strong>.
              </p>

              <!-- Credentials Box -->
              <div style="background-color: #f8fafc; border: 2px dashed #94a3b8; border-radius: 14px; padding: 20px 24px; margin: 24px 0;">
                <div style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
                  🔑 YOUR TEAM LOGIN CREDENTIALS
                </div>
                <div style="margin-bottom: 12px;">
                  <span style="font-size: 12px; color: #64748b; display: block;">Team Portal Email:</span>
                  <span style="font-size: 16px; font-weight: 800; color: #2563eb; font-family: monospace;">${teamEmail}</span>
                </div>
                <div>
                  <span style="font-size: 12px; color: #64748b; display: block;">Access Password:</span>
                  <span style="font-size: 16px; font-weight: 800; color: #0f172a; font-family: monospace; background-color: #e2e8f0; padding: 2px 8px; border-radius: 6px;">${password}</span>
                </div>
              </div>

              <p style="font-size: 13px; color: #64748b; line-height: 1.6; margin: 0 0 24px 0;">
                Use these credentials to submit problem statements, upload SRS/PPT deliverables, submit GitHub repositories, and view round promotion results.
              </p>

              ${loginUrl ? `
              <div style="text-align: center; margin: 28px 0 12px 0;">
                <a href="${loginUrl}" target="_blank" style="display: inline-block; background-color: #0f172a; color: #ffffff; font-size: 14px; font-weight: 800; text-decoration: none; padding: 12px 28px; border-radius: 10px;">
                  Open Team Portal Login &rarr;
                </a>
              </div>` : ""}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="font-size: 11px; color: #94a3b8; margin: 0; line-height: 1.5;">
                AI Verse Club • VIT-B<br>
                Dispatched automatically. Do not share your team password outside your registered team members.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `AI VERSE - TEAM LOGIN ACCESS`,
    `============================`,
    ``,
    `Hello ${teamLeadName},`,
    ``,
    `Credentials for team "${teamLabel}" for ${eventTitle}:`,
    ``,
    `Team Email: ${teamEmail}`,
    `Password: ${password}`,
    loginUrl ? `Login Portal: ${loginUrl}` : "",
    ``,
    `Use these credentials to log in to the submission portal.`,
    ``,
    `AI Verse Club • VIT-B`,
  ].filter(Boolean).join("\n");

  return { subject, html, text };
}

export interface PromotionEmailData {
  teamLeadName: string;
  eventTitle: string;
  groupName?: string;
  fromRound: number;
  toRound: number;
  roundName?: string;
  roundDescription?: string;
  teamEmail?: string;
  dashboardUrl?: string;
  quizScore?: number | null;
  quizMaxScore?: number | null;
  quizPercentage?: number | null;
  juryScore?: number | null;
}

/**
 * Builds round advancement & promotion congratulations email
 */
export function buildRoundPromotionEmail(data: PromotionEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    teamLeadName,
    eventTitle,
    groupName,
    fromRound,
    toRound,
    roundName,
    roundDescription,
    teamEmail,
    dashboardUrl,
    quizScore,
    quizMaxScore,
    quizPercentage,
    juryScore,
  } = data;

  const displayTeam = groupName && groupName !== "Individual RSVP" ? groupName : (teamLeadName || "Participant");
  const stageTitle = roundName || `Stage ${toRound}`;
  const subject = `Round ${toRound} Advancement: Team ${displayTeam} | ${eventTitle}`;

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${subject}</title>
  <style type="text/css">
    body { margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; }
    table { border-collapse: collapse; }
    .btn:hover { background-color: #047857 !important; }
  </style>
</head>
<body style="margin: 0; padding: 32px 16px; background-color: #f1f5f9;">
  <div style="display: none; font-size: 1px; color: #f1f5f9; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    Team ${displayTeam} has successfully qualified and been promoted to Round ${toRound} in ${eventTitle}.
  </div>

  <table width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #065f46 0%, #047857 50%, #0d9488 100%); padding: 40px 32px; text-align: center;">
              <div style="font-size: 11px; font-weight: 800; letter-spacing: 2px; color: #a7f3d0; text-transform: uppercase; margin-bottom: 8px;">
                AI VERSE COMPETITION ROUNDS
              </div>
              <div style="font-size: 32px; margin-bottom: 4px;">🏆 🎉</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 900; line-height: 1.2;">
                Congratulations!
              </h1>
              <p style="margin: 8px 0 0 0; font-size: 15px; color: #d1fae5; font-weight: 700;">
                You are Promoted to Round ${toRound}!
              </p>
              <div style="margin-top: 14px; display: inline-block; background-color: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); border-radius: 20px; padding: 5px 16px; color: #ffffff; font-size: 12px; font-weight: 800; letter-spacing: 0.5px;">
                ✓ QUALIFIED FOR ROUND ${toRound}
              </div>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 36px 32px 28px 32px;">
              <p style="font-size: 16px; line-height: 1.6; color: #0f172a; margin: 0 0 16px 0;">
                Hello <strong>${teamLeadName}</strong>,
              </p>
              <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 24px 0;">
                We are thrilled to inform you that your team <strong>"${displayTeam}"</strong> has successfully met the qualification criteria in <strong>Round ${fromRound}</strong> and has been officially <span style="color: #059669; font-weight: 800;">promoted to Round ${toRound} (${stageTitle})</span> of <strong>${eventTitle}</strong>!
              </p>

              <!-- Qualification Details Card -->
              <table width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; margin-bottom: 24px; overflow: hidden;">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; background-color: #f0fdf4;">
                    <div style="font-size: 11px; font-weight: 800; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">
                      Active Round Stage
                    </div>
                    <div style="font-size: 18px; font-weight: 900; color: #065f46; margin-top: 2px;">
                      Round ${toRound}: ${stageTitle}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px; border-bottom: 1px solid #e2e8f0;">
                    <table width="100%">
                      <tr>
                        <td width="50%">
                          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Team Name</div>
                          <div style="font-size: 14px; font-weight: 800; color: #1e293b; margin-top: 2px;">${displayTeam}</div>
                          ${teamEmail ? `<div style="font-size: 11px; color: #2563eb; font-family: monospace; margin-top: 2px;">${teamEmail}</div>` : ""}
                        </td>
                        <td width="50%">
                          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Event</div>
                          <div style="font-size: 14px; font-weight: 800; color: #1e293b; margin-top: 2px;">${eventTitle}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ${(quizScore !== null && quizScore !== undefined) || (juryScore !== null && juryScore !== undefined) ? `
                <tr>
                  <td style="padding: 14px 20px; border-bottom: 1px solid #e2e8f0;">
                    <table width="100%">
                      <tr>
                        ${quizScore !== null && quizScore !== undefined ? `
                        <td width="50%">
                          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Assessment Score</div>
                          <div style="font-size: 14px; font-weight: 800; color: #7c3aed; margin-top: 2px;">
                            ${quizScore} / ${quizMaxScore || 100} (${quizPercentage || 0}%)
                          </div>
                        </td>` : ""}
                        ${juryScore !== null && juryScore !== undefined ? `
                        <td width="50%">
                          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Jury Evaluation</div>
                          <div style="font-size: 14px; font-weight: 800; color: #4338ca; margin-top: 2px;">
                            ${juryScore} / 100
                          </div>
                        </td>` : ""}
                      </tr>
                    </table>
                  </td>
                </tr>` : ""}
                ${roundDescription ? `
                <tr>
                  <td style="padding: 14px 20px;">
                    <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">
                      Stage Instructions & Deliverables
                    </div>
                    <div style="font-size: 13px; font-weight: 500; color: #334155; line-height: 1.5;">
                      ${roundDescription}
                    </div>
                  </td>
                </tr>` : ""}
              </table>

              <!-- Next Steps Notice -->
              <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 14px 18px; border-radius: 8px; margin-bottom: 28px;">
                <div style="font-size: 13px; font-weight: 800; color: #1e40af; margin-bottom: 4px;">
                  📌 Next Steps for Round ${toRound}:
                </div>
                <div style="font-size: 13px; color: #1e3a8a; line-height: 1.5;">
                  Log in to your <strong>AI Verse Participant Dashboard</strong> to select or update your problem track, submit required deliverables, and view live schedules.
                </div>
              </div>

              <!-- Call to Action Button -->
              ${dashboardUrl ? `
              <div style="text-align: center; margin: 32px 0 16px 0;">
                <a href="${dashboardUrl}" target="_blank" style="display: inline-block; background-color: #059669; color: #ffffff; font-size: 15px; font-weight: 800; text-decoration: none; padding: 14px 36px; border-radius: 12px; box-shadow: 0 4px 14px rgba(5,150,105,0.3);">
                  Open Participant Dashboard &rarr;
                </a>
              </div>` : ""}

              <p style="font-size: 13px; color: #64748b; text-align: center; margin: 12px 0 0 0;">
                Best of luck from the faculty coordinators and event jury!
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="font-size: 12px; color: #64748b; margin: 0 0 6px 0;">
                <strong>AI Verse Club</strong> • VIT-B
              </p>
              <p style="font-size: 11px; color: #94a3b8; margin: 0; line-height: 1.5;">
                This official promotion announcement was sent to you because your team registered for ${eventTitle}.<br>
                For queries or support, reach out to your faculty coordinators.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `🎉 CONGRATULATIONS! PROMOTED TO ROUND ${toRound}`,
    `==============================================`,
    ``,
    `Hello ${teamLeadName},`,
    ``,
    `Great news! Team "${displayTeam}" has officially qualified and been promoted to Round ${toRound} (${stageTitle}) in ${eventTitle}!`,
    ``,
    `EVENT DETAILS:`,
    `- Event: ${eventTitle}`,
    `- Team: ${displayTeam}`,
    `- Round: Round ${toRound} (${stageTitle})`,
    quizScore !== null && quizScore !== undefined ? `- Score: ${quizScore}/${quizMaxScore || 100} (${quizPercentage || 0}%)` : "",
    juryScore !== null && juryScore !== undefined ? `- Jury Score: ${juryScore}/100` : "",
    roundDescription ? `- Description: ${roundDescription}` : "",
    ``,
    dashboardUrl ? `ACCESS YOUR DASHBOARD:\n${dashboardUrl}\n` : "",
    `Please log in to your participant dashboard to proceed with the next round deliverables.`,
    ``,
    `Regards,`,
    `AI Verse Club • VIT-B`,
  ].filter(Boolean).join("\n");

  return { subject, html, text };
}

export interface WelcomeMemberEmailData {
  name: string;
  role: string;
  collegeEmail?: string;
  personalEmail?: string;
  portalUrl?: string;
}

/**
 * Builds a personal, warm Welcome Email for newly onboarded team members
 */
export function buildWelcomeMemberEmail(data: WelcomeMemberEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    name,
    role,
    collegeEmail,
    personalEmail,
    portalUrl = "https://aiversevitb.dpdns.org/login"
  } = data;

  const subject = `Welcome to AI Verse, ${name}`;

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${subject}</title>
  <style type="text/css">
    body { margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; }
    table { border-collapse: collapse; }
    .btn:hover { background-color: #1d4ed8 !important; }
  </style>
</head>
<body style="margin: 0; padding: 40px 16px; background-color: #f8fafc;">
  <div style="display: none; font-size: 1px; color: #f8fafc; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    Welcome to AI Verse! We are thrilled to welcome you to the team as our ${role}.
  </div>

  <table width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 540px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.03); border: 1px solid #e2e8f0;">
          
          <!-- Subtle Top Accent -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, #2563eb, #60a5fa);"></td>
          </tr>

          <!-- Personal Message Body -->
          <tr>
            <td style="padding: 36px 32px 32px 32px;">
              
              <div style="font-size: 12px; font-weight: 800; letter-spacing: 1.5px; color: #2563eb; text-transform: uppercase; margin-bottom: 20px;">
                ✦ AI VERSE • WELCOME
              </div>

              <h1 style="margin: 0 0 20px 0; color: #0f172a; font-size: 22px; font-weight: 800; line-height: 1.3;">
                Hi ${name}, welcome to the team!
              </h1>

              <p style="font-size: 15px; line-height: 1.7; color: #334155; margin: 0 0 18px 0;">
                We are thrilled to welcome you to the <strong>AI Verse</strong> family! You have officially joined us as our <strong>${role}</strong>.
              </p>

              <!-- Inspiring Quote / Queue Block -->
              <div style="margin: 24px 0; padding: 18px 20px; background-color: #f8fafc; border-left: 3px solid #2563eb; border-radius: 0 12px 12px 0;">
                <p style="margin: 0; font-size: 14px; font-style: italic; color: #1e293b; line-height: 1.6;">
                  “Great things in innovation are never done by one person; they are done by a team of passionate minds.”
                </p>
              </div>

              <p style="font-size: 15px; line-height: 1.7; color: #334155; margin: 0 0 24px 0;">
                Your talent, energy, and ideas are going to be key as we build cutting-edge projects, organize impactful events, and shape the future of tech and AI together at Vishnu Institute of Technology.
              </p>

              <!-- Portal Link Button -->
              <div style="margin: 28px 0 24px 0;">
                <a href="${portalUrl}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 10px; box-shadow: 0 2px 8px rgba(37,99,235,0.25);">
                  Visit AI Verse Portal &rarr;
                </a>
              </div>

              <!-- Warm Personal Sign-off -->
              <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
                <p style="font-size: 14px; color: #475569; margin: 0 0 4px 0;">
                  Warm regards,
                </p>
                <p style="font-size: 15px; font-weight: 800; color: #0f172a; margin: 0 0 2px 0;">
                  Team AI Verse
                </p>
                <p style="font-size: 12px; color: #94a3b8; margin: 0;">
                  Vishnu Institute of Technology • Bhimavaram
                </p>
              </div>

            </td>
          </tr>

          <!-- Subtle Footer Note -->
          <tr>
            <td style="background-color: #f8fafc; padding: 16px 32px; border-top: 1px solid #f1f5f9; text-align: center;">
              <p style="font-size: 11px; color: #94a3b8; margin: 0; line-height: 1.5;">
                Sent directly to ${personalEmail || collegeEmail || "you"} as a member of AI Verse.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Hi ${name},`,
    ``,
    `Welcome to the AI Verse family! We are thrilled to welcome you to the team as our "${role}".`,
    ``,
    `“Great things in innovation are never done by one person; they are done by a team of passionate minds.”`,
    ``,
    `Your talent, energy, and ideas are going to be key as we build cutting-edge projects, organize impactful events, and shape the future together at Vishnu Institute of Technology.`,
    ``,
    `Access the portal anytime: ${portalUrl}`,
    ``,
    `Warm regards,`,
    `Team AI Verse`,
    `Vishnu Institute of Technology`,
  ].join("\n");

  return { subject, html, text };
}


