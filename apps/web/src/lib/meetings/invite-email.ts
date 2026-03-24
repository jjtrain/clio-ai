import { sendDigestEmail } from "@/lib/email";

export async function sendMeetingInviteEmail(meeting: any, senderUserId: string) {
  const attendeeEmails = (meeting.attendees || [])
    .filter((a: any) => a.role === "ATTENDEE")
    .map((a: any) => a.email);

  if (attendeeEmails.length === 0) return;

  const dateStr = new Date(meeting.scheduledAt).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const timeStr = new Date(meeting.scheduledAt).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZone: meeting.timezone,
  });
  const providerName = meeting.provider === "ZOOM" ? "Zoom" : "Microsoft Teams";
  const providerColor = meeting.provider === "ZOOM" ? "#2D8CFF" : "#6264A7";

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:-apple-system,sans-serif;background:#f4f5f7;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:20px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
  <tr><td style="background:${providerColor};border-radius:12px 12px 0 0;padding:24px;color:white;">
    <div style="font-size:18px;font-weight:700;">Meeting Invitation</div>
    <div style="font-size:13px;opacity:0.85;margin-top:4px;">via ${providerName}</div>
  </td></tr>
  <tr><td style="background:white;padding:24px;">
    <h2 style="margin:0 0 16px 0;color:#111;font-size:20px;">${meeting.title}</h2>
    <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin-bottom:16px;">
      <p style="margin:4px 0;"><strong>Date:</strong> ${dateStr}</p>
      <p style="margin:4px 0;"><strong>Time:</strong> ${timeStr} (${meeting.timezone})</p>
      <p style="margin:4px 0;"><strong>Duration:</strong> ${meeting.durationMinutes} minutes</p>
      ${meeting.password ? `<p style="margin:4px 0;"><strong>Password:</strong> ${meeting.password}</p>` : ""}
    </div>
    <div style="text-align:center;margin:24px 0;">
      <a href="${meeting.joinUrl}" style="display:inline-block;background:${providerColor};color:white;padding:14px 40px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
        Join ${providerName} Meeting
      </a>
    </div>
    ${meeting.agenda ? `<div style="margin-top:16px;"><strong>Agenda:</strong><div style="color:#555;margin-top:4px;white-space:pre-wrap;">${meeting.agenda}</div></div>` : ""}
    <p style="font-size:12px;color:#999;margin-top:16px;">
      Meeting ID: ${meeting.externalMeetingId}<br/>
      If the button doesn't work: <a href="${meeting.joinUrl}" style="color:${providerColor};">${meeting.joinUrl}</a>
    </p>
  </td></tr>
  <tr><td style="background:#f9fafb;border-radius:0 0 12px 12px;padding:16px 24px;text-align:center;">
    <p style="font-size:11px;color:#aaa;">Sent from Managal · Legal Practice Management</p>
  </td></tr>
</table>
</td></tr></table></body></html>`;

  for (const email of attendeeEmails) {
    await sendDigestEmail({
      to: email,
      subject: `Meeting Invitation: ${meeting.title} — ${dateStr}`,
      html,
      fromEmail: "meetings@managal.com",
    });
  }
}
