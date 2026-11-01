# NS Designer - Backend API

Next.js (App Router, JavaScript) API with MongoDB, Cloudinary, JWT cookie auth,
WhatsApp/e-mail order alerts and PDF order sheets. It serves **only** `/api/*`.

## 0. What is new in this version

* **Customer accounts** (`/api/account/*`): sign-up with e-mail OTP, login, forgot-password with e-mail OTP. OTP e-mails are sent through **Brevo** (`BREVO_API_KEY`, `BREVO_SENDER_EMAIL`). In development, if no key is set, the OTP is printed in the API console.
* **Orders belong to an account.** Placing an order needs a signed-in shopper; `GET /api/account/orders` returns status + payment info from the same record the admin edits.
* **Payments:** admins record money received per order (`POST /api/admin/orders/:id/payments`). "Received" / "Remaining" everywhere come only from these entries.
* **Order statuses:** Order Received -> Order Accepted -> Stitching in Progress -> Ready to Deliver -> Delivered (or Cancelled). Old statuses are mapped automatically.
* **Role-based access:** every admin route needs a named permission (orders, payments, products, ...). Super Admin picks the permissions per team member.
* **Featured products:** any number of products can be featured; `GET /api/categories/showcase` gives one feature image per category for the home page.
* **AI chat:** `/api/chat/*` (shopper) and `/api/admin/chats/*` (team). The Python agent is private; set `AGENT_URL` and `AGENT_SHARED_SECRET`.

Existing database? Run once: `npm run migrate:v2`.

Unit tests (no database needed): `npm run test:unit`

## 1. Run locally (Windows CMD)

```
cd backend
npm install
copy .env.example .env.local
```
Edit `.env.local` (see the comments inside), then:
```
npm run seed        :: creates indexes, your Super Admin, categories and the 8 starter products
npm run dev         :: http://localhost:5000
```
Health check: <http://localhost:5000/api/health>

Generate secrets (needs Node):
```
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
Use one value for `JWT_SECRET`, and a different one for `PROXY_SHARED_SECRET`.

## 2. Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | yes | MongoDB Atlas connection string |
| `JWT_SECRET` | yes | 32+ random characters, signs admin sessions |
| `FRONTEND_URL` | yes | Website origin(s) allowed to call the API (CORS + CSRF check) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | for `npm run seed` | First Super Admin (password: 10+ chars, upper, lower, number, symbol) |
| `CLOUDINARY_*` | for image upload | Product and custom-design images |
| `PROXY_SHARED_SECRET` | recommended | Same value as the website's; lets the API see the real visitor IP for rate limiting |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ADMIN_NUMBER` | optional | Order alert + PDF on WhatsApp |
| `WHATSAPP_TEMPLATE_NAME` | optional | Approved template (see note below) |
| `SMTP_*` | optional | Order confirmation e-mail to the customer |

> **WhatsApp note:** Meta only allows free-form messages to a number that wrote to your
> business in the last 24 hours. For alerts that always arrive, create and get approved a
> message template (4 variables: order id, customer, phone, total) and set
> `WHATSAPP_TEMPLATE_NAME`. If WhatsApp is not configured, orders still work; the admin
> panel shows the order and a bell notification, and a failed alert has a **Resend** button.

## 3. What the API provides

**Public:** `GET /api/products`, `/api/products/:slug`, `/api/categories`, `/api/settings`,
`POST /api/orders` (order *request*, no payments), `/api/custom-orders` (multipart + image),
`/api/franchise`, `/api/contact`, `GET /api/health`.

**Auth:** `POST /api/auth/login | logout | change-password`, `GET /api/auth/me`.

**Admin (login required):** `/api/admin/dashboard`, `counts`, `orders` (+ status, notes, PDF,
resend), `products` (+ image upload), `categories`, `custom-orders` (quote price),
`franchise`, `messages`, `customers`, `notifications`, `settings` (Super Admin),
`users` (Super Admin: add staff, disable, reset password).

Roles: **Super Admin** (everything) and **Staff** (orders, products, enquiries - no settings, no team, no deletes).

## 3b. Security built in

- Passwords hashed with bcrypt (cost 12); strong-password rule; account locks for 15 min after 5 failed logins; login messages never reveal whether an email exists.
- Session = signed JWT in an **HttpOnly, Secure, SameSite** cookie (JavaScript cannot read it). Changing a password or disabling a user signs them out everywhere immediately.
- Every admin route re-checks the session **and** the role on the server.
- CSRF protection: state-changing requests must come from the allowed website origin; admin writes without an Origin header are refused.
- CORS allow-list, security headers, no stack traces in responses.
- All input validated with Zod; Mongo operator injection (`$ne`, `$where`...) stripped and rejected; regex searches escaped.
- **Prices always come from the database** - a customer cannot change the price from the browser.
- Uploads: size limit + real file-type check (magic bytes), only JPG/PNG/WebP, stored on Cloudinary.
- Rate limits per visitor on login, orders, forms, uploads; hidden honeypot field on public forms.
- Soft delete for products, so old orders keep their product snapshot.

## 4. Tests

With the API and a seeded database running:
```
npm run test:api
```
34 checks: validation, price tampering, injection attempts, forged origins, forged cookies,
role escalation, lockout, session invalidation, rate limits, CORS, headers, workflows.

## 5. Deploy on Render

New **Web Service** -> this repository.

| Setting | Value |
|---|---|
| Runtime | Node |
| Build command | `npm install && npm run build` |
| Start command | `npm start` |
| Health check path | `/api/health` |

Add the environment variables above. Set `FRONTEND_URL` to your website URL
(for example `https://www.yourdomain.com`). Run `npm run seed` once (Render **Shell** tab, or
locally pointed at the production `MONGODB_URI`). In MongoDB Atlas allow Render's outbound IPs
(or `0.0.0.0/0` together with a strong DB password).

The rate limiter is in-memory, which is right for **one** instance. If you ever scale to
several instances, move it to Redis.
