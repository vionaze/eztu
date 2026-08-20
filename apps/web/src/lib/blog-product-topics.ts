export const INDONESIAN_PRODUCT_BLOG_TOPICS = [
  "Mobile Legends: panduan memilih jumlah Diamond, Weekly Pass, dan cara memastikan User ID serta Zone ID benar sebelum top up",
  "Honor of Kings: perbedaan paket Token dan Weekly Card, cara memilih nominal yang paling sesuai kebutuhan pemain",
  "Call of Duty Mobile: panduan membeli CP, membandingkan bonus paket, dan menghindari kesalahan User ID",
  "Steam: cara memilih Steam Wallet sesuai region, memahami region lock, dan memakai saldo untuk membeli game",
  "Free Fire: panduan memilih paket Diamonds berdasarkan kebutuhan event, bundle, dan membership",
  "Valorant: cara memilih Valorant Points berdasarkan harga skin, bundle, dan Battle Pass tanpa membeli berlebihan",
  "Nintendo eShop: panduan memilih voucher Nintendo berdasarkan region akun dan mata uang eShop",
  "PlayStation Store: cara memilih kartu PSN sesuai region, nominal, dan kebutuhan game atau PlayStation Plus",
  "Xbox dan PC Game Pass: perbedaan Gift Card, PC Game Pass, dan Game Pass Ultimate serta cara memilih yang tepat",
] as const;

function normalized(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function buildIndonesianProductTopic(recentTitles: string[]) {
  const recent = recentTitles.map(normalized);
  const unused = INDONESIAN_PRODUCT_BLOG_TOPICS.find((topic) => {
    const productName = normalized(topic.split(":")[0] || topic);
    return !recent.some((title) => title.includes(productName));
  });
  return (
    unused ||
    INDONESIAN_PRODUCT_BLOG_TOPICS[
      recentTitles.length % INDONESIAN_PRODUCT_BLOG_TOPICS.length
    ]
  );
}
