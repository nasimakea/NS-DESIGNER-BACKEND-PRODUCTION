import ChatConversation from "@/models/ChatConversation";
import Product from "@/models/Product";
import Notification from "@/models/Notification";
import { env } from "@/lib/env";
import { cleanText } from "@/lib/security";
import { sendChatReplyEmail } from "./brevo.service";
import { AppError } from "@/utils/apiResponse";

const MAX_MESSAGES = 200;
const HISTORY_TURNS = 10;
const LOCK_MINUTES = 60;
const MAX_STRIKES = 5;
const HANDOVER_REASONS = new Set(["out_of_domain", "customer_requested", "needs_staff", "ai_unavailable"]);

const HANDOVER_TEXT = {
  out_of_domain:
    "That question is outside what I can help with as NS Designer's AI stylist, so I have passed it to our team. They will reply right here in this chat - you can also keep this page open.",
  customer_requested: "Sure - I have connected you with the NS Designer team. They will reply right here in this chat.",
  needs_staff:
    "That needs a decision from our team, so I have passed your message to them. They will reply right here in this chat.",
  ai_unavailable:
    "I am having trouble right now, so I have passed your message to our team. They will reply right here in this chat.",
};

// ---------------------------------------------------------------------------
export async function getOrCreateConversation(shopper) {
  let chat = await ChatConversation.findOne({ user: shopper._id, status: { $in: ["ai", "handover"] } }).sort({ createdAt: -1 });
  if (!chat) {
    chat = await ChatConversation.create({
      user: shopper._id,
      userName: shopper.name,
      userEmail: shopper.email,
      messages: [
        {
          role: "assistant",
          content: `Hello ${shopper.name.split(" ")[0]}! I'm the NS Designer AI stylist. Tell me what you're looking for - the occasion, the style or colour - and I'll suggest designs from our collection.`,
          suggestions: ["Wedding sherwani for men", "Formal wear for office", "I want a custom design"],
        },
      ],
    });
  }
  return chat;
}

export async function startNewConversation(shopper) {
  const open = await ChatConversation.findOne({ user: shopper._id, status: { $in: ["ai", "handover"] } });
  if (open?.status === "handover") {
    throw new AppError("Our team is already looking at your chat. Please wait for their reply or ask them to close it.", 409);
  }
  if (open) {
    open.status = "resolved";
    await open.save();
  }
  return getOrCreateConversation(shopper);
}

// ---------------------------------------------------------------------------
// Serialisation: product cards are ALWAYS rebuilt from the live catalogue, so a
// price or image can never come from model text.
// ---------------------------------------------------------------------------
async function productCards(slugs) {
  const unique = [...new Set(slugs)].slice(0, 60);
  if (!unique.length) return new Map();
  const products = await Product.find({ slug: { $in: unique }, status: "Active", deletedAt: null })
    .populate("category", "name")
    .select("slug name price mainImage category audience occasions")
    .lean();
  return new Map(
    products.map((p) => [
      p.slug,
      {
        slug: p.slug,
        name: p.name,
        price: p.price,
        image: p.mainImage?.url || "/images/placeholder.png",
        category: p.category?.name || "",
        audience: p.audience,
      },
    ])
  );
}

export async function serializeConversation(chat, { forAdmin = false } = {}) {
  const o = chat.toObject ? chat.toObject() : chat;
  const cards = await productCards(o.messages.flatMap((m) => m.productSlugs || []));
  return {
    id: String(o._id),
    status: o.status,
    handoverReason: o.handoverReason,
    handoverAt: o.handoverAt,
    handledBy: o.handledBy,
    lastMessageAt: o.lastMessageAt,
    unreadForUser: o.unreadForUser,
    locked: Boolean(o.lockedUntil && new Date(o.lockedUntil) > new Date()),
    ...(forAdmin ? { userName: o.userName, userEmail: o.userEmail, unreadForAdmin: o.unreadForAdmin, strikes: o.strikes } : {}),
    messages: o.messages.map((m) => ({
      id: String(m._id),
      role: m.role,
      content: m.content,
      adminName: m.role === "admin" ? m.adminName || "NS Designer Team" : "",
      suggestions: m.suggestions || [],
      products: (m.productSlugs || []).map((s) => cards.get(s)).filter(Boolean),
      createdAt: m.createdAt,
    })),
  };
}

// ---------------------------------------------------------------------------
// Talking to the private AI agent
// ---------------------------------------------------------------------------
async function askAgent({ chat, message, firstName }) {
  if (!env.agent.secret) throw new Error("AGENT_SHARED_SECRET is not set");

  const history = chat.messages
    .filter((m) => m.role === "user" || m.role === "assistant" || m.role === "admin")
    .slice(-HISTORY_TURNS - 1, -1) // everything before the message just added
    .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content.slice(0, 600) }));

  const response = await fetch(`${env.agent.url}/v1/respond`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-agent-key": env.agent.secret },
    body: JSON.stringify({ conversation_id: String(chat._id), message, history, first_name: firstName }),
    signal: AbortSignal.timeout(env.agent.timeoutMs),
  });
  if (!response.ok) throw new Error(`agent responded ${response.status}`);
  return response.json();
}

// The agent is treated as an untrusted component: its answer is validated before it is stored.
function validateAgentAnswer(raw) {
  const reply = typeof raw?.reply === "string" ? cleanText(raw.reply).slice(0, 1500) : "";
  if (!reply) throw new Error("empty agent reply");
  const handover = raw?.handover === true && HANDOVER_REASONS.has(raw?.handover_reason);
  return {
    reply,
    handover,
    reason: handover ? raw.handover_reason : "",
    flagged: raw?.flagged === true,
    slugs: Array.isArray(raw?.product_slugs) ? raw.product_slugs.filter((s) => typeof s === "string").slice(0, 4) : [],
    suggestions: Array.isArray(raw?.suggestions)
      ? raw.suggestions.filter((s) => typeof s === "string").map((s) => cleanText(s).slice(0, 60)).filter(Boolean).slice(0, 3)
      : [],
  };
}

async function markHandover(chat, reason) {
  chat.status = "handover";
  chat.handoverReason = reason;
  chat.handoverAt = new Date();
  chat.unreadForAdmin = true;
  Notification.create({
    type: "chat",
    title: `Chat needs a reply: ${chat.userName}`,
    body: reason === "out_of_domain" ? "Asked something outside the AI stylist's scope." : reason === "customer_requested" ? "Customer asked for the team." : "Needs a human decision.",
    link: "/admin/chats",
  }).catch(() => {});
}

export async function handleUserMessage(shopper, rawMessage) {
  const message = cleanText(rawMessage).replace(/\s+/g, " ").slice(0, 500);
  if (!message) throw new AppError("Please type a message.", 400);

  const chat = await getOrCreateConversation(shopper);

  if (chat.lockedUntil && chat.lockedUntil > new Date()) {
    throw new AppError("Chat is paused for a while because of repeated unsafe messages. Please try again later or contact us.", 429);
  }
  if (chat.messages.length >= MAX_MESSAGES) {
    throw new AppError("This chat is full. Please start a new chat.", 409);
  }

  chat.messages.push({ role: "user", content: message });
  chat.lastMessageAt = new Date();

  // Already with the team: store the message for them, no AI involved.
  if (chat.status === "handover") {
    chat.unreadForAdmin = true;
    await chat.save();
    return chat;
  }

  let answer;
  try {
    answer = validateAgentAnswer(await askAgent({ chat, message, firstName: shopper.name.split(" ")[0] }));
  } catch (error) {
    console.error("[chat] agent failed:", error?.message);
    chat.messages.push({ role: "assistant", content: HANDOVER_TEXT.ai_unavailable });
    await markHandover(chat, "ai_unavailable");
    chat.lastMessageAt = new Date();
    await chat.save();
    return chat;
  }

  if (answer.flagged) {
    chat.strikes += 1;
    if (chat.strikes >= MAX_STRIKES) chat.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60_000);
  }

  // Only slugs that really exist in the live catalogue can become product cards.
  const real = await productCards(answer.slugs);
  const productSlugs = answer.slugs.filter((s) => real.has(s));

  chat.messages.push({ role: "assistant", content: answer.reply, productSlugs, suggestions: answer.suggestions });
  if (answer.handover) {
    // The reply already tells the customer what happens; add the standard line if the agent forgot.
    if (!/team/i.test(answer.reply)) chat.messages.push({ role: "assistant", content: HANDOVER_TEXT[answer.reason] });
    await markHandover(chat, answer.reason);
  }
  chat.lastMessageAt = new Date();
  await chat.save();
  return chat;
}

// ---------------------------------------------------------------------------
// Admin side
// ---------------------------------------------------------------------------
export async function adminReply(chat, text, admin, userDoc) {
  chat.messages.push({ role: "admin", content: cleanText(text).slice(0, 1500), adminName: admin.name });
  chat.handledBy = admin.name;
  chat.unreadForAdmin = false;
  chat.unreadForUser = true;
  chat.lastMessageAt = new Date();
  if (chat.status === "resolved") chat.status = "handover";
  await chat.save();

  // E-mail the shopper at most once every 10 minutes so they notice the reply.
  if (userDoc?.email && (!userDoc.lastChatEmailAt || Date.now() - userDoc.lastChatEmailAt.getTime() > 10 * 60_000)) {
    userDoc.lastChatEmailAt = new Date();
    await userDoc.save();
    sendChatReplyEmail({ to: userDoc.email, name: userDoc.name }).catch((e) => console.error("[chat email] failed:", e?.message));
  }
  return chat;
}
