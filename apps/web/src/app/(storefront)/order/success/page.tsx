import Link from "next/link";
import { Button, Card } from "@kupon/ui";
import { FadeUp } from "@/components/motion/StaggerReveal";
import { CheckCircle, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import PaymentStatusSync from "./PaymentStatusSync";

export default function OrderSuccessPage() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-4 pt-20 pb-20">
      <FadeUp>
        <Card variant="glass" padding="lg" className="max-w-md text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
            <CheckCircle size={32} weight="fill" className="text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">
            Payment Successful
          </h1>
          <p className="text-sm text-text-secondary leading-relaxed">
            Your payment has been confirmed. A secure voucher link will be
            delivered to the recipient email shortly.
          </p>
          <PaymentStatusSync />
          <div className="space-y-3 pt-2">
            <Link href="/products" className="block">
              <Button size="lg" className="w-full">
                Continue Shopping
                <ArrowRight size={14} />
              </Button>
            </Link>
            <Link href="/" className="block">
              <Button variant="ghost" size="lg" className="w-full">
                Back to Home
              </Button>
            </Link>
          </div>
        </Card>
      </FadeUp>
    </div>
  );
}
