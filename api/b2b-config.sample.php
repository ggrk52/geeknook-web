<?php
/**
 * GeekNook B2B Leads Notification Configuration Sample
 * Copy this file to `b2b-config.php` and set your Telegram Bot token and Chat ID.
 */

return [
    // Telegram Bot API token from @BotFather
    'telegram_bot_token' => 'YOUR_TELEGRAM_BOT_TOKEN_HERE',

    // Target chat or channel ID (e.g., -1001234567890 or user ID)
    'telegram_chat_id' => 'YOUR_TELEGRAM_CHAT_ID_HERE',

    // Optional notification email address
    'notification_email' => 'b2b@geeknook.ru',

    // Environment: 'production' or 'development'
    'environment' => 'production'
];
