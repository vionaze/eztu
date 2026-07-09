import { createHash, randomBytes } from "node:crypto";
import { Prisma, prisma } from "@kupon/db";

type EmailSendResult = {
  sent: boolean;
  error?: string;
};

function createDeliveryToken() {
  return randomBytes(32).toString("base64url");
}

function hashDeliveryToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getAppUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL is required to create voucher links.");
  }

  return appUrl;
}

function getVoucherUrl(token: string) {
  return new URL(`/voucher/${token}`, getAppUrl()).toString();
}

function getEmailFromAddress() {
  return process.env.EMAIL_FROM?.trim() || "EZTopUp <sales@eztopup.io>";
}

function getEmailReplyTo() {
  return process.env.EMAIL_REPLY_TO?.trim() || "sales@eztopup.io";
}

function stripHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<EmailSendResult> {
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  if (!resendApiKey) {
    return {
      sent: false,
      error: "RESEND_API_KEY is not configured.",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: getEmailFromAddress(),
        to: params.to,
        reply_to: getEmailReplyTo(),
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        sent: false,
        error: `Resend API error: ${response.status} ${detail}`.trim(),
      };
    }

    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      error: error instanceof Error ? error.message : "Unknown email send error",
    };
  }
}

function createVoucherEmail(params: {
  orderNumber: string;
  productName: string;
  variantName: string;
  quantity: number;
  voucherUrl: string;
}) {
  const subject = `Your EZTopUp voucher is ready - ${params.orderNumber}`;
  const voucherUrl = escapeHtml(params.voucherUrl);
  const orderNumber = escapeHtml(params.orderNumber);
  const productName = escapeHtml(params.productName);
  const variantName = escapeHtml(params.variantName);
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <h1 style="font-size:20px;margin:0 0 16px">Your voucher is ready</h1>
      <p>Thanks for your purchase. Use the secure link below to open your voucher page.</p>
      <p>
        <a href="${voucherUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 16px;border-radius:6px">
          Open voucher
        </a>
      </p>
      <p style="word-break:break-all"><a href="${voucherUrl}">${voucherUrl}</a></p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0" />
      <p><strong>Order:</strong> ${orderNumber}</p>
      <p><strong>Product:</strong> ${productName} - ${variantName}</p>
      <p><strong>Quantity:</strong> ${params.quantity}</p>
      <p style="color:#6b7280;font-size:12px">For security, voucher codes are shown on the EZTopUp voucher page instead of inside this email.</p>
    </div>
  `;

  return {
    subject,
    html,
    text: stripHtml(html),
  };
}

export async function sendVoucherDeliveryEmailForOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      voucherDeliveryLink: true,
      supplierOrder: true,
      items: {
        include: {
          product: true,
          variant: true,
        },
      },
    },
  });

  if (!order) {
    return { sent: false as const, error: "Order not found" };
  }

  if (order.voucherDeliveryLink?.sentAt) {
    return { sent: true as const, skipped: true, reason: "Voucher link already sent" };
  }

  const item = order.items[0];
  const voucherCode = order.supplierOrder?.voucherCode?.trim();
  if (!item || !voucherCode || order.supplierOrder?.status !== "FULFILLED") {
    return { sent: false as const, error: "Voucher is not fulfilled yet" };
  }

  const token = createDeliveryToken();
  const tokenHash = hashDeliveryToken(token);
  const voucherUrl = getVoucherUrl(token);
  const deliveryLink = await prisma.voucherDeliveryLink.upsert({
    where: { orderId: order.id },
    update: {
      tokenHash,
      email: order.email,
      lastSendError: null,
    },
    create: {
      orderId: order.id,
      tokenHash,
      email: order.email,
    },
  });
  const email = createVoucherEmail({
    orderNumber: order.orderNumber,
    productName: item.product.name,
    variantName: item.variant.name,
    quantity: item.quantity,
    voucherUrl,
  });
  const result = await sendEmail({
    to: order.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });

  await prisma.voucherDeliveryLink.update({
    where: { id: deliveryLink.id },
    data: result.sent
      ? {
          sentAt: new Date(),
          lastSendError: null,
        }
      : {
          lastSendError: result.error || "Email send failed",
        },
  });

  if (!result.sent) {
    return {
      sent: false as const,
      error: result.error || "Email send failed",
      voucherUrl,
    };
  }

  return { sent: true as const, voucherUrl };
}

export async function getVoucherDeliveryByToken(token: string) {
  const tokenHash = hashDeliveryToken(token);
  const deliveryLink = await prisma.voucherDeliveryLink.findUnique({
    where: { tokenHash },
    include: {
      order: {
        include: {
          supplierOrder: true,
          items: {
            include: {
              product: true,
              variant: true,
            },
          },
        },
      },
    },
  });

  if (!deliveryLink) return null;

  const now = new Date();
  await prisma.voucherDeliveryLink.update({
    where: { id: deliveryLink.id },
    data: {
      firstVisitedAt: deliveryLink.firstVisitedAt || now,
      lastVisitedAt: now,
      visitCount: { increment: 1 },
    },
  });

  return deliveryLink;
}

export function toDeliveryMetadata(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
