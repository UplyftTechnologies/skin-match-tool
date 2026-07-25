// lib/tracking/events.js
// Central list of every analytics event name used across the app.
// Keep this as the single source of truth — never inline a raw string
// event name in a component, always import from here.

export const EVENTS = {
  // PAGE VIEWS
  PAGE_VIEWED_CHECKOUT: 'page_viewed_checkout',
  PAGE_VIEWED_CHECKOUT_SUCCESS: 'page_viewed_checkout_success',
  PAGE_VIEWED_QUICK_FIX: 'page_viewed_quick_fix',

  PAGE_VIEWED_BUNDLE_DETAILS: 'page_viewed_bundle_details',
  ENROLL_BTN_CLICK: 'enroll_btn_click',
  CLICKED_VALUE_FIT_BTN: 'clicked_value_fit_btn',
  CLICKED_PREMIUM_BTN: 'clicked_premium_btn',
  QUIZ_RETAKE_PROMPT_SHOWN: 'quiz_retake_prompt_shown',
  CLICKED_RETAKE_QUIZ_YES: 'clicked_retake_quiz_yes',
  CLICKED_RETAKE_QUIZ_NO: 'clicked_retake_quiz_no',
  PAGE_VIEWED_BUNDLES: 'page_viewed_bundles',
  PAGE_VIEWED_BEYOND_FACE: 'page_viewed_beyond_face',
  PAGE_VIEWED_PRODUCT_DETAIL: 'page_viewed_product_detail',
  // Generic fallback — kept in case a bundle's concern slug doesn't map to
  // one of the specific events below (new bundle added without updating
  // the map, etc.). Normal clicks should hit the specific events instead.
  CLICKED_QUICK_BUNDLE: 'clicked_quick_bundle',
  CLICKED_QUICK_BUNDLE_ACNE: 'clicked_quick_bundle_acne',
  CLICKED_QUICK_BUNDLE_PIGMENTATION: 'clicked_quick_bundle_pigmentation',
  CLICKED_QUICK_BUNDLE_DULLNESS: 'clicked_quick_bundle_dullness',
  CLICKED_QUICK_BUNDLE_AGING: 'clicked_quick_bundle_aging',
  PAGE_VIEWED_MY_PROGRAMS: 'page_viewed_my_programs',
  CLICKED_SKIN_TYPE_FILTER: 'clicked_skin_type_filter',
  CLICKED_CHANGE_PLAN: 'clicked_change_plan',
  CLICKED_ROUTINE_MODE_TOGGLE: 'clicked_routine_mode_toggle',
  // FIX: fit-type tab selection (Value/Premium) was previously reusing
  // CLICKED_ROUTINE_MODE_TOGGLE (the AM/PM toggle event) — split out so the
  // two distinct button clicks don't collide in analytics.
  CLICKED_FIT_TYPE_TAB: 'clicked_fit_type_tab',
  CLICKED_BUY_BUNDLE: 'clicked_buy_bundle',
  CLICKED_LIFE_EVENT_MOTHERHOOD: 'clicked_life_event_motherhood',
  CLICKED_LIFE_EVENT_SENSITIVE: 'clicked_life_event_sensitive',
  CLICKED_BEYOND_FACE_CARD: 'clicked_beyond_face_card',
  CLICKED_BEYOND_FACE_BODY_ACNE: 'clicked_beyond_face_body_acne',
  CLICKED_BEYOND_FACE_BODY_HYDRATION: 'clicked_beyond_face_body_hydration',
  CLICKED_BEYOND_FACE_BODY_BRIGHTENING: 'clicked_beyond_face_body_brightening',
  CLICKED_BEYOND_FACE_LIP_PIGMENTATION: 'clicked_beyond_face_lip_pigmentation',
  CLICKED_BEYOND_FACE_CHAPPED_LIPS: 'clicked_beyond_face_chapped_lips',
  CLICKED_BEYOND_FACE_EYE_CARE: 'clicked_beyond_face_eye_care',
  PAGE_VIEWED_CONCERNS_RESULTS: 'page_viewed_concerns_results',
  CLICKED_SELECT_ROUTINE: 'clicked_select_routine',
  CLICKED_ROUTINE_CHECKOUT: 'clicked_routine_checkout',
  CLICKED_VIEW_PREVIOUS_ROUTINES: 'clicked_view_previous_routines',
  CLICKED_SHOP_HERE: 'clicked_shop_here',
  CLICKED_CONTINUE_SHOPPING: 'clicked_continue_shopping',
  // FIX: the signup-wall-shown moment was previously tracked by reusing
  // PAGE_VIEWED_BUNDLE_DETAILS with an extra `popup` prop tacked on, which
  // mixed "user viewed the page" and "we showed them the login popup" into
  // one event. Now it's its own event.
  SIGNUP_WALL_SHOWN: 'signup_wall_shown',

  // CLICK EVENTS
  CLICKED_ADD_TO_CART: 'clicked_add_to_cart',
  CLICKED_REMOVE_FROM_CART: 'clicked_remove_from_cart',
  CLICKED_CLEAR_CART: 'clicked_clear_cart',
  CLICKED_UPDATE_QUANTITY: 'clicked_update_quantity',
  CLICKED_APPLY_COUPON: 'clicked_apply_coupon',
  CLICKED_REMOVE_COUPON: 'clicked_remove_coupon',
  CLICKED_PAY_NOW: 'clicked_pay_now',
  CLICKED_LOGIN: 'clicked_login',
  CLICKED_FAVORITE_ITEM: 'clicked_favorite_item',
  CLICKED_REMOVE_FAVORITE: 'clicked_remove_favorite',
  CLICKED_SORT_APPLIED: 'clicked_sort_applied',

  CLICKED_ADDRESS_MODAL_OPEN: 'clicked_address_modal_open',
  CLICKED_ADDRESS_MODAL_CLOSE: 'clicked_address_modal_close',
  CLICKED_SAVE_ADDRESS: 'clicked_save_address',
  CLICKED_REMOVE_ADDRESS: 'clicked_remove_address',
  CLICKED_PAYMENT_METHOD: 'clicked_payment_method',
  CLICKED_WALLET_TOGGLE: 'clicked_wallet_toggle',

  QUIZ_COMPLETED: 'quiz_completed',
  QUIZ_UPDATED: 'quiz_updated',
  QUIZ_STARTED: 'quiz_started',
  PAYMENT_COMPLETED: 'payment_completed',
  ACCOUNT_CREATED: 'login_successful',
  EXISTING_USER_LOGIN: 'existing_user_login',
  ORDER_PLACED: 'order_placed',
  ADDRESS_SAVED: 'address_saved',
  PAYMENT_STARTED: 'payment_started',
  PAYMENT_CANCELLED: 'payment_cancelled',
  FORM_ERROR: 'form_error',
  CLICKED_QUIZ_OPTION: 'clicked_quiz_option',

  CLICKED_LOGO: 'clicked_logo',
  CLICKED_NAV_HOME: 'clicked_nav_home',
  CLICKED_NAV_SHOP: 'clicked_nav_shop',
  CLICKED_NAV_CLUB: 'clicked_nav_club',
  CLICKED_NAV_LIBRARY: 'clicked_nav_library',
  CLICKED_NAV_SKIN_QUIZ: 'clicked_nav_skin_quiz',
  CLICKED_NAV_WISHLIST: 'clicked_nav_wishlist',
  CLICKED_NAV_PROFILE: 'clicked_nav_profile',
  CLICKED_NAV_QUICK_FIX: 'clicked_nav_quick_fix',
  CLICKED_NAV_MY_PROGRAMS: 'clicked_nav_my_programs',
  CLICKED_NAV_ITEM: 'clicked_nav_item',
  CLICKED_NOTIFICATION_BELL: 'clicked_notification_bell',
  CLICKED_OPEN_CART: 'clicked_open_cart',
  CLICKED_WALLET_ICON: 'clicked_wallet_icon',
  CLICKED_MOBILE_MENU: 'clicked_mobile_menu',
  ADDED_TO_WISHLIST: 'added_to_wishlist',
  REMOVED_FROM_WISHLIST: 'removed_from_wishlist',
  PAGE_VIEWED_LOGIN: 'page_viewed_login',

  CLICKED_GOOGLE_SIGNIN: 'clicked_google_signin',
  CLICKED_SEND_OTP: 'clicked_send_otp',
  CLICKED_RESEND_OTP: 'clicked_resend_otp',
  CLICKED_VERIFY_OTP: 'clicked_verify_otp',
  CLICKED_COMPLETE_PROFILE: 'clicked_complete_profile',
  CLICKED_LOGIN_BACK: 'clicked_login_back',

  OTP_VERIFIED: 'otp_verified',

  PAGE_VIEWED_SKIN_MATCH_TOOL: 'page_viewed_skin_match_tool',

  CLICKED_PRODUCT_CARD: 'clicked_product_card',
  CLICKED_FILTER_OPTION: 'clicked_filter_option',
  CLICKED_OPEN_FILTER_PANEL: 'clicked_open_filter_panel',
  CLICKED_APPLY_FILTERS: 'clicked_apply_filters',
  CLICKED_CLEAR_FILTERS: 'clicked_clear_filters',
  CLICKED_SKIN_QUIZ_CTA: 'clicked_skin_quiz_cta',
  SEARCH_PERFORMED: 'search_performed',
  CLICKED_TRENDING_KEYWORD: 'clicked_trending_keyword',
  CLICKED_SEARCH_RESULT_PRODUCT: 'clicked_search_result_product',
  SEARCHBAR_TYPED: 'searchbar_typed',
  SEARCH_NO_RESULTS_FOUND: 'search_no_results_found',
  CLICKED_SEARCHBAR_FOCUS: 'clicked_searchbar_focus',
  CLICKED_START_MYJORNEY: 'clicked_start_my_jorney_btn',
  CLICKED_QUICK_VIEW: 'clicked_quick_view',
  CLICKED_QUICK_VIEW_DETAILS: 'clicked_quick_view_details',
  CLICKED_LOAD_MORE: 'clicked_load_more',
  CLICKED_PROFILE_DROPDOWN_TOGGLE: 'clicked_profile_dropdown_toggle',
  CLICKED_PROFILE_MENU_ITEM: 'clicked_profile_menu_item',
  CLICKED_LOGOUT: 'clicked_logout',

  SHOP_NO_RESULTS_FOUND: 'shop_no_results_found',
};