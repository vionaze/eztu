import "server-only";

export type EmailSendResult = {
  sent: boolean;
  error?: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getEmailFromAddress() {
  return process.env.EMAIL_FROM?.trim() || "EZTopUp <sales@eztopup.io>";
}

function getEmailReplyTo() {
  return process.env.EMAIL_REPLY_TO?.trim() || "sales@eztopup.io";
}

export async function sendResellerApprovalEmail(params: {
  to: string;
  organizationName: string;
}): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { sent: false, error: "RESEND_API_KEY is not configured." };
  }

  const resellerUrl = "https://reseller.eztopup.io";
  const organizationName = escapeHtml(params.organizationName);
  const url = escapeHtml(resellerUrl);
  const subject = "Your EZTopUp reseller application has been approved";
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <h1 style="font-size:22px;margin:0 0 16px">Your reseller application has been approved</h1>
      <p>Your EZTopUp reseller application for <strong>${organizationName}</strong> has been approved.</p>
      <p>Click the button below to access your reseller portal:</p>
      <p>
        <a href="${url}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:6px">
          Click here to access
        </a>
      </p>
      <p style="word-break:break-all"><a href="${url}">${url}</a></p>
      <p>Thank you,<br />EZTopUp Team</p>
    </div>
  `;
  const text = `Your EZTopUp reseller application for ${params.organizationName} has been approved.\n\nClick here to access your reseller portal: ${resellerUrl}\n\nThank you,\nEZTopUp Team`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: getEmailFromAddress(),
        to: params.to,
        reply_to: getEmailReplyTo(),
        subject,
        html,
        text,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return { sent: false, error: `Resend API error: ${response.status} ${detail}`.trim() };
    }

    return { sent: true };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : "Unknown email error" };
  }
}
