// @ts-nocheck
/**
 * Send Morning Notifications - Supabase Edge Function
 *
 * This function runs on a daily schedule (via pg_cron at 7:00 AM Jakarta time)
 * to check maintenance schedules and create notifications for upcoming,
 * due, and overdue maintenance tasks.
 *
 * It also sends web push notifications to users who have subscribed
 * via the push_subscriptions table.
 *
 * Environment Variables Required:
 * - SUPABASE_URL: Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key (bypasses RLS)
 * - VAPID_PUBLIC_KEY: VAPID public key for web push (optional)
 * - VAPID_PRIVATE_KEY: VAPID private key for web push (optional)
 *
 * Cron Schedule (set in Supabase SQL Editor):
 *   SELECT cron.schedule(
 *     'send-morning-notifications',
 *     '0 7 * * *',
 *     $
 *     SELECT net.http_post(
 *       url := 'https://<project-ref>.supabase.co/functions/v1/send-morning-notifications',
 *       headers := '{"Authorization": "Bearer <service_role_key>", "Content-Type": "application/json"}'::jsonb,
 *       body := '{}'::jsonb
 *     );
 *     $
 *   );
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================================
// Constants
// ============================================================

/** Notification types - must match notification-helpers.js */
const NOTIFICATION_TYPES = {
  REMINDER_7_DAYS: 'REMINDER_7_DAYS',
  REMINDER_3_DAYS: 'REMINDER_3_DAYS',
  REMINDER_1_DAY: 'REMINDER_1_DAY',
  DUE_TODAY: 'DUE_TODAY',
  OVERDUE: 'OVERDUE',
} as const

/** Roles eligible to receive maintenance notifications */
const ELIGIBLE_ROLES = ['super_admin', 'hrd', 'direksi']

/** Days before maintenance when reminders should be triggered */
const REMINDER_DAYS = [7, 3, 1] as const

// ============================================================
// Helper Functions
// ============================================================

/**
 * Calculate the difference in days between two dates.
 * @param date1 - The target date (YYYY-MM-DD or Date)
 * @param date2 - The reference date (YYYY-MM-DD or Date)
 * @returns Number of days difference (positive if date1 > date2)
 */
function getDayDiff(date1: string | Date, date2: string | Date): number {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  d1.setHours(0, 0, 0, 0)
  d2.setHours(0, 0, 0, 0)
  return Math.ceil((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Get today's date in YYYY-MM-DD format (Jakarta time).
 * @returns Today's date string
 */
function getTodayDate(): string {
  const today = new Date()
  // Adjust to Jakarta time (UTC+7)
  const jakartaTime = new Date(today.getTime() + 7 * 60 * 60 * 1000)
  const day = String(jakartaTime.getUTCDate()).padStart(2, '0')
  const month = String(jakartaTime.getUTCMonth() + 1).padStart(2, '0')
  const year = jakartaTime.getUTCFullYear()
  return `${year}-${month}-${day}`
}

/**
 * Build the notification title based on the notification type.
 * @param type - The notification type
 * @returns The title string
 */
function buildNotificationTitle(type: string): string {
  switch (type) {
    case NOTIFICATION_TYPES.REMINDER_7_DAYS:
    case NOTIFICATION_TYPES.REMINDER_3_DAYS:
    case NOTIFICATION_TYPES.REMINDER_1_DAY:
      return 'Jadwal Pemeliharaan Mendatang'
    case NOTIFICATION_TYPES.DUE_TODAY:
      return 'Pemeliharaan Jatuh Tempo Hari Ini'
    case NOTIFICATION_TYPES.OVERDUE:
      return 'Pemeliharaan Terlambat'
    default:
      return 'Notifikasi'
  }
}

/**
 * Build the notification message based on maintenance type, asset, and notification type.
 * @param maintenanceTypeName - Name of the maintenance type
 * @param assetCode - Asset code
 * @param assetName - Asset name
 * @param type - Notification type
 * @param daysLate - Number of days overdue (for OVERDUE type)
 * @returns The message string
 */
function buildNotificationMessage(
  maintenanceTypeName: string,
  assetCode: string,
  assetName: string,
  type: string,
  daysLate = 0
): string {
  const assetLabel = `${assetCode} - ${assetName}`
  const maintenanceLabel = maintenanceTypeName

  switch (type) {
    case NOTIFICATION_TYPES.REMINDER_7_DAYS:
      return `${maintenanceLabel} untuk ${assetLabel} akan jatuh tempo dalam 7 hari.`
    case NOTIFICATION_TYPES.REMINDER_3_DAYS:
      return `${maintenanceLabel} untuk ${assetLabel} akan jatuh tempo dalam 3 hari.`
    case NOTIFICATION_TYPES.REMINDER_1_DAY:
      return `${maintenanceLabel} untuk ${assetLabel} akan jatuh tempo besok.`
    case NOTIFICATION_TYPES.DUE_TODAY:
      return `${maintenanceLabel} untuk ${assetLabel} harus dilaksanakan hari ini.`
    case NOTIFICATION_TYPES.OVERDUE:
      return `${maintenanceLabel} untuk ${assetLabel} telah terlambat ${daysLate} hari.`
    default:
      return `${maintenanceLabel} untuk ${assetLabel}.`
  }
}

/**
 * Determine the notification type based on days difference.
 * @param daysDiff - Days difference between next_maintenance_date and today
 * @returns Object with notificationType and daysLate, or null if no notification needed
 */
function getNotificationType(daysDiff: number): { type: string; daysLate: number } | null {
  if (daysDiff === 7) {
    return { type: NOTIFICATION_TYPES.REMINDER_7_DAYS, daysLate: 0 }
  } else if (daysDiff === 3) {
    return { type: NOTIFICATION_TYPES.REMINDER_3_DAYS, daysLate: 0 }
  } else if (daysDiff === 1) {
    return { type: NOTIFICATION_TYPES.REMINDER_1_DAY, daysLate: 0 }
  } else if (daysDiff === 0) {
    return { type: NOTIFICATION_TYPES.DUE_TODAY, daysLate: 0 }
  } else if (daysDiff < 0) {
    return { type: NOTIFICATION_TYPES.OVERDUE, daysLate: Math.abs(daysDiff) }
  }
  return null
}

// ============================================================
// Main Function
// ============================================================

Deno.serve(async (req: Request) => {
  const startTime = Date.now()

  // Log the incoming request
  console.log('[send-morning-notifications] Function invoked at', new Date().toISOString())

  try {
    // ----------------------------------------------------------
    // 1. Initialize Supabase Admin Client (service role)
    // ----------------------------------------------------------
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      const errorMsg = 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable is not set'
      console.error('[send-morning-notifications]', errorMsg)
      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // ----------------------------------------------------------
    // 2. Get today's date
    // ----------------------------------------------------------
    const today = getTodayDate()
    console.log('[send-morning-notifications] Processing for date:', today)

    // ----------------------------------------------------------
    // 3. Fetch active maintenance schedules with assets and types
    // ----------------------------------------------------------
    const { data: schedules, error: schedError } = await supabase
      .from('maintenance_schedules')
      .select(`
        id,
        asset_id,
        maintenance_type_id,
        next_maintenance_date,
        is_active,
        responsible_user_id,
        asset:assets!inner(id, asset_code, asset_name, is_active),
        maintenance_type:maintenance_types!inner(id, maintenance_code, maintenance_name)
      `)
      .eq('is_active', true)
      .eq('asset.is_active', true)

    if (schedError) {
      throw new Error(`Failed to fetch maintenance schedules: ${schedError.message}`)
    }

    const activeSchedules = schedules || []
    console.log(`[send-morning-notifications] Found ${activeSchedules.length} active schedules`)

    if (activeSchedules.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No active maintenance schedules found',
          summary: {
            date: today,
            schedulesChecked: 0,
            notificationsCreated: 0,
            pushNotificationsSent: 0,
            eligibleUsers: 0,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ----------------------------------------------------------
    // 4. Fetch active users with eligible roles
    // ----------------------------------------------------------
    const { data: users, error: userError } = await supabase
      .from('user_profiles')
      .select(`
        id,
        auth_user_id,
        account_status,
        role:roles!inner(id, role_name)
      `)
      .eq('account_status', 'ACTIVE')
      .in('role.role_name', ELIGIBLE_ROLES)

    if (userError) {
      throw new Error(`Failed to fetch eligible users: ${userError.message}`)
    }

    const eligibleUsers = users || []
    console.log(`[send-morning-notifications] Found ${eligibleUsers.length} eligible users`)

    // ----------------------------------------------------------
    // 5. Calculate notifications to create
    // ----------------------------------------------------------
    const notificationsToCreate: any[] = []
    const scheduleStats = {
      reminder7: 0,
      reminder3: 0,
      reminder1: 0,
      dueToday: 0,
      overdue: 0,
      skipped: 0,
    }

    for (const schedule of activeSchedules) {
      const daysDiff = getDayDiff(schedule.next_maintenance_date, today)
      const notificationInfo = getNotificationType(daysDiff)

      if (!notificationInfo) {
        scheduleStats.skipped++
        continue
      }

      const { type: notificationType, daysLate } = notificationInfo

      // Update stats
      switch (notificationType) {
        case NOTIFICATION_TYPES.REMINDER_7_DAYS:
          scheduleStats.reminder7++
          break
        case NOTIFICATION_TYPES.REMINDER_3_DAYS:
          scheduleStats.reminder3++
          break
        case NOTIFICATION_TYPES.REMINDER_1_DAY:
          scheduleStats.reminder1++
          break
        case NOTIFICATION_TYPES.DUE_TODAY:
          scheduleStats.dueToday++
          break
        case NOTIFICATION_TYPES.OVERDUE:
          scheduleStats.overdue++
          break
      }

      // Build notification title and message
      const title = buildNotificationTitle(notificationType)
      const message = buildNotificationMessage(
        schedule.maintenance_type?.maintenance_name || '-',
        schedule.asset?.asset_code || '-',
        schedule.asset?.asset_name || '-',
        notificationType,
        daysLate
      )

      // Determine recipients
      const recipientUserIds = new Set<string>()

      // All users with eligible roles
      for (const user of eligibleUsers) {
        if (user.auth_user_id) {
          recipientUserIds.add(user.auth_user_id)
        }
      }

      // Add responsible user if specified
      if (schedule.responsible_user_id) {
        recipientUserIds.add(schedule.responsible_user_id)
      }

      // Create notification for each recipient
      for (const userId of recipientUserIds) {
        notificationsToCreate.push({
          user_id: userId,
          maintenance_schedule_id: schedule.id,
          notification_type: notificationType,
          title,
          message,
          notification_date: today,
          reference_url: `/maintenance/schedules/${schedule.id}`,
          is_sent: false,
          sent_at: null,
        })
      }
    }

    console.log('[send-morning-notifications] Notifications to create:', notificationsToCreate.length)

    // ----------------------------------------------------------
    // 6. Insert notifications (upsert to prevent duplicates)
    // ----------------------------------------------------------
    let insertedCount = 0
    if (notificationsToCreate.length > 0) {
      const { data: insertedData, error: insertError } = await supabase
        .from('notifications')
        .upsert(notificationsToCreate, {
          onConflict: 'user_id,maintenance_schedule_id,notification_type,notification_date',
        })
        .select()

      if (insertError) {
        throw new Error(`Failed to insert notifications: ${insertError.message}`)
      }

      insertedCount = insertedData?.length || notificationsToCreate.length
      console.log(`[send-morning-notifications] Inserted ${insertedCount} notifications`)
    }

    // ----------------------------------------------------------
    // 7. Send push notifications to subscribed users
    // ----------------------------------------------------------
    let pushSentCount = 0
    let pushErrorCount = 0

    if (insertedCount > 0) {
      try {
        // Fetch push subscriptions for users who received new notifications
        const recipientUserIds = [...new Set(notificationsToCreate.map(n => n.user_id))]

        const { data: pushSubs, error: pushError } = await supabase
          .from('push_subscriptions')
          .select('user_id, subscription')
          .in('user_id', recipientUserIds)

        if (pushError) {
          console.warn('[send-morning-notifications] Failed to fetch push subscriptions:', pushError.message)
        } else if (pushSubs && pushSubs.length > 0) {
          console.log(`[send-morning-notifications] Found ${pushSubs.length} push subscriptions`)

          // Initialize web-push
          const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
          const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')

          if (vapidPublicKey && vapidPrivateKey) {
            try {
              // Dynamic import of web-push library
              const webpushModule = await import('https://esm.sh/web-push@3.6.7')
              const webpush = webpushModule.default || webpushModule

              webpush.setVapidDetails(
                'mailto:admin@harmas.com',
                vapidPublicKey,
                vapidPrivateKey
              )

              // Send push notifications
              for (const sub of pushSubs) {
                try {
                  const subscription = sub.subscription
                  if (!subscription || !subscription.endpoint) {
                    console.warn('[send-morning-notifications] Invalid subscription for user:', sub.user_id)
                    continue
                  }

                  // Find the notification for this user
                  const userNotifications = notificationsToCreate.filter(n => n.user_id === sub.user_id)
                  if (userNotifications.length === 0) continue

                  // Send push notification with the first notification's data
                  const notification = userNotifications[0]
                  const pushPayload = JSON.stringify({
                    title: notification.title,
                    body: notification.message,
                    url: notification.reference_url,
                    type: notification.notification_type,
                  })

                  await webpush.sendNotification(subscription, pushPayload)
                  pushSentCount++
                } catch (pushErr: any) {
                  pushErrorCount++
                  console.warn(
                    `[send-morning-notifications] Failed to send push to user ${sub.user_id}:`,
                    pushErr.message || String(pushErr)
                  )
                }
              }

              console.log(`[send-morning-notifications] Push notifications sent: ${pushSentCount}, errors: ${pushErrorCount}`)

              // Update is_sent for notifications where push was sent
              if (pushSentCount > 0) {
                const sentUserIds = pushSubs
                  .filter((_, i) => i < pushSentCount)
                  .map(s => s.user_id)

                const { error: updateError } = await supabase
                  .from('notifications')
                  .update({ is_sent: true, sent_at: new Date().toISOString() })
                  .in('user_id', sentUserIds)
                  .eq('notification_date', today)

                if (updateError) {
                  console.warn('[send-morning-notifications] Failed to update is_sent:', updateError.message)
                }
              }
            } catch (importErr: any) {
              console.warn('[send-morning-notifications] web-push library not available:', importErr.message || String(importErr))
            }
          } else {
            console.warn('[send-morning-notifications] VAPID keys not set, skipping push notifications')
          }
        }
      } catch (pushErr: any) {
        console.error('[send-morning-notifications] Error in push notification process:', pushErr.message || String(pushErr))
      }
    }

    // ----------------------------------------------------------
    // 8. Return summary
    // ----------------------------------------------------------
    const elapsed = Date.now() - startTime
    const summary = {
      date: today,
      schedulesChecked: activeSchedules.length,
      notificationsCreated: insertedCount,
      pushNotificationsSent: pushSentCount,
      pushNotificationErrors: pushErrorCount,
      eligibleUsers: eligibleUsers.length,
      breakdown: {
        reminder7Days: scheduleStats.reminder7,
        reminder3Days: scheduleStats.reminder3,
        reminder1Day: scheduleStats.reminder1,
        dueToday: scheduleStats.dueToday,
        overdue: scheduleStats.overdue,
        skipped: scheduleStats.skipped,
      },
      elapsedMs: elapsed,
    }

    console.log('[send-morning-notifications] Summary:', JSON.stringify(summary, null, 2))

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Morning notifications processed successfully',
        summary,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('[send-morning-notifications] Error:', error.message || String(error))
    console.error(error.stack)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An unknown error occurred',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
