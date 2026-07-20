#!/usr/bin/env python3
"""Generate EZTopUp Crisp Hugo knowledge-base PDF."""

from pathlib import Path

from fpdf import FPDF

OUT = Path(__file__).resolve().parent / "EZTopUp-Crisp-Knowledge-Base.pdf"


class KB(FPDF):
    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(100, 100, 100)
        self.cell(0, 6, "EZTopUp Support Knowledge Base  |  eztopup.io  |  Confidential", align="C")
        self.ln(8)

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 8, f"Page {self.page_no()}/{{nb}}", align="C")

    def h1(self, text: str):
        self.set_font("Helvetica", "B", 18)
        self.set_text_color(20, 20, 20)
        self.multi_cell(0, 9, text)
        self.ln(3)

    def h2(self, text: str):
        self.ln(2)
        self.set_font("Helvetica", "B", 13)
        self.set_text_color(30, 30, 30)
        self.multi_cell(0, 7, text)
        self.ln(1)

    def h3(self, text: str):
        self.ln(1)
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(40, 40, 40)
        self.multi_cell(0, 6, text)
        self.ln(0.5)

    def body(self, text: str):
        self.set_font("Helvetica", "", 10)
        self.set_text_color(40, 40, 40)
        self.multi_cell(0, 5.2, text)
        self.ln(1.5)

    def bullet(self, text: str):
        self.set_font("Helvetica", "", 10)
        self.set_text_color(40, 40, 40)
        self.multi_cell(0, 5.2, f"- {text}")
        self.ln(0.4)

    def callout(self, text: str):
        self.set_fill_color(235, 248, 242)
        self.set_draw_color(52, 211, 153)
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(20, 80, 50)
        x, y = self.get_x(), self.get_y()
        self.multi_cell(0, 5.5, text, border=1, fill=True)
        self.ln(3)


def build():
    pdf = KB()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=16)
    pdf.add_page()
    pdf.set_margins(16, 16, 16)

    pdf.h1("EZTopUp Support Knowledge Base")
    pdf.body(
        "For Crisp Hugo training (upload as File) and support agents. "
        "Website: https://eztopup.io  |  Support email: cs@eztopup.io  |  "
        "Last updated: July 2026"
    )
    pdf.callout(
        "IMPORTANT: Once a customer has received a voucher CODE, the transaction is COMPLETE. "
        "Codes are issued live from suppliers and generally cannot be reversed. "
        "If our system error blocked fulfillment, offer review/resolution per policy."
    )

    pdf.h2("1. Company overview")
    pdf.body(
        "EZTopUp is a digital voucher and e-voucher marketplace at eztopup.io. "
        "Customers buy gaming and digital products with crypto stablecoins (USDT / USDC), "
        "then receive a voucher code via email / secure link, or get a direct top-up to a game account."
    )
    pdf.bullet("Brand: EZTopUp")
    pdf.bullet("Domain: https://eztopup.io")
    pdf.bullet("Support: cs@eztopup.io")
    pdf.bullet("Contact page: https://eztopup.io/contact")
    pdf.bullet("Terms: https://eztopup.io/terms")
    pdf.bullet("Privacy: https://eztopup.io/privacy")

    pdf.h2("2. What we sell")
    pdf.body(
        "Digital vouchers (redeemable codes) and selected direct digital top-ups. "
        "Catalog may change; always check the live product page for price and fields required."
    )
    pdf.h3("Product types")
    pdf.bullet(
        "VOUCHER: customer needs email + quantity. Delivery is a voucher code / secure delivery link."
    )
    pdf.bullet(
        "DIGITAL top-up (example: Mobile Legends diamonds): customer needs User ID + Zone/Server ID. "
        "Value is credited to the game account; this is NOT a redeemable voucher code."
    )

    pdf.h3("Example catalog (test / current focus)")
    pdf.bullet("Mobile Legends - digital top-up (requires User ID + Zone ID)")
    pdf.bullet("Steam Wallet - voucher code")
    pdf.bullet("Roblox Gift Card - voucher code")
    pdf.body(
        "Other brands (Google Play, PlayStation, Riot, etc.) may be unpublished during testing. "
        "If a product is not on the site, say it is currently unavailable."
    )

    pdf.h2("3. How to buy (customer flow)")
    pdf.bullet("1) Open product page and choose a package / variant.")
    pdf.bullet("2) Set quantity (self-service has a max; bulk needs sales contact).")
    pdf.bullet("3) For ML top-up: enter correct User ID and Zone/Server ID.")
    pdf.bullet("4) Sign in / register (must accept Terms of Service on the login page).")
    pdf.bullet("5) Enter recipient email (where the voucher link/receipt is sent).")
    pdf.bullet("6) Pay with crypto checkout (USDT / USDC stablecoins when enabled).")
    pdf.bullet("7) Wait for payment confirmation, then fulfillment runs.")
    pdf.bullet("8) Check email, purchase history, and/or the secure voucher page for the code.")

    pdf.h2("4. Payments")
    pdf.bullet("Crypto-first checkout. Primary positioning: USDT and USDC stablecoins.")
    pdf.bullet("Payment must be confirmed by the payment provider before fulfillment.")
    pdf.bullet(
        "Pending payment: order stays pending until confirmed or it expires within the payment window."
    )
    pdf.bullet(
        "Blockchain network delays are outside EZTopUp control; ask customer to wait for confirmations "
        "and share order number if stuck."
    )
    pdf.bullet("Do not ask customers for private keys or seed phrases. Never.")

    pdf.h2("5. Delivery & completion policy")
    pdf.callout(
        "After the customer RECEIVES the voucher code(s), the sale is final and complete. "
        "Our system obtains codes directly from suppliers at fulfillment time."
    )
    pdf.bullet(
        "Customer should store codes safely. Loss after delivery due to sharing, screenshots leaked, "
        "or wrong redeem is not refundable."
    )
    pdf.bullet(
        "Wrong game User ID / Zone entered by customer may credit the wrong account and may not be reversible."
    )
    pdf.bullet(
        "If payment is confirmed but no code / top-up arrived: collect order number, email used, "
        "approx payment time, and escalate for system review."
    )
    pdf.bullet(
        "Possible resolutions for verified OUR system errors: re-fulfill, replacement where possible, "
        "or refund/credit per operations policy. No guarantee of exchange-rate recovery on crypto."
    )

    pdf.h2("6. Account & login")
    pdf.bullet("Customers sign in via the site login (Clerk). Terms checkbox is required before sign-in UI unlocks.")
    pdf.bullet("Purchase history is available when signed in (account / purchases).")
    pdf.bullet("Login issues: try another browser, clear cookies, or use the same method as registration (e.g. Google).")

    pdf.h2("7. Support channels & tone")
    pdf.bullet("Primary human email: cs@eztopup.io")
    pdf.bullet("On-site chat: Crisp (24/7 support presence; human may join when requested/available).")
    pdf.bullet("Contact page: https://eztopup.io/contact")
    pdf.bullet("Tone: professional, concise, helpful. English OK; Indonesian OK if customer writes in ID.")
    pdf.bullet("Do not invent order statuses, voucher codes, or refund guarantees.")
    pdf.bullet("Do not disclose supplier names, internal costs, or admin URLs.")
    pdf.bullet("Never claim 'instant in seconds' if payment is still pending.")

    pdf.h2("8. Escalation checklist (hand off to human)")
    pdf.body("Collect before escalating:")
    pdf.bullet("Order number")
    pdf.bullet("Account / recipient email")
    pdf.bullet("Product name and package")
    pdf.bullet("Payment time and currency (USDT/USDC) if known")
    pdf.bullet("Screenshot of payment or error (if any)")
    pdf.bullet("For ML: User ID + Zone they entered (do not ask for passwords)")

    pdf.h2("9. Things the bot must NOT do")
    pdf.bullet("Do not output fake voucher codes.")
    pdf.bullet("Do not promise refunds after successful code delivery.")
    pdf.bullet("Do not ask for crypto seed phrases, private keys, or full card data.")
    pdf.bullet("Do not claim multi-coin support beyond USDT/USDC unless the live checkout shows more.")
    pdf.bullet("Do not discuss competitors or internal supplier brand names.")

    pdf.h2("10. Quick policy summary for Hugo")
    pdf.body(
        "EZTopUp sells digital vouchers and top-ups at eztopup.io. Pay with USDT/USDC. "
        "Login required to purchase. Voucher codes are emailed / shown after payment confirms. "
        "Once a voucher code is received, the order is complete. "
        "For system failures after paid, support reviews case-by-case. "
        "Contact: cs@eztopup.io. Terms: /terms. Privacy: /privacy."
    )

    pdf.output(OUT)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    build()
