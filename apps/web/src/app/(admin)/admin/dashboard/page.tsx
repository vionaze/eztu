"use client";

import { Card } from "@kupon/ui";
import { FadeUp, StaggerReveal, StaggerItem } from "@/components/motion/StaggerReveal";
import { formatPrice } from "@/lib/utils";
import {
  ShoppingCart,
  CurrencyDollar,
  Package,
  Users,
  TrendUp,
  ArrowRight,
} from "@phosphor-icons/react";
import Link from "next/link";

// Dummy dashboard data
const stats = [
  {
    label: "Total Revenue",
    value: formatPrice(45_250_000),
    change: "+12.5%",
    icon: CurrencyDollar,
    positive: true,
  },
  {
    label: "Orders",
    value: "1,234",
    change: "+8.2%",
    icon: ShoppingCart,
    positive: true,
  },
  {
    label: "Products",
    value: "9",
    change: "+2",
    icon: Package,
    positive: true,
  },
  {
    label: "Customers",
    value: "856",
    change: "+15.3%",
    icon: Users,
    positive: true,
  },
];

const recentOrders = [
  { id: "KPN-A1B2C3", product: "Mobile Legends - 344 Diamonds", amount: 76000, status: "PAID", time: "2 min ago" },
  { id: "KPN-D4E5F6", product: "Genshin Impact - 330 Crystals", amount: 79000, status: "PROCESSING", time: "15 min ago" },
  { id: "KPN-G7H8I9", product: "Valorant - 1000 VP", amount: 130000, status: "COMPLETED", time: "1 hr ago" },
  { id: "KPN-J0K1L2", product: "Steam Wallet - $10", amount: 155000, status: "PENDING", time: "2 hr ago" },
  { id: "KPN-M3N4O5", product: "Free Fire - 520 Diamonds", amount: 77000, status: "COMPLETED", time: "3 hr ago" },
];

const statusColor: Record<string, string> = {
  PENDING: "bg-yellow-500/10 text-yellow-400",
  PAID: "bg-blue-500/10 text-blue-400",
  PROCESSING: "bg-orange-500/10 text-orange-400",
  COMPLETED: "bg-emerald-500/10 text-emerald-400",
  FAILED: "bg-red-500/10 text-red-400",
};

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <StaggerReveal className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <StaggerItem key={stat.label}>
            <Card variant="default" padding="md" className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <stat.icon size={20} className="text-accent" />
                </div>
                <div
                  className={`flex items-center gap-1 text-xs font-medium ${
                    stat.positive ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  <TrendUp size={12} />
                  {stat.change}
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary font-[family-name:var(--font-geist-mono)]">
                  {stat.value}
                </p>
                <p className="text-xs text-text-muted mt-0.5">{stat.label}</p>
              </div>
            </Card>
          </StaggerItem>
        ))}
      </StaggerReveal>

      {/* Recent Orders & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <FadeUp className="lg:col-span-2">
          <Card variant="default" padding="none">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-text-primary">
                Recent Orders
              </h2>
              <Link
                href="/admin/orders"
                className="text-xs text-text-secondary hover:text-accent transition-colors flex items-center gap-1"
              >
                View all <ArrowRight size={12} />
              </Link>
            </div>
            <div className="divide-y divide-border">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-text-muted">
                        {order.id}
                      </span>
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
                          statusColor[order.status] || ""
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <p className="text-sm text-text-primary mt-0.5 truncate">
                      {order.product}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-sm font-semibold text-text-primary font-[family-name:var(--font-geist-mono)]">
                      {formatPrice(order.amount)}
                    </p>
                    <p className="text-[10px] text-text-muted">{order.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </FadeUp>

        {/* Quick Actions */}
        <FadeUp delay={0.1}>
          <Card variant="default" padding="none">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-text-primary">
                Quick Actions
              </h2>
            </div>
            <div className="p-3 space-y-1">
              {[
                { label: "Add Product", href: "/admin/products/new", icon: Package },
                { label: "New Blog Post", href: "/admin/blog/new", icon: "📝" },
                { label: "View Orders", href: "/admin/orders", icon: ShoppingCart },
                { label: "Site Settings", href: "/admin/settings", icon: "⚙️" },
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-text-secondary hover:text-text-primary hover:bg-white/5 transition-all"
                >
                  {typeof action.icon === "string" ? (
                    <span className="text-base">{action.icon}</span>
                  ) : (
                    <action.icon size={16} />
                  )}
                  {action.label}
                  <ArrowRight size={12} className="ml-auto text-text-muted" />
                </Link>
              ))}
            </div>
          </Card>

          {/* Revenue Chart placeholder */}
          <Card variant="glass" padding="md" className="mt-4">
            <h3 className="text-sm font-semibold text-text-primary mb-3">
              Revenue (7 days)
            </h3>
            {/* Simple bar chart */}
            <div className="flex items-end gap-1.5 h-24">
              {[35, 55, 40, 75, 60, 90, 70].map((val, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-md bg-accent/20 hover:bg-accent/40 transition-colors"
                    style={{ height: `${val}%` }}
                  />
                  <span className="text-[8px] text-text-muted">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </FadeUp>
      </div>
    </div>
  );
}
