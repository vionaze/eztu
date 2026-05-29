"use client";

import { useState } from "react";
import { Card, Input } from "@kupon/ui";
import { FadeUp } from "@/components/motion/StaggerReveal";
import { formatPrice, cn } from "@/lib/utils";
import {
  MagnifyingGlass,
  FunnelSimple,
  Eye,
  ArrowsClockwise,
} from "@phosphor-icons/react";

// Dummy orders
const orders = [
  { id: "KPN-X1Y2Z3", user: "user@email.com", product: "Mobile Legends - 344 Diamonds", amount: 76000, status: "COMPLETED", crypto: "USDT", date: "May 3, 2026 14:30" },
  { id: "KPN-A4B5C6", user: "gamer@email.com", product: "Genshin Impact - 1090 Crystals", amount: 249000, status: "PAID", crypto: "BTC", date: "May 3, 2026 13:15" },
  { id: "KPN-D7E8F9", user: "pro@email.com", product: "Valorant - 2050 VP", amount: 249000, status: "PROCESSING", crypto: "ETH", date: "May 3, 2026 12:00" },
  { id: "KPN-G0H1I2", user: "casual@email.com", product: "Steam Wallet - $20", amount: 310000, status: "PENDING", crypto: "USDT", date: "May 3, 2026 10:45" },
  { id: "KPN-J3K4L5", user: "mobile@email.com", product: "Free Fire - 1060 Diamonds", amount: 153000, status: "COMPLETED", crypto: "BTC", date: "May 2, 2026 22:30" },
  { id: "KPN-M6N7O8", user: "new@email.com", product: "PUBG Mobile - 660 UC", amount: 159000, status: "FAILED", crypto: "ETH", date: "May 2, 2026 20:00" },
  { id: "KPN-P9Q0R1", user: "whale@email.com", product: "Netflix - Premium", amount: 186000, status: "EXPIRED", crypto: "USDT", date: "May 2, 2026 18:15" },
  { id: "KPN-S2T3U4", user: "star@email.com", product: "Honkai: Star Rail - 1090 Shards", amount: 249000, status: "COMPLETED", crypto: "BTC", date: "May 1, 2026 15:00" },
];

const statuses = ["ALL", "PENDING", "PAID", "PROCESSING", "COMPLETED", "FAILED", "EXPIRED"];

const statusStyles: Record<string, string> = {
  PENDING: "bg-yellow-500/10 text-yellow-400",
  PAID: "bg-blue-500/10 text-blue-400",
  PROCESSING: "bg-orange-500/10 text-orange-400",
  COMPLETED: "bg-emerald-500/10 text-emerald-400",
  FAILED: "bg-red-500/10 text-red-400",
  EXPIRED: "bg-zinc-500/10 text-zinc-400",
};

export default function AdminOrdersPage() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");

  const filtered = orders.filter((o) => {
    const matchesSearch =
      o.id.toLowerCase().includes(search.toLowerCase()) ||
      o.product.toLowerCase().includes(search.toLowerCase()) ||
      o.user.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      filterStatus === "ALL" || o.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Filters */}
      <FadeUp>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-full sm:w-72">
            <Input
              placeholder="Search orders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<MagnifyingGlass size={16} />}
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
            <FunnelSimple size={14} className="text-text-muted flex-shrink-0" />
            {statuses.map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={cn(
                  "flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
                  filterStatus === status
                    ? "bg-accent text-bg-primary"
                    : "bg-bg-card text-text-secondary hover:text-text-primary border border-border"
                )}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </FadeUp>

      {/* Orders Table */}
      <FadeUp delay={0.1}>
        <Card variant="default" padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Order
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Crypto
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-mono font-medium text-accent">
                        {order.id}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-text-secondary">
                        {order.user}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-text-primary">
                        {order.product}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-[family-name:var(--font-geist-mono)] text-text-primary">
                        {formatPrice(order.amount)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-medium text-text-secondary bg-bg-elevated px-2 py-0.5 rounded-md">
                        {order.crypto}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${
                          statusStyles[order.status] || ""
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs text-text-muted">
                        {order.date}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/5 transition-all cursor-pointer">
                          <Eye size={16} />
                        </button>
                        <button className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-accent hover:bg-accent/5 transition-all cursor-pointer">
                          <ArrowsClockwise size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-sm text-text-muted">No orders found.</p>
            </div>
          )}
        </Card>
      </FadeUp>

      {/* Summary */}
      <FadeUp delay={0.15}>
        <p className="text-xs text-text-muted">
          Showing {filtered.length} of {orders.length} orders
        </p>
      </FadeUp>
    </div>
  );
}
