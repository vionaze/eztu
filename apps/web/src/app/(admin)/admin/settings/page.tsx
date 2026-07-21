"use client";

import { useState } from "react";
import { Button, Card, Input } from "@kupon/ui";
import { FadeUp } from "@/components/motion/StaggerReveal";
import {
  Globe,
  Key,
  Bell,
  Palette,
} from "@phosphor-icons/react";

export default function AdminSettingsPage() {
  const [siteName, setSiteName] = useState("EZTopUp");
  const [siteDescription, setSiteDescription] = useState(
    "Digital Voucher Marketplace"
  );
  const [merchantId, setMerchantId] = useState("");
  const [paymentApiKey, setPaymentApiKey] = useState("");
  const [currencies, setCurrencies] = useState("USDT,USDC");
  const [webhookUrl, setWebhookUrl] = useState(
    "https://eztopup.io/api/payment/webhook"
  );
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");

  return (
    <div className="max-w-2xl space-y-6">
      {/* General */}
      <FadeUp>
        <Card variant="default" padding="lg" className="space-y-5">
          <div className="flex items-center gap-2">
            <Globe size={18} className="text-accent" />
            <h3 className="text-sm font-semibold text-text-primary">
              General Settings
            </h3>
          </div>
          <Input
            label="Site Name"
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
          />
          <Input
            label="Site Description"
            value={siteDescription}
            onChange={(e) => setSiteDescription(e.target.value)}
          />
        </Card>
      </FadeUp>

      {/* Cryptomus */}
      <FadeUp delay={0.1}>
        <Card variant="default" padding="lg" className="space-y-5">
          <div className="flex items-center gap-2">
            <Key size={18} className="text-accent" />
            <h3 className="text-sm font-semibold text-text-primary">
              Cryptomus Crypto Payment
            </h3>
          </div>
          <Input
            label="Merchant ID (UUID)"
            type="text"
            placeholder="Merchant UUID from Cryptomus settings"
            value={merchantId}
            onChange={(e) => setMerchantId(e.target.value)}
          />
          <Input
            label="Payment API Key"
            type="password"
            placeholder="Payment API key (not payout key)"
            value={paymentApiKey}
            onChange={(e) => setPaymentApiKey(e.target.value)}
          />
          <Input
            label="Allowed Currencies"
            placeholder="USDT,USDC"
            value={currencies}
            onChange={(e) => setCurrencies(e.target.value)}
          />
          <Input
            label="Webhook URL (url_callback)"
            placeholder="https://eztopup.io/api/payment/webhook"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
          />
          <p className="text-xs text-text-muted">
            Configure secrets in server env (
            <code className="text-text-secondary">CRYPTOMUS_*</code>
            ). Docs:{" "}
            <a
              href="https://doc.cryptomus.com/merchant-api/request-format"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:text-accent-hover transition-colors"
            >
              Cryptomus Merchant API
            </a>
          </p>
        </Card>
      </FadeUp>

      {/* Notifications */}
      <FadeUp delay={0.15}>
        <Card variant="default" padding="lg" className="space-y-5">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-accent" />
            <h3 className="text-sm font-semibold text-text-primary">
              Telegram Notifications
            </h3>
          </div>
          <Input
            label="Bot Token"
            type="password"
            placeholder="Your Telegram bot token"
            value={telegramBotToken}
            onChange={(e) => setTelegramBotToken(e.target.value)}
          />
          <Input
            label="Chat ID"
            placeholder="Your Telegram chat or group ID"
            value={telegramChatId}
            onChange={(e) => setTelegramChatId(e.target.value)}
          />
          <p className="text-xs text-text-muted">
            Receive order notifications via Telegram bot.
          </p>
        </Card>
      </FadeUp>

      {/* Theme (placeholder) */}
      <FadeUp delay={0.2}>
        <Card variant="glass" padding="md">
          <div className="flex items-center gap-2 mb-2">
            <Palette size={18} className="text-accent" />
            <h3 className="text-sm font-semibold text-text-primary">
              Theme & Branding
            </h3>
          </div>
          <p className="text-xs text-text-muted">
            Logo upload, accent color customization, and social links will be
            available after Cloudinary integration.
          </p>
        </Card>
      </FadeUp>

      {/* Save */}
      <FadeUp delay={0.25}>
        <Button size="lg">Save Settings</Button>
      </FadeUp>
    </div>
  );
}
