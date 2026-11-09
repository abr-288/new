import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  boolean,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });

/* ───────────── Utilisateurs & authentification ───────────── */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull().unique(),
  name: text("name").notNull().default(""),
  email: text("email"),
  // donor | client | provider | partner | beneficiary | subadmin | admin
  role: text("role").notNull().default("donor"),
  permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
  zone: text("zone"),
  country: text("country").default("Togo"),
  organization: text("organization"),
  bio: text("bio"),
  status: text("status").notNull().default("active"), // active | suspended | archived
  notifPrefs: jsonb("notif_prefs")
    .$type<{ inapp: boolean; sms: boolean; email: boolean }>()
    .notNull()
    .default({ inapp: true, sms: true, email: false }),
  tokenBalance: integer("token_balance").notNull().default(0),
  tokensEarned: integer("tokens_earned").notNull().default(0),
  createdAt: ts("created_at").notNull().defaultNow(),
  lastLoginAt: ts("last_login_at"),
});

export const otpCodes = pgTable(
  "otp_codes",
  {
    id: serial("id").primaryKey(),
    phone: text("phone").notNull(),
    codeHash: text("code_hash").notNull(),
    meta: jsonb("meta").$type<{ name?: string; role?: string }>(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: ts("expires_at").notNull(),
    consumedAt: ts("consumed_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("otp_phone_idx").on(t.phone)],
);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // sha256 du jeton
  userId: integer("user_id").notNull(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  userAgent: text("user_agent"),
});

/* ───────────── Prestataires ───────────── */
export const providerProfiles = pgTable("provider_profiles", {
  userId: integer("user_id").primaryKey(),
  category: text("category").notNull().default("autre"), // officiant | commerce | traiteur | transport | photo | autre
  description: text("description"),
  zone: text("zone"),
  available: boolean("available").notNull().default(true),
  verified: boolean("verified").notNull().default(false),
});

export const providerServices = pgTable("provider_services", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").notNull(),
  label: text("label").notNull(),
  category: text("category").notNull().default("autre"),
  unitCost: integer("unit_cost").notNull().default(0),
  unit: text("unit").notNull().default("prestation"),
  description: text("description"),
  active: boolean("active").notNull().default(true),
});

/* ───────────── Catalogue & panier ───────────── */
export const catalogItems = pgTable("catalog_items", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  category: text("category").notNull(), // nourriture | betail | volaille | habits | fournitures | equipements | action
  kind: text("kind").notNull().default("don"), // don | action
  description: text("description"),
  unitPrice: integer("unit_price").notNull(),
  costEstimate: integer("cost_estimate").notNull().default(0),
  unit: text("unit").notNull().default("unité"),
  emoji: text("emoji").default("🎁"),
  active: boolean("active").notNull().default(true),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const cartItems = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  catalogItemId: integer("catalog_item_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  target: text("target"), // cible : famille, orphelinat, école, personne…
  createdAt: ts("created_at").notNull().defaultNow(),
});

/* ───────────── Bénéficiaires (données sensibles) ───────────── */
export const beneficiaries = pgTable("beneficiaries", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  zone: text("zone"),
  address: text("address"),
  needs: text("needs"),
  notes: text("notes"),
  consent: boolean("consent").notNull().default(false),
  userId: integer("user_id"),
  createdBy: integer("created_by"),
  archivedAt: ts("archived_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

/* ───────────── Demandes ───────────── */
export const requests = pgTable(
  "requests",
  {
    id: serial("id").primaryKey(),
    ref: text("ref").notNull().unique(),
    userId: integer("user_id").notNull(),
    kind: text("kind").notNull().default("catalogue"), // catalogue | personnalise | action | recurrent
    title: text("title").notNull(),
    description: text("description"),
    category: text("category").notNull().default("autre"),
    targetName: text("target_name"),
    targetZone: text("target_zone"),
    beneficiaryId: integer("beneficiary_id"),
    partnerId: integer("partner_id"),
    status: text("status").notNull().default("submitted"),
    rejectionReason: text("rejection_reason"),
    infoRequest: text("info_request"),
    amountPerOccurrence: integer("amount_per_occurrence").notNull().default(0),
    occurrences: integer("occurrences").notNull().default(1),
    totalAmount: integer("total_amount").notNull().default(0),
    paymentMode: text("payment_mode").notNull().default("immediate"), // immediate | prefinance | echeance
    recurrence: text("recurrence").notNull().default("none"), // none | weekly | monthly | quarterly
    startDate: ts("start_date"),
    annexServices: jsonb("annex_services").$type<Record<string, unknown>>(),
    annexCost: integer("annex_cost").notNull().default(0),
    executionBudget: integer("execution_budget").notNull().default(0),
    otherFees: integer("other_fees").notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    completedAt: ts("completed_at"),
    closedAt: ts("closed_at"),
    archivedAt: ts("archived_at"),
  },
  (t) => [index("req_user_idx").on(t.userId), index("req_status_idx").on(t.status)],
);

export const requestItems = pgTable("request_items", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull(),
  catalogItemId: integer("catalog_item_id"),
  label: text("label").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: integer("unit_price").notNull().default(0),
  costEstimate: integer("cost_estimate").notNull().default(0),
  target: text("target"),
});

export const requestHistory = pgTable("request_history", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull(),
  status: text("status").notNull(),
  note: text("note"),
  actorId: integer("actor_id"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const installments = pgTable("installments", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull(),
  seq: integer("seq").notNull(),
  dueDate: ts("due_date").notNull(),
  amount: integer("amount").notNull(),
  status: text("status").notNull().default("planned"), // planned | done
  notifiedAt: ts("notified_at"),
});

/* ───────────── Missions & preuves ───────────── */
export const missions = pgTable(
  "missions",
  {
    id: serial("id").primaryKey(),
    requestId: integer("request_id").notNull(),
    providerId: integer("provider_id"),
    title: text("title").notNull(),
    instructions: text("instructions"),
    status: text("status").notNull().default("proposed"), // proposed | accepted | refused | in_progress | completed | cancelled
    refusalReason: text("refusal_reason"),
    dueDate: ts("due_date"),
    providerFee: integer("provider_fee").notNull().default(0),
    compensationMode: text("compensation_mode").notNull().default("money"), // money | exchange
    exchangeDescription: text("exchange_description"),
    exchangeStatus: text("exchange_status").default("pending"), // pending | in_progress | done
    exceptionReason: text("exception_reason"),
    reassignedFrom: integer("reassigned_from"),
    createdBy: integer("created_by"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    completedAt: ts("completed_at"),
    validatedAt: ts("validated_at"),
  },
  (t) => [index("mission_provider_idx").on(t.providerId)],
);

export const proofs = pgTable("proofs", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull(),
  missionId: integer("mission_id"),
  type: text("type").notNull(), // photo | video | receipt | invoice | attestation
  filePath: text("file_path").notNull(),
  fileName: text("file_name").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull().default(0),
  caption: text("caption"),
  uploadedBy: integer("uploaded_by").notNull(),
  status: text("status").notNull().default("pending"), // pending | validated | rejected
  rejectionReason: text("rejection_reason"),
  reviewedBy: integer("reviewed_by"),
  reviewedAt: ts("reviewed_at"),
  visibleToDonor: boolean("visible_to_donor").notNull().default(true),
  createdAt: ts("created_at").notNull().defaultNow(),
});

/* ───────────── Paiements & échanges de services ───────────── */
export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    requestId: integer("request_id"),
    missionId: integer("mission_id"),
    serviceOrderId: integer("service_order_id"),
    installmentId: integer("installment_id"),
    userId: integer("user_id").notNull(), // payeur (in) ou bénéficiaire du paiement (out)
    direction: text("direction").notNull(), // in | out
    kind: text("kind").notNull().default("don"), // don | prestation | service
    mode: text("mode").notNull().default("money"), // money | exchange
    method: text("method"), // mobile_money | card | bank | cash | exchange
    amountPlanned: integer("amount_planned").notNull().default(0),
    amountValidated: integer("amount_validated"),
    amountPaid: integer("amount_paid").notNull().default(0),
    status: text("status").notNull().default("planned"), // planned | declared | validated | partial | paid | cancelled
    reference: text("reference"),
    receiptPath: text("receipt_path"),
    receiptName: text("receipt_name"),
    exchangeDescription: text("exchange_description"),
    exchangeStatus: text("exchange_status"),
    dueDate: ts("due_date"),
    note: text("note"),
    createdAt: ts("created_at").notNull().defaultNow(),
    paidAt: ts("paid_at"),
  },
  (t) => [index("pay_req_idx").on(t.requestId)],
);

/* ───────────── Litiges ───────────── */
export const disputes = pgTable("disputes", {
  id: serial("id").primaryKey(),
  ref: text("ref").notNull().unique(),
  requestId: integer("request_id"),
  missionId: integer("mission_id"),
  openedBy: integer("opened_by").notNull(),
  againstUserId: integer("against_user_id"),
  subject: text("subject").notNull(),
  description: text("description"),
  status: text("status").notNull().default("open"), // open | investigating | resolved | closed
  responsibleId: integer("responsible_id"),
  decision: text("decision"),
  createdAt: ts("created_at").notNull().defaultNow(),
  closedAt: ts("closed_at"),
});

export const disputeMessages = pgTable("dispute_messages", {
  id: serial("id").primaryKey(),
  disputeId: integer("dispute_id").notNull(),
  authorId: integer("author_id").notNull(),
  body: text("body").notNull(),
  attachmentPath: text("attachment_path"),
  attachmentName: text("attachment_name"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

/* ───────────── Services communautaires ───────────── */
export const serviceOrders = pgTable("service_orders", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  providerId: integer("provider_id").notNull(),
  offerId: integer("offer_id"),
  title: text("title").notNull(),
  description: text("description"),
  zone: text("zone"),
  proposedPrice: integer("proposed_price").notNull().default(0),
  agreedPrice: integer("agreed_price"),
  compensationMode: text("compensation_mode").notNull().default("money"),
  exchangeDescription: text("exchange_description"),
  status: text("status").notNull().default("requested"), // requested | negotiating | agreed | in_progress | done | confirmed | declined | cancelled
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const serviceMessages = pgTable("service_messages", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  authorId: integer("author_id").notNull(),
  body: text("body").notNull(),
  price: integer("price"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    kind: text("kind").notNull(), // mission | service
    refId: integer("ref_id").notNull(),
    fromUserId: integer("from_user_id").notNull(),
    toUserId: integer("to_user_id").notNull(),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("review_unique").on(t.kind, t.refId, t.fromUserId)],
);

/* ───────────── Tokens Mena & gamification ───────────── */
export const tokenRules = pgTable("token_rules", {
  id: serial("id").primaryKey(),
  eventKey: text("event_key").notNull().unique(),
  label: text("label").notNull(),
  amount: integer("amount").notNull().default(0),
  dailyCap: integer("daily_cap").notNull().default(0), // 0 = illimité
  active: boolean("active").notNull().default(true),
});

export const tokenTransactions = pgTable("token_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  amount: integer("amount").notNull(), // signé
  type: text("type").notNull(), // earn | spend | adjust | transfer_in | transfer_out | conversion
  eventKey: text("event_key"),
  reason: text("reason"),
  refType: text("ref_type"),
  refId: integer("ref_id"),
  refKey: text("ref_key").unique(), // anti-doublon
  status: text("status").notNull().default("approved"), // approved | pending | rejected
  createdBy: integer("created_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const userBadges = pgTable(
  "user_badges",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    code: text("code").notNull(),
    awardedAt: ts("awarded_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("badge_unique").on(t.userId, t.code)],
);

/* ───────────── Marketplace partenaires / crowdfunding ───────────── */
export const listings = pgTable("listings", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").notNull(),
  type: text("type").notNull(), // don | action | crowdfunding
  title: text("title").notNull(),
  description: text("description"),
  zone: text("zone"),
  goalAmount: integer("goal_amount").notNull().default(0),
  raisedAmount: integer("raised_amount").notNull().default(0),
  menaSupport: integer("mena_support").notNull().default(0),
  endsAt: ts("ends_at"),
  status: text("status").notNull().default("pending"), // pending | published | rejected | closed
  rejectionReason: text("rejection_reason"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const listingContributions = pgTable("listing_contributions", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id").notNull(),
  userId: integer("user_id").notNull(),
  amount: integer("amount").notNull(),
  method: text("method"),
  reference: text("reference"),
  status: text("status").notNull().default("declared"), // declared | confirmed | rejected
  createdAt: ts("created_at").notNull().defaultNow(),
});

/* ───────────── Transverse ───────────── */
export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    readAt: ts("read_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("notif_user_idx").on(t.userId)],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  description: text("description"),
  updatedBy: integer("updated_by"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    actorId: integer("actor_id"),
    actorRole: text("actor_role"),
    action: text("action").notNull(),
    entity: text("entity"),
    entityId: text("entity_id"),
    details: jsonb("details").$type<Record<string, unknown>>(),
    ip: text("ip"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);

export const contactMessages = pgTable("contact_messages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  handled: boolean("handled").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
});
