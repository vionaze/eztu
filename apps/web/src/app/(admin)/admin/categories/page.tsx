"use client";

import { useState } from "react";
import { categories } from "@/lib/dummy-data";
import { Button, Card, Input } from "@kupon/ui";
import { FadeUp, StaggerReveal, StaggerItem } from "@/components/motion/StaggerReveal";
import {
  Plus,
  PencilSimple,
  Trash,
  Tag,
  X,
  Check,
} from "@phosphor-icons/react";

export default function AdminCategoriesPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Actions */}
      <FadeUp>
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-secondary">
            {categories.length} categories
          </p>
          <Button onClick={() => setShowAdd(!showAdd)}>
            <Plus size={16} weight="bold" />
            Add Category
          </Button>
        </div>
      </FadeUp>

      {/* Add Form */}
      {showAdd && (
        <FadeUp>
          <Card variant="glass" padding="md">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Input
                  label="Category Name"
                  placeholder="e.g. Battle Royale"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <Button size="md" disabled={!newName.trim()}>
                <Check size={14} weight="bold" />
                Save
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={() => {
                  setShowAdd(false);
                  setNewName("");
                }}
              >
                <X size={14} />
              </Button>
            </div>
          </Card>
        </FadeUp>
      )}

      {/* Category List */}
      <StaggerReveal className="space-y-2">
        {categories.map((category) => (
          <StaggerItem key={category.id}>
            <Card
              variant="default"
              padding="none"
              className="flex items-center justify-between px-5 py-4 hover:border-accent/20"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Tag size={18} className="text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {category.name}
                  </p>
                  <p className="text-xs text-text-muted">
                    /{category.slug} · {category.productCount || 0} products
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-accent hover:bg-accent/5 transition-all cursor-pointer">
                  <PencilSimple size={16} />
                </button>
                <button className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-red-400 hover:bg-red-400/5 transition-all cursor-pointer">
                  <Trash size={16} />
                </button>
              </div>
            </Card>
          </StaggerItem>
        ))}
      </StaggerReveal>
    </div>
  );
}
