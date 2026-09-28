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
  "nav.settlements": "Payouts",

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

  // Farmer pickup location
  "pickup.title": "Pickup Location",
  "pickup.subtitle": "Used only for orders where the buyer chooses Buyer Pickup.",
  "pickup.useMyLocation": "Use My Current Location",
  "pickup.detecting": "Detecting your location…",
  "pickup.detectedLabel": "Detected location",
  "pickup.latitude": "Latitude",
  "pickup.longitude": "Longitude",
  "pickup.noCoordinates": "No GPS coordinates set yet.",
  "pickup.address": "Pickup Address",
  "pickup.addressPlaceholder": "House/shop no., street, village or town",
  "pickup.landmark": "Landmark",
  "pickup.landmarkPlaceholder": "e.g. Near Shiv Mandir",
  "pickup.instructions": "Pickup Instructions",
  "pickup.instructionsPlaceholder": "e.g. Call before arriving, gate on the left",
  "pickup.confirm": "Confirm Pickup Location",
  "pickup.confirmed": "Pickup location confirmed",
  "pickup.notConfirmed": "Not confirmed yet — buyers can't use this until you confirm.",
  "pickup.unavailable": "Location unavailable",
  "pickup.unavailableHelp": "Couldn't detect your location right now. You can still enter the address manually below.",
  "pickup.permissionDenied": "Location permission denied",
  "pickup.permissionDeniedHelp": "You can still enter the pickup address manually below. GPS coordinates won't be available for this listing.",
  "pickup.addressRequired": "Please enter a pickup address before confirming.",
  "pickup.saving": "Saving…",
  "pickup.saved": "Saved.",
  "pickup.availableAfterPayment": "Pickup location will be available after successful payment.",
  "pickup.getDirections": "Get Directions",
  "pickup.manageLink": "Pickup location",
  "pickup.noneSetYet": "You haven't set a pickup location for this listing yet — buyers choosing Buyer Pickup will need it.",

  // Dispute / complaint
  "dispute.reportProblem": "Report a problem",
  "dispute.reasonLabel": "Reason",
  "dispute.reasonWrongProduct": "Wrong product",
  "dispute.reasonWrongQuantity": "Wrong quantity",
  "dispute.reasonQualityMismatch": "Significant quality mismatch",
  "dispute.reasonDamaged": "Damaged produce",
  "dispute.reasonDeliveryIssue": "Delivery-related issue",
  "dispute.reasonOther": "Other",
  "dispute.describeLabel": "Describe what happened",
  "dispute.describeRequired": "Please describe what went wrong.",
  "dispute.takePhoto": "Take photo",
  "dispute.chooseFromGallery": "Choose from gallery",
  "dispute.photosAttached": "photo(s) attached",
  "dispute.submit": "Submit dispute",
  "dispute.submitting": "Submitting…",
  "dispute.submitFailed": "Could not submit dispute",
  "dispute.statusUpdateFailed": "Dispute recorded, but order status couldn't be updated",
  "dispute.windowClosedTitle": "Complaint window closed",
  "dispute.windowClosedBody": "Complaints can only be reported within 6 hours of delivery. This order was delivered more than 6 hours ago.",
  "dispute.windowRemaining": "Time left to report a problem",

  // OTP
  "otp.pickupTitle": "Pickup OTP",
  "otp.pickupHelp": "Give this code to the delivery partner when they arrive to collect the order.",
  "otp.deliveryTitle": "Delivery OTP",
  "otp.deliveryHelp": "Give this code to the delivery partner when your order arrives.",
  "otp.verified": "Verified ✓",
  "otp.expired": "This code has expired.",
  "otp.enterPickupTitle": "Enter pickup OTP from the farmer",
  "otp.enterDeliveryTitle": "Enter delivery OTP from the buyer",
  "otp.codePlaceholder": "6-digit code",
  "otp.confirmPickup": "Confirm pickup",
  "otp.confirmDelivery": "Confirm delivery",
  "otp.confirming": "Verifying…",

  // Delivery partner online status / auto-assignment
  "delivery.onlineStatus": "Availability",
  "delivery.onlineHelp": "You're online — nearby ready orders can be auto-assigned to you.",
  "delivery.offlineHelp": "You're offline — go online to receive automatic delivery assignments.",
  "delivery.goOnline": "Go online",
  "delivery.goOffline": "Go offline",
  "delivery.locationDenied": "Location permission is required to go online for deliveries.",
  "delivery.locationUnavailable": "Couldn't get your location — try again in a moment.",
  "delivery.readyForPickup": "Ready for Pickup (find delivery partner)",
  "delivery.findingPartner": "Finding a delivery partner…",
  "delivery.assignmentFailed": "Marked ready, but couldn't search for a delivery partner",

  // Withdrawal
  "withdraw.button": "Withdraw",
  "withdraw.minNotMet": "Minimum withdrawal is ₹{min} — your eligible balance is ₹{amount}.",

  // Push notifications
  "push.promptText": "Get notified instantly about orders, messages and deliveries.",
  "push.enable": "Enable",
  "push.notNow": "Not now",

  // COD collection (delivery partner)
  "cod.collectPrompt": "Cash on Delivery — collect payment from the buyer.",
  "cod.collectButton": "Mark cash collected",
  "cod.collectFailed": "Couldn't record cash collection",

  // Farmer earnings page
  "earnings.title": "Earnings",
  "earnings.subtitle": "Withdraw manually once your eligible balance reaches ₹500 (paid within 3 days), or it's automatically settled with a 2% bonus after 16 days.",
  "earnings.autoSettledTitle": "Auto-settled — awaiting payment",
  "earnings.withdrawalInProgress": "Withdrawal in progress",
  "earnings.includesBonus": "Includes ₹{bonus} auto-settlement bonus (2%)",
  "earnings.adminWillPayBy": "Admin will pay by {date}",
  "earnings.eligibleBalance": "Eligible balance",
  "earnings.fromOrdersNotWithdrawn": "From {count} completed order(s) not yet withdrawn.",
  "earnings.feeExplainer": "This is your product amount minus the 5% seller platform fee — delivery charges aren't part of your payout.",
  "earnings.awaitingCodNote": "₹{amount} more from {count} Cash-on-Delivery order(s) will be added here once the delivery partner's cash collection is confirmed by Admin.",
  "earnings.settlementHistory": "Settlement history",
  "earnings.noSettlements": "No settlements yet.",
  "earnings.paidOn": "Paid on {date}",
  "earnings.utr": "UTR",
  "earnings.grossFeeNet": "Gross ₹{gross} − Fee ₹{fee} = Net ₹{net}",
  "earnings.backToProfile": "← Back to profile",

  // Delivery earnings page
  "deliveryEarnings.title": "Earnings",
  "deliveryEarnings.subtitle": "Paid out weekly, every Sunday, directly to your UPI ID.",
  "deliveryEarnings.pendingTitle": "Pending settlement balance",
  "deliveryEarnings.pendingNote": "From {count} delivered order(s) not yet paid out.",
  "deliveryEarnings.cashInHandTitle": "COD cash in hand",
  "deliveryEarnings.cashInHandNote": "Collected from buyers, not yet deposited with Admin. Deposit it in person, then record it here.",
  "deliveryEarnings.depositButton": "I've deposited this with Admin",
  "deliveryEarnings.depositRecording": "Recording…",
  "deliveryEarnings.depositsTitle": "Cash deposits",
  "deliveryEarnings.requestedOn": "Requested {date}",
  "deliveryEarnings.confirmedOn": "Confirmed {date}",
  "deliveryEarnings.settlementHistory": "Settlement history",
  "deliveryEarnings.noSettlements": "No settlements yet.",
  "deliveryEarnings.netAmount": "Net ₹{net}",
  "deliveryEarnings.backToProfile": "← Back to profile",

  // Email notification toggle (shared across profile pages)
  "emailToggle.label": "Email notifications",

  // Order detail pages — common
  "common.orderNotFound": "Order not found.",
  "common.sellerPlatformFee": "Seller platform fee",
  "common.youReceive": "You receive",
  "common.totalPayable": "Total payable",

  // Farmer order detail page
  "farmerOrder.deliveryHandledByPlatform": "Kissaan Saathi Delivery handles this order's delivery.",
  "farmerOrder.payoutBreakdown": "Your payout breakdown",
  "farmerOrder.packingEvidence": "Packing evidence",

  // Buyer order detail page
  "buyerOrder.orderBreakdown": "Order breakdown",
  "buyerOrder.farmerAcceptedMsg": "Farmer has accepted your order and will begin packing shortly.",

  // Delivery dashboard
  "delivery.pickupFrom": "Pickup from",
  "delivery.deliverTo": "Deliver to",
  "delivery.dashboardTitle": "Dashboard",
  "delivery.noAcceptedYet": "You haven't accepted a delivery yet.",
  "delivery.noOrdersAvailable": "No orders waiting for pickup right now.",
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
  "nav.settlements": "पेमेंट",

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

  "pickup.title": "पिकअप स्थान",
  "pickup.subtitle": "फक्त खरेदीदाराने \"स्वतः घेऊन जाईल\" निवडलेल्या ऑर्डरसाठी वापरले जाते.",
  "pickup.useMyLocation": "माझे सध्याचे स्थान वापरा",
  "pickup.detecting": "तुमचे स्थान शोधत आहे…",
  "pickup.detectedLabel": "शोधलेले स्थान",
  "pickup.latitude": "अक्षांश",
  "pickup.longitude": "रेखांश",
  "pickup.noCoordinates": "अद्याप GPS स्थान सेट केलेले नाही.",
  "pickup.address": "पिकअप पत्ता",
  "pickup.addressPlaceholder": "घर/दुकान क्र., रस्ता, गाव किंवा शहर",
  "pickup.landmark": "खूण (लँडमार्क)",
  "pickup.landmarkPlaceholder": "उदा. शिव मंदिराजवळ",
  "pickup.instructions": "पिकअप सूचना",
  "pickup.instructionsPlaceholder": "उदा. येण्यापूर्वी फोन करा, डावीकडील गेट",
  "pickup.confirm": "पिकअप स्थान निश्चित करा",
  "pickup.confirmed": "पिकअप स्थान निश्चित केले आहे",
  "pickup.notConfirmed": "अद्याप निश्चित केलेले नाही — निश्चित करेपर्यंत खरेदीदार हे वापरू शकणार नाहीत.",
  "pickup.unavailable": "स्थान उपलब्ध नाही",
  "pickup.unavailableHelp": "सध्या तुमचे स्थान शोधता आले नाही. तुम्ही खाली पत्ता स्वतः टाकू शकता.",
  "pickup.permissionDenied": "स्थान परवानगी नाकारली",
  "pickup.permissionDeniedHelp": "तुम्ही खाली पिकअप पत्ता स्वतः टाकू शकता. या यादीसाठी GPS स्थान उपलब्ध होणार नाही.",
  "pickup.addressRequired": "कृपया निश्चित करण्यापूर्वी पिकअप पत्ता टाका.",
  "pickup.saving": "जतन करत आहे…",
  "pickup.saved": "जतन झाले.",
  "pickup.availableAfterPayment": "पेमेंट यशस्वी झाल्यानंतर पिकअप स्थान उपलब्ध होईल.",
  "pickup.getDirections": "दिशादर्शन मिळवा",
  "pickup.manageLink": "पिकअप स्थान",
  "pickup.noneSetYet": "तुम्ही अजून या यादीसाठी पिकअप स्थान सेट केलेले नाही — \"स्वतः घेऊन जाईल\" निवडणाऱ्या खरेदीदारांना ते लागेल.",

  // Dispute / complaint
  "dispute.reportProblem": "समस्या नोंदवा",
  "dispute.reasonLabel": "कारण",
  "dispute.reasonWrongProduct": "चुकीचे उत्पादन",
  "dispute.reasonWrongQuantity": "चुकीचे प्रमाण",
  "dispute.reasonQualityMismatch": "गुणवत्तेत मोठा फरक",
  "dispute.reasonDamaged": "शेतमाल खराब/खराब झालेला",
  "dispute.reasonDeliveryIssue": "डिलिव्हरीशी संबंधित समस्या",
  "dispute.reasonOther": "इतर",
  "dispute.describeLabel": "काय झाले ते सांगा",
  "dispute.describeRequired": "कृपया काय चूक झाली ते सांगा.",
  "dispute.takePhoto": "फोटो काढा",
  "dispute.chooseFromGallery": "गॅलरीतून निवडा",
  "dispute.photosAttached": "फोटो जोडले",
  "dispute.submit": "तक्रार सबमिट करा",
  "dispute.submitting": "सबमिट करत आहे…",
  "dispute.submitFailed": "तक्रार सबमिट करता आली नाही",
  "dispute.statusUpdateFailed": "तक्रार नोंदवली गेली, पण ऑर्डरची स्थिती अपडेट करता आली नाही",
  "dispute.windowClosedTitle": "तक्रारीसाठीचा कालावधी संपला",
  "dispute.windowClosedBody": "डिलिव्हरीनंतर फक्त 6 तासांच्या आत तक्रार नोंदवता येते. या ऑर्डरची डिलिव्हरी 6 तासांपूर्वी झाली आहे.",
  "dispute.windowRemaining": "तक्रार नोंदवण्यासाठी उरलेला वेळ",

  // OTP
  "otp.pickupTitle": "पिकअप ओटीपी",
  "otp.pickupHelp": "डिलिव्हरी पार्टनर तुमच्याकडून ऑर्डर घेण्यासाठी आल्यावर हा कोड द्या.",
  "otp.deliveryTitle": "डिलिव्हरी ओटीपी",
  "otp.deliveryHelp": "डिलिव्हरी पार्टनर ऑर्डर घेऊन आल्यावर हा कोड द्या.",
  "otp.verified": "पडताळणी झाली ✓",
  "otp.expired": "हा कोड कालबाह्य झाला आहे.",
  "otp.enterPickupTitle": "शेतकऱ्याकडून पिकअप ओटीपी टाका",
  "otp.enterDeliveryTitle": "खरेदीदाराकडून डिलिव्हरी ओटीपी टाका",
  "otp.codePlaceholder": "6-अंकी कोड",
  "otp.confirmPickup": "पिकअप निश्चित करा",
  "otp.confirmDelivery": "डिलिव्हरी निश्चित करा",
  "otp.confirming": "पडताळत आहे…",

  // Delivery partner online status / auto-assignment
  "delivery.onlineStatus": "उपलब्धता",
  "delivery.onlineHelp": "तुम्ही ऑनलाइन आहात — जवळच्या तयार ऑर्डर आपोआप तुम्हाला दिल्या जाऊ शकतात.",
  "delivery.offlineHelp": "तुम्ही ऑफलाइन आहात — आपोआप डिलिव्हरी मिळवण्यासाठी ऑनलाइन व्हा.",
  "delivery.goOnline": "ऑनलाइन व्हा",
  "delivery.goOffline": "ऑफलाइन व्हा",
  "delivery.locationDenied": "डिलिव्हरीसाठी ऑनलाइन होण्यासाठी स्थान परवानगी आवश्यक आहे.",
  "delivery.locationUnavailable": "तुमचे स्थान मिळाले नाही — थोड्या वेळाने पुन्हा प्रयत्न करा.",
  "delivery.readyForPickup": "पिकअपसाठी तयार (डिलिव्हरी पार्टनर शोधा)",
  "delivery.findingPartner": "डिलिव्हरी पार्टनर शोधत आहे…",
  "delivery.assignmentFailed": "तयार म्हणून चिन्हांकित केले, पण डिलिव्हरी पार्टनर शोधता आला नाही",

  // Withdrawal
  "withdraw.button": "पैसे काढा",
  "withdraw.minNotMet": "किमान रक्कम ₹{min} आहे — तुमची पात्र शिल्लक ₹{amount} आहे.",

  // Push notifications
  "push.promptText": "ऑर्डर, मेसेज आणि डिलिव्हरीबद्दल लगेच सूचना मिळवा.",
  "push.enable": "सुरू करा",
  "push.notNow": "आत्ता नको",

  // COD collection (delivery partner)
  "cod.collectPrompt": "कॅश ऑन डिलिव्हरी — खरेदीदाराकडून पैसे घ्या.",
  "cod.collectButton": "रोख रक्कम मिळाली म्हणून नोंदवा",
  "cod.collectFailed": "रोख रक्कम नोंदवता आली नाही",

  // Farmer earnings page
  "earnings.title": "कमाई",
  "earnings.subtitle": "पात्र शिल्लक ₹500 झाल्यावर स्वतः पैसे काढा (3 दिवसांत मिळतील), किंवा 16 दिवसांनंतर 2% बोनससह आपोआप सेटल होईल.",
  "earnings.autoSettledTitle": "आपोआप सेटल झाले — पेमेंटची वाट पाहत आहे",
  "earnings.withdrawalInProgress": "पैसे काढण्याची प्रक्रिया सुरू आहे",
  "earnings.includesBonus": "₹{bonus} ऑटो-सेटलमेंट बोनस (2%) समाविष्ट आहे",
  "earnings.adminWillPayBy": "अॅडमिन {date} पर्यंत पैसे देईल",
  "earnings.eligibleBalance": "पात्र शिल्लक",
  "earnings.fromOrdersNotWithdrawn": "{count} पूर्ण झालेल्या ऑर्डरमधून, अजून काढलेले नाही.",
  "earnings.feeExplainer": "ही तुमची उत्पादनाची रक्कम आहे, 5% विक्रेता प्लॅटफॉर्म फी वजा करून — डिलिव्हरी शुल्क तुमच्या पेआउटचा भाग नाही.",
  "earnings.awaitingCodNote": "{count} कॅश-ऑन-डिलिव्हरी ऑर्डरमधून आणखी ₹{amount} — डिलिव्हरी पार्टनरची रोख रक्कम अॅडमिनकडून कन्फर्म झाल्यावर इथे जोडले जातील.",
  "earnings.settlementHistory": "सेटलमेंट इतिहास",
  "earnings.noSettlements": "अजून कोणतीही सेटलमेंट नाही.",
  "earnings.paidOn": "{date} रोजी पैसे दिले",
  "earnings.utr": "UTR",
  "earnings.grossFeeNet": "एकूण ₹{gross} − फी ₹{fee} = निव्वळ ₹{net}",
  "earnings.backToProfile": "← प्रोफाइलवर परत जा",

  // Delivery earnings page
  "deliveryEarnings.title": "कमाई",
  "deliveryEarnings.subtitle": "दर रविवारी, थेट तुमच्या UPI ID वर पैसे दिले जातात.",
  "deliveryEarnings.pendingTitle": "प्रलंबित सेटलमेंट शिल्लक",
  "deliveryEarnings.pendingNote": "{count} डिलिव्हर झालेल्या ऑर्डरमधून, अजून पैसे मिळालेले नाहीत.",
  "deliveryEarnings.cashInHandTitle": "हातात असलेली COD रोख रक्कम",
  "deliveryEarnings.cashInHandNote": "खरेदीदारांकडून घेतली, पण अजून अॅडमिनकडे जमा केलेली नाही. प्रत्यक्ष भेटून जमा करा, मग इथे नोंदवा.",
  "deliveryEarnings.depositButton": "मी हे अॅडमिनकडे जमा केले आहे",
  "deliveryEarnings.depositRecording": "नोंदवत आहे…",
  "deliveryEarnings.depositsTitle": "रोख जमा",
  "deliveryEarnings.requestedOn": "{date} रोजी विनंती केली",
  "deliveryEarnings.confirmedOn": "{date} रोजी कन्फर्म केले",
  "deliveryEarnings.settlementHistory": "सेटलमेंट इतिहास",
  "deliveryEarnings.noSettlements": "अजून कोणतीही सेटलमेंट नाही.",
  "deliveryEarnings.netAmount": "निव्वळ ₹{net}",
  "deliveryEarnings.backToProfile": "← प्रोफाइलवर परत जा",

  // Email notification toggle (shared across profile pages)
  "emailToggle.label": "ईमेल सूचना",

  // Order detail pages — common
  "common.orderNotFound": "ऑर्डर सापडली नाही.",
  "common.sellerPlatformFee": "विक्रेता प्लॅटफॉर्म फी",
  "common.youReceive": "तुम्हाला मिळतील",
  "common.totalPayable": "एकूण देय रक्कम",

  // Farmer order detail page
  "farmerOrder.deliveryHandledByPlatform": "या ऑर्डरची डिलिव्हरी Kissaan Saathi Delivery करते.",
  "farmerOrder.payoutBreakdown": "तुमचा पेआउट तपशील",
  "farmerOrder.packingEvidence": "पॅकिंगचा पुरावा",

  // Buyer order detail page
  "buyerOrder.orderBreakdown": "ऑर्डर तपशील",
  "buyerOrder.farmerAcceptedMsg": "शेतकऱ्याने तुमची ऑर्डर स्वीकारली आहे आणि लवकरच पॅकिंग सुरू करेल.",

  // Delivery dashboard
  "delivery.pickupFrom": "इथून पिकअप",
  "delivery.deliverTo": "इथे डिलिव्हर करा",
  "delivery.dashboardTitle": "डॅशबोर्ड",
  "delivery.noAcceptedYet": "तुम्ही अजून कोणतीही डिलिव्हरी स्वीकारलेली नाही.",
  "delivery.noOrdersAvailable": "सध्या पिकअपसाठी कोणतीही ऑर्डर नाही.",
};

export const dictionary = { en, mr } as const;
export type TranslationKey = keyof typeof en;

export function translate(lang: Lang, key: TranslationKey): string {
  return dictionary[lang][key] ?? dictionary.en[key] ?? key;
}