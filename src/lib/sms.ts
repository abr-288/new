/**
 * Envoi de SMS. Interface prête pour une passerelle réelle.
 * Configurer SMS_GATEWAY_URL (+ SMS_GATEWAY_TOKEN) pour activer un envoi HTTP JSON {to, message}.
 * À défaut, le message est journalisé côté serveur (mode démonstration).
 * Le fournisseur SMS retenu (Twilio, Africa's Talking, Infobip, etc.) est une décision à valider.
 */
export const OTP_DEV_MODE = process.env.OTP_DEV_MODE !== "false" && !process.env.SMS_GATEWAY_URL;

export async function sendSms(to: string, message: string): Promise<boolean> {
  const url = process.env.SMS_GATEWAY_URL;
  if (!url) {
    console.log(`[SMS:demo] -> ${to}: ${message}`);
    return false;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.SMS_GATEWAY_TOKEN ? { authorization: `Bearer ${process.env.SMS_GATEWAY_TOKEN}` } : {}),
      },
      body: JSON.stringify({ to, message, sender: "MenewaNaya" }),
    });
    return res.ok;
  } catch (e) {
    console.error("[SMS] échec d'envoi", e);
    return false;
  }
}
