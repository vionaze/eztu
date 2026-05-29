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
  const [apiKey, setApiKey] = useState("");
  const [ipnSecret, setIpnSecret] = useState("");
  const [payCurrency, setPayCurrency] = useState("usdttrc20");
  const [webhookUrl, setWebhookUrl] = useState("");
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

      {/* NOWPayments */}
      <FadeUp delay={0.1}>
        <Card variant="default" padding="lg" className="space-y-5">
          <div className="flex items-center gap-2">
            <Key size={18} className="text-accent" />
            <h3 className="text-sm font-semibold text-text-primary">
              NOWPayments Crypto Payment
            </h3>
          </div>
          <Input
            label="API Key"
            type="password"
            placeholder="Your NOWPayments API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <Input
            label="IPN Secret"
            type="password"
            placeholder="Your NOWPayments IPN secret"
            value={ipnSecret}
            onChange={(e) => setIpnSecret(e.target.value)}
          />
          <Input
            label="Default Pay Currency"
            placeholder="usdttrc20"
            value={payCurrency}
            onChange={(e) => setPayCurrency(e.target.value)}
          />
          <Input
            label="Webhook URL"
            placeholder="https://yourdomain.com/api/payment/webhook"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
          />
          <p className="text-xs text-text-muted">
            Get your credentials from{" "}
            <a
              href="https://nowpayments.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:text-accent-hover transition-colors"
            >
              nowpayments.io
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
