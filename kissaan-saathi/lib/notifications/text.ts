// Notification wording in English and Marathi.
//
// The database stores only raw facts (type + params such as {sender, listing,
// qty, price}). The final sentence is built HERE using the language chosen with
// the app's EN / मराठी toggle, so switching language also switches every
// notification, old ones included. To change a sentence or add a language,
// edit this file only. Unknown types fall back to the English text saved in
// the database (title / message).

import type { Lang } from "@/lib/i18n/dictionary";
import type { NotificationItem } from "./api";

// ---- Which bottom-nav tab a notification belongs to (for the tab badges) ----
export type Section = "dashboard" | "listings" | "chats" | "orders" | "disputes";

const SECTION_BY_TYPE: Record<string, Section> = {
  chat_message: "chats",
  chat_new: "chats",
  offer_from_farmer: "chats",
  offer_accepted: "chats",
  offer_rejected: "chats",
  offer_from_buyer: "dashboard", // farmer sees these under "New orders" on the dashboard
  order_new: "orders",
  order_accepted: "orders",
  order_packing: "orders",
  order_packed: "orders",
  order_ready_pickup: "orders",
  order_delivered: "orders",
  order_completed: "orders",
  order_cancelled: "orders",
  order_disputed: "orders",
  order_status: "orders",
  delivery_partner_assigned: "orders",
  payment_paid: "orders",
  payment_failed: "orders",
  payment_refunded: "orders",
  payment_cod_collected: "orders",
  dispute_resolved: "orders",
  delivery_available: "dashboard",
  delivery_assigned_you: "dashboard",
  dispute_new: "disputes",
  listing_new: "listings",
  listing_resubmitted: "listings",
  listing_approved: "listings",
  listing_rejected: "listings",
  listing_changes_requested: "listings",
  listing_suspended: "listings",
  user_new: "dashboard",
  settlement_paid: "dashboard",
};

export function sectionOf(type: string): Section {
  return SECTION_BY_TYPE[type] ?? "dashboard";
}

// ---- Sentence templates. {placeholders} are filled from params ----
type Tpl = { title: string; body: string };
type Table = Record<string, Tpl>;

const en: Table = {
  chat_message: { title: "New message from {sender}", body: "{preview}" },
  "chat_message.many": { title: "{count} new messages from {sender}", body: "{preview}" },
  chat_new: { title: "New chat", body: "{sender} started a chat about {listing}." },

  offer_from_buyer: { title: "New order request", body: "{sender} wants {qty} kg of {listing} @ ₹{price}/kg." },
  offer_from_farmer: { title: "New offer from farmer", body: "{sender} offered {qty} kg of {listing} @ ₹{price}/kg." },
  offer_accepted: { title: "Offer accepted", body: "{sender} accepted your offer for {listing} ({qty} kg @ ₹{price}/kg)." },
  offer_rejected: { title: "Offer declined", body: "{sender} declined your offer for {listing}." },
  "offer_rejected.reason": { title: "Offer declined", body: "{sender} declined your offer for {listing}. Reason: {reason}" },

  order_new: { title: "New order received", body: "{sender} placed an order: {qty} kg of {listing}. Accept it to start packing." },
  order_accepted: { title: "Order accepted", body: "The farmer accepted your order for {listing}." },
  order_packing: { title: "Packing started", body: "Your {listing} order is being packed." },
  order_packed: { title: "Order packed", body: "Your {listing} order is packed and ready." },
  order_ready_pickup: { title: "Ready for pickup", body: "Your {listing} order is ready. Collect it from the farmer and confirm pickup." },
  order_delivered: { title: "Order delivered", body: "The {listing} order has been delivered." },
  order_completed: { title: "Order completed", body: "The {listing} order is complete." },
  order_cancelled: { title: "Order cancelled", body: "The {listing} order was cancelled." },
  order_disputed: { title: "Problem reported", body: "The buyer reported a problem with the {listing} order." },
  order_status: { title: "Order update", body: "The {listing} order is now: {status}." },

  delivery_available: { title: "New delivery available", body: "{listing} · {qty} kg. Delivery charge ₹{amount}. Accept it before someone else does." },
  delivery_assigned_you: { title: "New delivery assigned to you", body: "{listing}, {qty} kg — open it to see pickup and drop details." },
  delivery_partner_assigned: { title: "Delivery partner assigned", body: "A delivery partner accepted the {listing} order and will pick it up from the farmer." },

  payment_paid: { title: "Payment received", body: "Payment for the {listing} order was confirmed." },
  payment_failed: { title: "Payment failed", body: "Payment for the {listing} order didn't go through. Please try again." },
  payment_refunded: { title: "Payment refunded", body: "Your payment for the {listing} order was refunded." },
  payment_cod_collected: { title: "Cash collected", body: "Cash on Delivery for the {listing} order was marked as collected." },

  dispute_new: { title: "New dispute", body: "{sender} reported: {reason}." },
  dispute_resolved: { title: "Dispute resolved", body: "Resolution: {resolution}." },

  listing_new: { title: "New listing to review", body: "{sender} added {listing}." },
  listing_resubmitted: { title: "Listing resubmitted", body: "{sender} updated {listing} for review." },
  listing_approved: { title: "Listing approved", body: "{listing} is now live for buyers." },
  listing_rejected: { title: "Listing rejected", body: "{listing} was rejected." },
  "listing_rejected.reason": { title: "Listing rejected", body: "{listing} was rejected. Reason: {reason}" },
  listing_changes_requested: { title: "Changes requested", body: "Admin asked for changes to {listing}." },
  "listing_changes_requested.reason": { title: "Changes requested", body: "Admin asked for changes to {listing}. Reason: {reason}" },
  listing_suspended: { title: "Listing suspended", body: "{listing} was suspended by admin." },
  "listing_suspended.reason": { title: "Listing suspended", body: "{listing} was suspended by admin. Reason: {reason}" },

  user_new: { title: "New {role} signed up", body: "{sender} joined Kissaan Saathi." },
  settlement_paid: { title: "Payout sent", body: "₹{amount} was paid to you (UTR {utr})." },
};

const mr: Table = {
  chat_message: { title: "{sender} कडून नवीन संदेश", body: "{preview}" },
  "chat_message.many": { title: "{sender} कडून {count} नवीन संदेश", body: "{preview}" },
  chat_new: { title: "नवीन संवाद", body: "{sender} यांनी {listing} बद्दल संवाद सुरू केला." },

  offer_from_buyer: { title: "नवीन ऑर्डरची मागणी", body: "{sender} यांना {listing} — {qty} किलो, ₹{price}/किलो दराने हवे आहे." },
  offer_from_farmer: { title: "शेतकऱ्याकडून नवीन ऑफर", body: "{sender} यांनी {listing} — {qty} किलो, ₹{price}/किलो दराने ऑफर दिली." },
  offer_accepted: { title: "ऑफर मान्य झाली", body: "{sender} यांनी {listing} साठी तुमची ऑफर ({qty} किलो, ₹{price}/किलो) मान्य केली." },
  offer_rejected: { title: "ऑफर नाकारली", body: "{sender} यांनी {listing} साठी तुमची ऑफर नाकारली." },
  "offer_rejected.reason": { title: "ऑफर नाकारली", body: "{sender} यांनी {listing} साठी तुमची ऑफर नाकारली. कारण: {reason}" },

  order_new: { title: "नवीन ऑर्डर आली", body: "{sender} यांनी ऑर्डर दिली: {listing}, {qty} किलो. पॅकिंग सुरू करण्यासाठी ऑर्डर स्वीकारा." },
  order_accepted: { title: "ऑर्डर स्वीकारली", body: "शेतकऱ्याने {listing} ची तुमची ऑर्डर स्वीकारली." },
  order_packing: { title: "पॅकिंग सुरू", body: "तुमची {listing} ची ऑर्डर पॅक केली जात आहे." },
  order_packed: { title: "ऑर्डर पॅक झाली", body: "तुमची {listing} ची ऑर्डर पॅक होऊन तयार आहे." },
  order_ready_pickup: { title: "पिकअपसाठी तयार", body: "तुमची {listing} ची ऑर्डर तयार आहे. शेतकऱ्याकडून घ्या आणि पिकअप निश्चित करा." },
  order_delivered: { title: "ऑर्डर पोहोचली", body: "{listing} ची ऑर्डर पोहोचवली गेली आहे." },
  order_completed: { title: "ऑर्डर पूर्ण झाली", body: "{listing} ची ऑर्डर पूर्ण झाली." },
  order_cancelled: { title: "ऑर्डर रद्द झाली", body: "{listing} ची ऑर्डर रद्द झाली." },
  order_disputed: { title: "तक्रार नोंदवली", body: "खरेदीदाराने {listing} च्या ऑर्डरबाबत तक्रार नोंदवली." },
  order_status: { title: "ऑर्डर अपडेट", body: "{listing} ची ऑर्डर आता: {status}." },

  delivery_available: { title: "नवीन डिलिव्हरी उपलब्ध", body: "{listing} · {qty} किलो. डिलिव्हरी शुल्क ₹{amount}. इतर कोणी घेण्यापूर्वी स्वीकारा." },
  delivery_assigned_you: { title: "तुम्हाला नवीन डिलिव्हरी मिळाली", body: "{listing}, {qty} किलो — पिकअप व ड्रॉप तपशील पाहण्यासाठी उघडा." },
  delivery_partner_assigned: { title: "डिलिव्हरी पार्टनर नेमला", body: "{listing} च्या ऑर्डरसाठी डिलिव्हरी पार्टनर नेमला गेला आहे; तो शेतकऱ्याकडून माल घेईल." },

  payment_paid: { title: "पेमेंट मिळाले", body: "{listing} च्या ऑर्डरचे पेमेंट निश्चित झाले." },
  payment_failed: { title: "पेमेंट अयशस्वी", body: "{listing} च्या ऑर्डरचे पेमेंट झाले नाही. कृपया पुन्हा प्रयत्न करा." },
  payment_refunded: { title: "पेमेंट परत केले", body: "{listing} च्या ऑर्डरचे तुमचे पेमेंट परत केले गेले." },
  payment_cod_collected: { title: "रोख रक्कम जमा", body: "{listing} च्या ऑर्डरची कॅश ऑन डिलिव्हरी रक्कम जमा झाल्याची नोंद झाली." },

  dispute_new: { title: "नवीन तक्रार", body: "{sender} यांनी तक्रार केली: {reason}." },
  dispute_resolved: { title: "तक्रारीचा निकाल", body: "निकाल: {resolution}." },

  listing_new: { title: "तपासणीसाठी नवीन यादी", body: "{sender} यांनी {listing} जोडले." },
  listing_resubmitted: { title: "यादी पुन्हा सादर केली", body: "{sender} यांनी {listing} तपासणीसाठी पुन्हा पाठवले." },
  listing_approved: { title: "यादी मंजूर", body: "{listing} आता खरेदीदारांना दिसत आहे." },
  listing_rejected: { title: "यादी नाकारली", body: "{listing} नाकारले गेले." },
  "listing_rejected.reason": { title: "यादी नाकारली", body: "{listing} नाकारले गेले. कारण: {reason}" },
  listing_changes_requested: { title: "बदल सुचवले", body: "{listing} मध्ये बदल करण्यास सांगितले आहे." },
  "listing_changes_requested.reason": { title: "बदल सुचवले", body: "{listing} मध्ये बदल करण्यास सांगितले आहे. कारण: {reason}" },
  listing_suspended: { title: "यादी निलंबित", body: "{listing} अॅडमिनने निलंबित केले." },
  "listing_suspended.reason": { title: "यादी निलंबित", body: "{listing} अॅडमिनने निलंबित केले. कारण: {reason}" },

  user_new: { title: "नवीन {role} नोंदणी", body: "{sender} यांनी नोंदणी केली." },
  settlement_paid: { title: "पेमेंट पाठवले", body: "तुम्हाला ₹{amount} दिले गेले (UTR {utr})." },
};

const TEMPLATES: Record<Lang, Table> = { en, mr };

// ---- Small label maps used inside sentences ----
const STATUS_LABEL: Record<Lang, Record<string, string>> = {
  en: {
    refund_requested: "refund requested",
    refunded: "refunded",
    replacement_requested: "replacement requested",
    replaced: "replaced",
  },
  mr: {
    refund_requested: "परताव्याची विनंती",
    refunded: "परतावा झाला",
    replacement_requested: "बदलीची विनंती",
    replaced: "बदली झाली",
  },
};

const RESOLUTION_LABEL: Record<Lang, Record<string, string>> = {
  en: {
    no_refund: "no refund",
    partial_refund: "partial refund",
    full_refund: "full refund",
    replacement: "replacement",
    seller_payout_adjustment: "seller payout adjustment",
    other: "other",
  },
  mr: {
    no_refund: "परतावा नाही",
    partial_refund: "अंशतः परतावा",
    full_refund: "पूर्ण परतावा",
    replacement: "बदली",
    seller_payout_adjustment: "विक्रेत्याच्या पेमेंटमध्ये बदल",
    other: "इतर",
  },
};

const ROLE_LABEL: Record<Lang, Record<string, string>> = {
  en: { farmer: "farmer", buyer: "buyer", delivery: "delivery partner" },
  mr: { farmer: "शेतकरी", buyer: "खरेदीदार", delivery: "डिलिव्हरी पार्टनर" },
};

function fill(template: string, values: Record<string, string | number | null | undefined>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? "")).replace(/\s+/g, " ").trim();
}

// Final localized title + body for one notification.
export function renderNotification(n: NotificationItem, lang: Lang): { title: string; body: string } {
  const table = TEMPLATES[lang];
  const p = n.params ?? {};

  let key = n.type;
  if (n.type === "chat_message" && n.event_count > 1) key = "chat_message.many";
  else if (p.reason && table[`${n.type}.reason`]) key = `${n.type}.reason`;

  const tpl = table[key];
  if (!tpl) {
    // Type this build doesn't know yet → show what the database wrote.
    return { title: n.title, body: n.message };
  }

  const values = {
    ...p,
    count: n.event_count,
    status: STATUS_LABEL[lang][String(p.status ?? "")] ?? String(p.status ?? "").replace(/_/g, " "),
    resolution: RESOLUTION_LABEL[lang][String(p.resolution ?? "")] ?? String(p.resolution ?? "").replace(/_/g, " "),
    role: ROLE_LABEL[lang][String(p.role ?? "")] ?? String(p.role ?? ""),
  };
  return { title: fill(tpl.title, values), body: fill(tpl.body, values) };
}

// ---- Screen text ----
const UI = {
  en: {
    title: "Notifications",
    markAll: "Mark all as read",
    empty: "You're all caught up.",
    emptyHint: "New orders, messages and updates will show up here.",
    all: "All",
    unread: "Unread",
    newBadge: "New",
    loading: "Loading…",
    unreadN: (n: number) => `${n} unread`,
    close: "Dismiss",
  },
  mr: {
    title: "सूचना",
    markAll: "सर्व वाचल्या म्हणून चिन्हांकित करा",
    empty: "काहीही नवीन नाही.",
    emptyHint: "नवीन ऑर्डर, संदेश आणि अपडेट्स येथे दिसतील.",
    all: "सर्व",
    unread: "न वाचलेल्या",
    newBadge: "नवीन",
    loading: "लोड होत आहे…",
    unreadN: (n: number) => `${n} न वाचलेल्या`,
    close: "बंद करा",
  },
} as const;

export function uiText(lang: Lang) {
  return UI[lang];
}

export function timeAgo(iso: string, lang: Lang, nowMs: number = Date.now()): string {
  const sec = Math.max(0, Math.round((nowMs - new Date(iso).getTime()) / 1000));
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);
  if (lang === "mr") {
    if (sec < 60) return "आत्ताच";
    if (min < 60) return `${min} मिनिटांपूर्वी`;
    if (hr < 24) return `${hr} तासांपूर्वी`;
    return `${day} दिवसांपूर्वी`;
  }
  if (sec < 60) return "just now";
  if (min < 60) return `${min} min ago`;
  if (hr < 24) return `${hr} hr ago`;
  return `${day} d ago`;
}
