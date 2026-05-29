"use client";

import { motion, type Variants } from "framer-motion";
import { type ReactNode } from "react";

interface StaggerRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  staggerDelay?: number;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: (custom: { delay: number; staggerDelay: number }) => ({
    opacity: 1,
    transition: {
      delayChildren: custom.delay,
      staggerChildren: custom.staggerDelay,
    },
  }),
};

const itemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 30,
    filter: "blur(6px)",
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15,
      mass: 0.8,
    },
  },
};

/**
 * Wraps children in a staggered reveal animation.
 * Each direct child will animate in sequence.
 */
export function StaggerReveal({
  children,
  className,
  delay = 0,
  staggerDelay = 0.08,
}: StaggerRevealProps) {
  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      custom={{ delay, staggerDelay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Individual item that animates within a StaggerReveal container
 */
export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}

/**
 * Simple fade-up reveal animation for sections
 */
export function FadeUp({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 40, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{
        type: "spring",
        stiffness: 80,
        damping: 20,
        delay,
      }}
    >
      {children}
    </motion.div>
  );
}
