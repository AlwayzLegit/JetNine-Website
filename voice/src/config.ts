// Central env parsing. Fails fast on the values a live call cannot run
// without; everything else has a sensible default. TTS/STT settings live
// here in one obvious place so swapping the voice (or, later, Jet's cloned
// ElevenLabs voice) is an env change, not a code change.

// Missing required vars are collected, not thrown: the HTTP server still
// boots so /health can report exactly what is unset, and Render shows a
// live (if not yet call-ready) service instead of a crash loop.
export const missingEnv: string[] = [];
function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    missingEnv.push(name);
    return "";
  }
  return v;
}
const optional = (name: string, fallback: string) => process.env[name] ?? fallback;
const flag = (name: string, fallback: boolean) => {
  const v = process.env[name];
  return v === undefined ? fallback : /^(1|true|yes|on)$/i.test(v);
};

export const config = {
  env: optional("NODE_ENV", "development"),
  port: Number(optional("PORT", "3000")),
  publicHost: required("PUBLIC_HOST").replace(/^https?:\/\//, "").replace(/\/$/, ""),
  logRelayMessages: flag("LOG_RELAY_MESSAGES", process.env.NODE_ENV !== "production"),

  twilio: {
    accountSid: required("TWILIO_ACCOUNT_SID"),
    authToken: required("TWILIO_AUTH_TOKEN"),
    number: required("TWILIO_NUMBER"),
    validateSignatures: flag("TWILIO_VALIDATE_SIGNATURES", process.env.NODE_ENV === "production"),
  },

  anthropic: {
    apiKey: required("ANTHROPIC_API_KEY"),
    model: optional("ANTHROPIC_MODEL", "claude-sonnet-5"),
    // "disabled" keeps first-token latency lowest on the phone; set
    // ANTHROPIC_THINKING=adaptive to let the model think (adds latency).
    thinking: optional("ANTHROPIC_THINKING", "disabled") as "disabled" | "adaptive",
    maxTokens: Number(optional("ANTHROPIC_MAX_TOKENS", "600")),
  },

  supabase: {
    url: required("SUPABASE_URL"),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  },

  escalation: {
    phone: required("ESCALATION_PHONE"),
    alertPhone: optional("ALERT_PHONE", ""),
    smsAlertsEnabled: flag("SMS_ALERTS_ENABLED", false),
    dialTimeoutSeconds: Number(optional("ESCALATION_DIAL_TIMEOUT", "25")),
  },

  voice: {
    ttsProvider: optional("TTS_PROVIDER", "ElevenLabs"),
    ttsVoice: optional("TTS_VOICE", ""),
    ttsModel: optional("TTS_MODEL", "flash_v2_5"),
    sttProvider: optional("STT_PROVIDER", "Deepgram"),
    sttModel: optional("STT_MODEL", "nova-3-general"),
    language: optional("VOICE_LANGUAGE", "en-US"),
    recordingEnabled: flag("RECORDING_ENABLED", true),
  },
} as const;

/** True once every variable a live call needs is present. */
export const isConfigured = () => missingEnv.length === 0;

export const urls = {
  wss: `wss://${config.publicHost}/relay`,
  https: (path: string) => `https://${config.publicHost}${path}`,
};
