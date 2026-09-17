// Centralized i18n dictionary. Add new UI text here (never scatter inline
// translated strings inside components) so both languages stay in sync.
// IMPORTANT: this only covers interface text — farmer/buyer-entered data
// (product names, descriptions, chat messages) is never auto-translated.

export type Lang = "en" | "mr";

const en = {
  // Navigation
  "nav.dashboard": "Dashboard",
  "nav.listings": "Listings",
  "nav.marketplace": "Market",
  "nav.chats": "Chats",
  "nav.orders": "Orders",
  "nav.profile": "Profile",
  "nav.disputes": "Disputes",
  "nav.farmers": "Farmers",
  "nav.buyers": "Buyers",

  // Common
  "common.logIn": "Log in",
  "common.logOut": "Log out",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.submit": "Submit",
  "common.back": "Back",
  "common.loading": "Loading…",
  "common.somethingWrong": "Something went wrong. Please try again.",

  // Landing page
  "landing.brand": "Kissaan Saathi",
  "landing.heroTitle": "Sell straight to the restaurant down the road.",
  "landing.heroSubtitle":
    "List what you've harvested. Nearby restaurants, hotels and dhabas find it, negotiate a price with you, and place the order — no middleman required, and no obligation to stop selling the way you already do.",
  "landing.joinFarmer": "Join as Farmer",
  "landing.joinBuyer": "Join as Business Buyer",
  "landing.alreadyHaveAccount": "Already have an account?",
  "landing.howItWorks": "How it works",
  "landing.forFarmers": "For farmers",
  "landing.forBuyers": "For business buyers",
  "landing.nothingHidden": "Nothing hidden",

  // Auth
  "auth.welcomeBack": "Welcome back",
  "auth.logInSubtitle": "Log in to Kissaan Saathi.",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.newHere": "New here?",
  "auth.joinFarmerSignup": "Join as a farmer",
  "auth.joinBuyerSignup": "Join as a business buyer",

  // Delivery & payment
  "delivery.kissaanSaathiDelivery": "Kissaan Saathi Delivery",
  "delivery.buyerPickup": "Buyer Pickup",
  "delivery.label": "Delivery",
  "delivery.pickupNote": "You'll collect the produce yourself from the farmer — no delivery charge is added.",
  "payment.method": "Payment method",
  "payment.online": "Online / UPI",
  "payment.cod": "Cash on Delivery",
  "payment.codDisabledForPickup": "Cash on Delivery isn't available for Buyer Pickup — online/UPI payment is required.",
  "payment.payNow": "Pay now",
  "payment.status.pending": "Payment pending",
  "payment.status.processing": "Payment processing",
  "payment.status.paid": "Paid",
  "payment.status.failed": "Payment failed",
  "payment.status.refunded": "Refunded",
  "payment.status.codPending": "Cash on Delivery — pay on delivery",
  "payment.status.codCollected": "Cash on Delivery — collected",

  // Order breakdown
  "order.productAmount": "Product amount",
  "order.buyerFee": "Buyer platform fee",
  "order.deliveryCharge": "Kissaan Saathi Delivery charge",
  "order.totalPayable": "Total payable",
  "order.createOrder": "Create order",

  // Order statuses
  "status.negotiating": "Negotiating",
  "status.agreed": "Agreed",
  "status.order_placed": "Order placed",
  "status.accepted_by_seller": "Accepted by farmer",
  "status.packing": "Packing",
  "status.packed": "Packed",
  "status.out_for_delivery": "Out for delivery",
  "status.delivered": "Delivered",
  "status.completed": "Completed",
  "status.cancelled": "Cancelled",
  "status.disputed": "Disputed",
  "status.refund_requested": "Refund requested",
  "status.refunded": "Refunded",
  "status.replacement_requested": "Replacement requested",
  "status.replaced": "Replaced",

  // Empty states
  "empty.noListings": "You haven't listed any produce yet.",
  "empty.noOrders": "No orders yet.",
  "empty.noConversations": "No conversations yet.",
} as const;

const mr: Record<keyof typeof en, string> = {
  "nav.dashboard": "डॅशबोर्ड",
  "nav.listings": "यादी",
  "nav.marketplace": "बाजार",
  "nav.chats": "संवाद",
  "nav.orders": "ऑर्डर",
  "nav.profile": "प्रोफाइल",
  "nav.disputes": "तक्रारी",
  "nav.farmers": "शेतकरी",
  "nav.buyers": "खरेदीदार",

  "common.logIn": "लॉग इन करा",
  "common.logOut": "लॉग आउट करा",
  "common.cancel": "रद्द करा",
  "common.save": "जतन करा",
  "common.submit": "सबमिट करा",
  "common.back": "मागे",
  "common.loading": "लोड होत आहे…",
  "common.somethingWrong": "काहीतरी चुकले. कृपया पुन्हा प्रयत्न करा.",

  "landing.brand": "किसान साथी",
  "landing.heroTitle": "जवळच्या हॉटेलला थेट विका.",
  "landing.heroSubtitle":
    "तुम्ही काढलेला माल नोंदवा. जवळचे रेस्टॉरंट, हॉटेल आणि ढाबे तो शोधतील, तुमच्याशी किंमत ठरवतील आणि ऑर्डर देतील — कोणत्याही मध्यस्थाशिवाय, आणि तुमच्या नेहमीच्या विक्री पद्धती बंद करण्याची गरज नाही.",
  "landing.joinFarmer": "शेतकरी म्हणून सामील व्हा",
  "landing.joinBuyer": "व्यावसायिक खरेदीदार म्हणून सामील व्हा",
  "landing.alreadyHaveAccount": "आधीपासून खाते आहे?",
  "landing.howItWorks": "हे कसे काम करते",
  "landing.forFarmers": "शेतकऱ्यांसाठी",
  "landing.forBuyers": "व्यावसायिक खरेदीदारांसाठी",
  "landing.nothingHidden": "काहीही लपवलेले नाही",

  "auth.welcomeBack": "पुन्हा स्वागत आहे",
  "auth.logInSubtitle": "किसान साथी मध्ये लॉग इन करा.",
  "auth.email": "ईमेल",
  "auth.password": "पासवर्ड",
  "auth.newHere": "नवीन आहात?",
  "auth.joinFarmerSignup": "शेतकरी म्हणून नोंदणी करा",
  "auth.joinBuyerSignup": "व्यावसायिक खरेदीदार म्हणून नोंदणी करा",

  "delivery.kissaanSaathiDelivery": "किसान साथी डिलिव्हरी",
  "delivery.buyerPickup": "खरेदीदार स्वतः घेऊन जाईल",
  "delivery.label": "डिलिव्हरी",
  "delivery.pickupNote": "तुम्ही स्वतः शेतकऱ्याकडून माल घेऊन जाल — डिलिव्हरी शुल्क लागणार नाही.",
  "payment.method": "पेमेंट पद्धत",
  "payment.online": "ऑनलाइन / यूपीआय",
  "payment.cod": "डिलिव्हरीच्या वेळी रोख",
  "payment.codDisabledForPickup": "स्वतः घेऊन जाण्यासाठी रोख पर्याय उपलब्ध नाही — ऑनलाइन/यूपीआय पेमेंट आवश्यक आहे.",
  "payment.payNow": "आता पैसे भरा",
  "payment.status.pending": "पेमेंट प्रलंबित",
  "payment.status.processing": "पेमेंट प्रक्रियेत",
  "payment.status.paid": "पैसे भरले",
  "payment.status.failed": "पेमेंट अयशस्वी",
  "payment.status.refunded": "परतावा दिला",
  "payment.status.codPending": "डिलिव्हरीच्या वेळी रोख — डिलिव्हरीच्या वेळी द्या",
  "payment.status.codCollected": "डिलिव्हरीच्या वेळी रोख — जमा झाले",

  "order.productAmount": "उत्पादनाची रक्कम",
  "order.buyerFee": "खरेदीदार प्लॅटफॉर्म शुल्क",
  "order.deliveryCharge": "किसान साथी डिलिव्हरी शुल्क",
  "order.totalPayable": "एकूण देय रक्कम",
  "order.createOrder": "ऑर्डर तयार करा",

  "status.negotiating": "वाटाघाटी सुरू",
  "status.agreed": "मान्य झाले",
  "status.order_placed": "ऑर्डर दिली",
  "status.accepted_by_seller": "शेतकऱ्याने स्वीकारले",
  "status.packing": "पॅकिंग सुरू आहे",
  "status.packed": "पॅक झाले",
  "status.out_for_delivery": "डिलिव्हरीसाठी निघाले",
  "status.delivered": "डिलिव्हर झाले",
  "status.completed": "पूर्ण झाले",
  "status.cancelled": "रद्द केले",
  "status.disputed": "तक्रार नोंदवली",
  "status.refund_requested": "परतावा विनंती केली",
  "status.refunded": "परतावा दिला",
  "status.replacement_requested": "बदली विनंती केली",
  "status.replaced": "बदलले",

  "empty.noListings": "तुम्ही अजून कोणताही माल नोंदवलेला नाही.",
  "empty.noOrders": "अजून कोणतीही ऑर्डर नाही.",
  "empty.noConversations": "अजून कोणताही संवाद नाही.",
};

export const dictionary = { en, mr } as const;
export type TranslationKey = keyof typeof en;

export function translate(lang: Lang, key: TranslationKey): string {
  return dictionary[lang][key] ?? dictionary.en[key] ?? key;
}
