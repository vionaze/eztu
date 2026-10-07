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
  const subject = "Welcome to EZTopUp Reseller — your portal is ready";
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <h1 style="font-size:22px;margin:0 0 16px">Welcome to EZTopUp Reseller</h1>
      <p>Hi there,</p>
      <p>We’re excited to welcome <strong>${organizationName}</strong> to the EZTopUp reseller community.</p>
      <p>Your reseller access is ready. You can now visit your portal to continue setting up your account and explore what’s next.</p>
      <p>
        <a href="${url}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:6px">
          Click here to access your portal
        </a>
      </p>
      <p style="word-break:break-all"><a href="${url}">${url}</a></p>
      <p>We’re happy to have you with us.</p>
      <p>Warm regards,<br />The EZTopUp Team</p>
    </div>
  `;
  const text = `Welcome to EZTopUp Reseller, ${params.organizationName}!\n\nWe’re excited to welcome you to the EZTopUp reseller community. Your reseller access is ready, and your portal is available here:\n${resellerUrl}\n\nWe’re happy to have you with us.\n\nWarm regards,\nThe EZTopUp Team`;

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
