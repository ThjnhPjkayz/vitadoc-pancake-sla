// ============================================================
// Pancake API Type Definitions
// Generated from api.md
// ============================================================

// ----- GET /api/v1/pages -----

export interface PancakePageUser {
  fb_id: string;
  name: string;
  page_id: string;
  phone_number: string | null;
  status: "active" | "removed";
  user_id: string;
}

export interface PancakePageSettings {
  auto_like?: boolean;
  show_assigned?: boolean;
  current_settings_key?: string;
  auto_create_order?: boolean;
  multi_tag?: boolean;
  notification?: boolean;
  unread_first?: boolean;
  enable_bulk_image_send?: boolean;
  // ...còn rất nhiều settings khác
  [key: string]: unknown;
}

export interface PancakePage {
  id: string; // page_id
  name: string;
  username: string;
  platform: "tiktok" | "facebook" | "personal_zalo" | "tiktok_business_messaging";
  avatar_url: string | null;
  business: string | null;
  connected: boolean;
  country: string | null;
  custom_page_color: string | null;
  inserted_at: string;
  is_activated: boolean;
  is_silhouette: boolean;
  last_global_id_crawl: string | null;
  need_fix_webhook: string | null;
  page_content_sync_group_id: string | null;
  permissions: { is_enabled_permissions: boolean };
  platform_extra_info: Record<string, unknown>;
  quick_reply_sync_group_id: string | null;
  role_in_page: "ADMINISTER" | string;
  settings: PancakePageSettings;
  shop_id: number;
  special_feature: boolean;
  tag_sync_group_id: string | null;
  timezone: number;
  users: PancakePageUser[];
  active_user_ids?: string[];
}

export interface PancakePagesResponse {
  success: boolean;
  categorized: {
    activated: PancakePage[];
    activated_page_ids: string[];
    hidden: PancakePage[];
    inactivated: PancakePage[];
    nopermission: PancakePage[];
  };
}

// ----- POST Generate Page Token -----

export interface PancakePageTokenResponse {
  success: boolean;
  message: string;
  page_access_token: string;
}

// ----- GET Conversations -----

export interface PancakeConversationCustomer {
  fb_id: string;
  id: string;
  is_contact: boolean | null;
  name: string;
  username: string;
}

export interface PancakeConversationFrom {
  id: string;
  name: string;
  tt_unique_id?: string;
  username: string;
}

export interface PancakeConversationLastSentBy {
  id: string;
  name: string | null;
  username?: string;
  admin_name?: string;
  uid?: string | null;
}

export interface PancakeConversationPhoneNumber {
  captured: string;
  length: number;
  m_id: string;
  offset: number;
  phone_number: string;
  status: number;
}

export interface PancakeConversation {
  id: string; // conversation_id
  type: "INBOX" | "COMMENT";
  tags: (string | null)[];
  seen: boolean;
  from: PancakeConversationFrom;
  snippet: string;
  inserted_at: string;
  updated_at: string;
  message_count: number;
  page_id: string;
  assignee_ids: string[];
  assignee_group_id: string | null;
  customers: PancakeConversationCustomer[];
  has_phone: boolean;
  last_sent_by: PancakeConversationLastSentBy;
  post_id: string | null;
  recent_phone_numbers: PancakeConversationPhoneNumber[];
  customer_id: string;
  page_customer: {
    id: string;
    name: string;
    inserted_at: string;
    customer_id: string;
    gender: string | null;
    global_id: string | null;
    psid: string;
    birthday: string | null;
    notes: string | null;
    recent_orders: unknown | null;
  };
  ads?: unknown[];
  ad_ids?: string[];
  assignee_histories?: unknown[];
  current_assign_users?: unknown[];
  tag_histories?: unknown[];
}

export interface PancakeConversationsResponse {
  success: boolean;
  conversations: PancakeConversation[];
}

// ----- GET Messages -----

export interface PancakeMessageFrom {
  id: string;
  name: string;
  username: string;
}

export interface PancakeMessage {
  id: string;
  message: string;
  type: "COMMENT" | "INBOX" | "PRIVATE_REPLY";
  seen: boolean;
  show_info: boolean;
  from: PancakeMessageFrom;
  inserted_at: string;
  page_id: string;
  conversation_id: string;
  attachments: unknown[];
  has_phone: boolean;
  is_removed: boolean;
  can_hide: boolean;
  comment_count: number | null;
  like_count: number | null;
  rich_message: unknown | null;
  edit_history: unknown | null;
  parent_id: string | null;
  is_hidden: boolean;
  message_tags: unknown[];
  can_comment: boolean;
  can_like: boolean;
  can_remove: boolean;
  can_reply_privately: boolean;
  is_livestream_order: boolean | null;
  is_parent: boolean;
  is_parent_hidden: boolean;
  phone_info: unknown[];
  private_reply_conversation: unknown | null;
  removed_by: string | null;
  user_likes: boolean;
  original_message: string;
}

export interface PancakeMessagesResponse {
  success: boolean;
  is_banned: boolean;
  global_id: string | null;
  birthday: string | null;
  messages: PancakeMessage[];
  conv_from: PancakeConversationFrom;
  conversation_id: string;
  customers: PancakeConversationCustomer[];
  conv_customers: PancakeConversationCustomer[];
  post: {
    id: string;
    message: string;
    type: string | null;
    link: string | null;
    from: { id: string; name: string };
    inserted_at: string;
    status_type: string | null;
    attachments: {
      data: {
        description: string;
        media: { image: { height: number; width: number } };
        target: { id: string; thumbnail: string; url: string };
        title: string | null;
        type: string;
      }[];
      ids: string[];
    };
    product_id: string | null;
    admin_creator: string | null;
    comments_mirroring_domain: string | null;
    is_mention: boolean;
    is_visitor_post: boolean;
    live_video_status: string | null;
    message_tags: unknown[];
    privacy: string | null;
    rating_point: string | null;
    recommendation_type: string | null;
    story: string | null;
    story_tags: unknown[];
  } | null;
  read_watermarks: unknown | null;
  suggested_posts: unknown | null;
  suggested_products: unknown | null;
  [key: string]: unknown;
}
