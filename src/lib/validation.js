import { z } from "zod";
import { cleanText, normalizePhone } from "./security";
import { AUDIENCES } from "@/models/Category";
import { ORDER_STATUSES } from "@/models/Order";
import { CUSTOM_ORDER_STATUSES } from "@/models/CustomOrder";
import { FRANCHISE_STATUSES } from "@/models/FranchiseInquiry";
import { MESSAGE_STATUSES, MESSAGE_CATEGORIES } from "@/models/ContactMessage";
import { PAYMENT_METHODS } from "@/models/Order";
import { OTP_PURPOSES } from "@/models/OtpToken";
import { CHAT_STATUSES } from "@/models/ChatConversation";
import { ADMIN_ROLES, PERMISSION_KEYS } from "@/lib/permissions";

// ---------- building blocks ----------
const text = (min, max, label = "Value") =>
  z
    .string({ error: `${label} is required.` })
    .transform(cleanText)
    .pipe(
      z
        .string()
        .min(min, `${label} must be at least ${min} characters.`)
        .max(max, `${label} must be at most ${max} characters.`)
    );

const optionalText = (max, label = "Value") =>
  z
    .string()
    .optional()
    .default("")
    .transform(cleanText)
    .pipe(z.string().max(max, `${label} must be at most ${max} characters.`));

// For PATCH bodies: no default, so omitted fields are left untouched.
const patchText = (max) =>
  z.string().transform(cleanText).pipe(z.string().max(max)).optional();

export const phoneSchema = z
  .string({ error: "Phone number is required." })
  .transform(normalizePhone)
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number."));

export const optionalEmail = z
  .string()
  .optional()
  .default("")
  .transform((value) => value.trim().toLowerCase())
  .pipe(z.union([z.literal(""), z.email("Enter a valid email address.")]))
  .pipe(z.string().max(120));

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid identifier.");

// ---------- public forms ----------
export const orderCreateSchema = z
  .object({
    customer: z.object({
      fullName: text(2, 80, "Full name"),
      phone: phoneSchema,
      email: optionalEmail,
      address: text(5, 300, "Address"),
      state: text(2, 60, "State"),
      city: text(2, 60, "City"),
      pincode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit pincode."),
      notes: optionalText(500, "Notes"),
    }),
    items: z
      .array(
        z.object({
          slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/i, "Invalid product."),
          size: text(1, 10, "Size"),
          color: text(1, 40, "Colour"),
          quantity: z.coerce.number().int().min(1).max(10),
        })
      )
      .min(1, "Your cart is empty.")
      .max(20, "Too many items in one order."),
  })
  .strict();

export const customOrderSchema = z.object({
  customerName: text(2, 80, "Name"),
  phone: phoneSchema,
  email: optionalEmail,
  outfitType: text(2, 120, "Outfit type"),
  measurements: text(3, 1000, "Measurements"),
  requirements: optionalText(1500, "Requirements"),
});

export const franchiseSchema = z.object({
  name: text(2, 80, "Name"),
  phone: phoneSchema,
  email: optionalEmail,
  city: text(2, 100, "City"),
  investment: optionalText(40, "Investment"),
  message: optionalText(1500, "Message"),
});

export const contactSchema = z.object({
  name: text(2, 80, "Name"),
  phone: phoneSchema,
  email: optionalEmail,
  subject: optionalText(150, "Subject"),
  category: z.enum(MESSAGE_CATEGORIES).catch("Other"),
  message: text(5, 2000, "Message"),
});

// ---------- auth ----------
export const loginSchema = z.object({
  email: z.email("Enter a valid email.").transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1, "Password is required.").max(200),
});

export const passwordRule = z
  .string()
  .min(10, "Password must be at least 10 characters.")
  .max(100)
  .regex(/[a-z]/, "Include a lowercase letter.")
  .regex(/[A-Z]/, "Include an uppercase letter.")
  .regex(/\d/, "Include a number.")
  .regex(/[^A-Za-z0-9]/, "Include a symbol.");

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: passwordRule,
});

const permissionList = z.array(z.enum(PERMISSION_KEYS)).max(PERMISSION_KEYS.length);

export const adminUserCreateSchema = z.object({
  name: text(2, 80, "Name"),
  email: z.email().transform((v) => v.trim().toLowerCase()),
  password: passwordRule,
  role: z.enum(ADMIN_ROLES).default("staff"),
  permissions: permissionList.optional(),
});

export const adminUserUpdateSchema = z.object({
  active: z.boolean().optional(),
  role: z.enum(ADMIN_ROLES).optional(),
  permissions: permissionList.optional(),
  name: text(2, 80, "Name").optional(),
  password: passwordRule.optional(),
});

// ---------- shopper accounts ----------
export const customerPasswordRule = z
  .string({ error: "Password is required." })
  .min(8, "Password must be at least 8 characters.")
  .max(100, "Password is too long.")
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/\d/, "Include at least one number.");

const emailField = z
  .string({ error: "Email is required." })
  .transform((v) => v.trim().toLowerCase())
  .pipe(z.email("Enter a valid email address.").max(120));

const otpField = z
  .string({ error: "Enter the 6-digit code." })
  .transform((v) => v.replace(/\s/g, ""))
  .pipe(z.string().regex(/^\d{6}$/, "Enter the 6-digit code."));

export const registerSchema = z.object({
  name: text(2, 80, "Name"),
  email: emailField,
  phone: phoneSchema,
  password: customerPasswordRule,
});
export const userLoginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Password is required.").max(200),
});
export const verifyEmailSchema = z.object({ email: emailField, otp: otpField });
export const resendOtpSchema = z.object({ email: emailField, purpose: z.enum(OTP_PURPOSES) });
export const forgotPasswordSchema = z.object({ email: emailField });
export const resetPasswordSchema = z.object({ email: emailField, otp: otpField, newPassword: customerPasswordRule });

// ---------- payments & chat ----------
export const paymentSchema = z.object({
  amount: z.coerce.number({ error: "Enter the amount received." }).int("Enter a whole rupee amount.").min(1, "Amount must be at least ₹1.").max(10_000_000),
  method: z.enum(PAYMENT_METHODS).default("Cash"),
  note: optionalText(200, "Note"),
});
export const chatMessageSchema = z.object({ message: text(1, 500, "Message") });
export const chatAdminReplySchema = z.object({ message: text(1, 1500, "Reply") });
export const chatAdminUpdateSchema = z.object({ status: z.enum(CHAT_STATUSES) });

// ---------- admin ----------
const imageRef = z
  .object({
    publicId: z.string().max(200).optional().default(""),
    url: z.string().max(600),
    name: z.string().max(200).optional().default(""),
  })
  .refine((img) => /^https:\/\/res\.cloudinary\.com\//.test(img.url) || img.url.startsWith("/images/"), {
    message: "Image must come from the upload endpoint.",
  });

export const categorySchema = z.object({
  name: text(2, 60, "Category name"),
  audience: z.enum(AUDIENCES).default("Both"),
  active: z.boolean().optional().default(true),
});

export const productSchema = z.object({
  name: text(2, 140, "Product name"),
  categoryId: objectId,
  audience: z.enum(["Men", "Women"]),
  price: z.coerce.number().min(0).max(10_000_000),
  description: optionalText(3000),
  fabric: optionalText(1000),
  care: optionalText(1000),
  mainImage: imageRef.nullable().optional().default(null),
  galleryImages: z.array(imageRef).max(10).optional().default([]),
  sizes: z.array(text(1, 10)).max(12).default([]),
  colors: z.array(text(1, 40)).max(20).default([]),
  occasions: z.array(text(1, 40)).max(10).optional().default([]),
  status: z.enum(["Active", "Inactive"]).default("Active"),
  featured: z.boolean().optional().default(false),
});

export const orderUpdateSchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  measurements: z.enum(["Pending", "Confirmed"]).optional(),
  adminNotes: patchText(1000),
});

export const customOrderUpdateSchema = z.object({
  status: z.enum(CUSTOM_ORDER_STATUSES).optional(),
  price: z.coerce.number().min(0).max(10_000_000).nullable().optional(),
  adminNotes: patchText(1000),
});

export const franchiseUpdateSchema = z.object({
  status: z.enum(FRANCHISE_STATUSES).optional(),
  adminNotes: patchText(1000),
});

export const messageUpdateSchema = z.object({
  status: z.enum(MESSAGE_STATUSES).optional(),
  adminNotes: patchText(1000),
});

export const settingsSchema = z.object({
  storeName: text(2, 80, "Store name"),
  storeEmail: optionalEmail,
  storePhone: optionalText(20),
  storeAddress: optionalText(300),
  currency: z.enum(["INR"]).default("INR"),
  orderNotifications: z.boolean(),
  enquiryNotifications: z.boolean(),
  maintenanceMode: z.boolean(),
  stitchingWorkflow: z.boolean(),
  whatsappNumber: z
    .string()
    .optional()
    .default("")
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(z.string().max(15)),
});

export const objectIdSchema = objectId;
