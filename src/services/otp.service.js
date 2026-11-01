import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import OtpToken from "@/models/OtpToken";
import { getJwtSecret } from "@/lib/env";
import { checkRateLimit } from "@/middleware/rateLimit";
import { sendOtpEmail } from "./brevo.service";
import { AppError } from "@/utils/apiResponse";

export const OTP_MINUTES = 10;
export const OTP_RESEND_SECONDS = 60;
const MAX_ATTEMPTS = 5;

// Keyed hash: a stolen database row is useless without the server secret, and a
// 6-digit code cannot be brute-forced offline.
export function hashOtp(email, purpose, code) {
  return createHmac("sha256", getJwtSecret()).update(`${email}|${purpose}|${code}`).digest("hex");
}

export function generateCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function safeEqualHex(a, b) {
  const x = Buffer.from(String(a), "hex");
  const y = Buffer.from(String(b), "hex");
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

/** Creates (or replaces) a code and e-mails it. Enforces a resend cooldown and an hourly cap. */
export async function issueOtp({ email, name, purpose }) {
  const hourly = checkRateLimit(`otp-send:${email}`, 6, 60 * 60_000);
  if (!hourly.ok) throw new AppError("Too many codes requested. Please try again later.", 429);

  const existing = await OtpToken.findOne({ email, purpose });
  if (existing) {
    const waited = (Date.now() - existing.lastSentAt.getTime()) / 1000;
    if (waited < OTP_RESEND_SECONDS) {
      const wait = Math.ceil(OTP_RESEND_SECONDS - waited);
      throw new AppError(`Please wait ${wait}s before requesting another code.`, 429);
    }
  }

  const code = generateCode();
  await OtpToken.findOneAndUpdate(
    { email, purpose },
    {
      $set: {
        codeHash: hashOtp(email, purpose, code),
        attempts: 0,
        lastSentAt: new Date(),
        expiresAt: new Date(Date.now() + OTP_MINUTES * 60_000),
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  try {
    await sendOtpEmail({ to: email, name, code, purpose, minutes: OTP_MINUTES });
  } catch (error) {
    await OtpToken.deleteOne({ email, purpose }); // do not keep a code the user never received
    throw error;
  }
}

/** Checks a code. Wrong guesses are counted; the code dies after 5 wrong attempts. */
export async function consumeOtp({ email, purpose, code }) {
  const bad = new AppError("That code is incorrect or has expired.", 400);
  const token = await OtpToken.findOne({ email, purpose });
  if (!token || token.expiresAt < new Date()) throw bad;

  if (token.attempts >= MAX_ATTEMPTS) {
    await token.deleteOne();
    throw new AppError("Too many wrong attempts. Please request a new code.", 429);
  }

  if (!safeEqualHex(token.codeHash, hashOtp(email, purpose, code))) {
    token.attempts += 1;
    await token.save();
    throw bad;
  }
  await token.deleteOne(); // single use
}
