export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Soma ↔ MIP 연동
  somaMipSharedSecret: process.env.SOMA_MIP_SHARED_SECRET ?? "",
  mipSomaSharedSecret: process.env.MIP_SOMA_SHARED_SECRET ?? "",
  somaWebhookUrl: process.env.SOMA_WEBHOOK_URL ?? "https://soma.mysoma.space",
  somaServiceUrl: process.env.SOMA_SERVICE_URL ?? "https://soma.mysoma.space",
  // Lore ↔ MIP 연동
  loreMipSharedSecret: process.env.LORE_MIP_SHARED_SECRET ?? "",
  mipLoreSharedSecret: process.env.MIP_LORE_SHARED_SECRET ?? "",
  loreWebhookUrl: process.env.LORE_WEBHOOK_URL ?? "https://lore.mysoma.space",
  loreServiceUrl: process.env.LORE_SERVICE_URL ?? "https://lore.mysoma.space",
  // 한결(Hangyeol) ↔ MIP 연동
  hangyeolMipSharedSecret: process.env.HANGYEOL_MIP_SHARED_SECRET ?? "",
  mipHangyeolSharedSecret: process.env.MIP_HANGYEOL_SHARED_SECRET ?? "",
  hangyeolServiceUrl: process.env.HANGYEOL_SERVICE_URL ?? "https://hangyeol.mysoma.space",
};
