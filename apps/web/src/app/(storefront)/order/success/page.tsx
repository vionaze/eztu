import { FadeUp } from "@/components/motion/StaggerReveal";
import PaymentStatusSync from "./PaymentStatusSync";

export default function OrderSuccessPage() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-4 pt-20 pb-20">
      <FadeUp>
          <PaymentStatusSync />
      </FadeUp>
    </div>
  );
}
