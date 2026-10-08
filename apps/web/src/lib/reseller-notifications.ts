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

export async function sendB2BCodesEmail(params: {
  to: string;
  orderNumber: string;
  lines: { name: string; quantity: number; codes: string[] }[];
}): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { sent: false, error: "RESEND_API_KEY is not configured." };

  const orderNumber = escapeHtml(params.orderNumber);
  const rows = params.lines
    .map((line) => {
      const codes = line.codes.length ? line.codes.map(escapeHtml).join(", ") : "Given at the supplier dashboard";
      return `<li style="margin-bottom:8px"><strong>${escapeHtml(line.name)}</strong> × ${line.quantity}<br />` +
        `<code style="word-break:break-all">${codes}</code></li>`;
    })
    .join("");
  const subject = `Your EZTopUp wholesale order ${params.orderNumber} is delivered`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <h1 style="font-size:22px;margin:0 0 16px">Your order is delivered</h1>
      <p>Order <strong>${orderNumber}</strong> is complete. Here are the codes:</p>
      <ul style="padding-left:20px;margin:0 0 16px">${rows}</ul>
      <p>You can also view them anytime in your wholesale console order history.</p>
      <p>Thank you,<br />EZTopUp Team</p>
    </div>
  `;
  const text = `Order ${params.orderNumber} is delivered.\n\n` +
    params.lines.map((line) => `${line.name} × ${line.quantity}: ${line.codes.join(", ") || "given at supplier"}`).join("\n") +
    `\n\nThank you,\nEZTopUp Team`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: getEmailFromAddress(), to: params.to, reply_to: getEmailReplyTo(), subject, html, text }),
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

export async function sendB2BDeliveryEmail(params: {
  to: string;
  orderNumber: string;
  attachmentBase64: string;
  attachmentName: string;
  voucherCount: number;
}): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { sent: false, error: "RESEND_API_KEY is not configured." };

  const orderNumber = escapeHtml(params.orderNumber);
  const subject = `EZTopUp wholesale order ${params.orderNumber} — vouchers attached`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <h1 style="font-size:22px;margin:0 0 16px">Your vouchers are ready</h1>
      <p>Order <strong>${orderNumber}</strong> is complete. ${params.voucherCount} voucher code(s) are attached as an
      Excel file (<strong>${escapeHtml(params.attachmentName)}</strong>) in the standard order-details format.</p>
      <p>The file contains: Product Name, Reference Number, Transaction ID, Voucher, Status and the remaining standard columns.</p>
      <p>Thank you,<br />EZTopUp Team</p>
    </div>
  `;
  const text = `Order ${params.orderNumber} is complete. ${params.voucherCount} voucher code(s) are attached as ${params.attachmentName} in the standard order-details format.\n\nThank you,\nEZTopUp Team`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: getEmailFromAddress(),
        to: params.to,
        reply_to: getEmailReplyTo(),
        subject,
        html,
        text,
        attachments: [{ filename: params.attachmentName, content: params.attachmentBase64 }],
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
