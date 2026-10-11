package com.focusflip.app.focus

import android.app.Activity
import android.app.ActivityManager
import android.app.admin.DeviceAdminReceiver
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import com.focusflip.app.di.ServiceLocator

class FocusDeviceAdminReceiver : DeviceAdminReceiver()

/**
 * Optional hard lock. If FocusFlip is provisioned as device owner
 * (adb shell dpm set-device-owner com.focusflip.app/.focus.FocusDeviceAdminReceiver),
 * focus blocks use Android lock task mode: home, recents and the status bar are disabled
 * by the OS itself and only FocusFlip + whitelisted apps can run.
 * Without device owner, the accessibility guard is used instead.
 */
object KioskMode {

    fun isDeviceOwner(context: Context): Boolean =
        context.getSystemService(DevicePolicyManager::class.java).isDeviceOwnerApp(context.packageName)

    fun enter(activity: Activity) {
        if (!isDeviceOwner(activity)) return
        val dpm = activity.getSystemService(DevicePolicyManager::class.java)
        val admin = ComponentName(activity, FocusDeviceAdminReceiver::class.java)
        val allowed = setOf(activity.packageName) + ServiceLocator.whitelistStore.packages.value
        dpm.setLockTaskPackages(admin, allowed.toTypedArray())
        if (!isInLockTask(activity)) runCatching { activity.startLockTask() }
    }

    fun exit(activity: Activity) {
        if (isInLockTask(activity)) runCatching { activity.stopLockTask() }
    }

    /** Developer helper: gives up device owner so the app can be uninstalled normally. */
    fun releaseDeviceOwner(context: Context) {
        if (!isDeviceOwner(context)) return
        @Suppress("DEPRECATION")
        context.getSystemService(DevicePolicyManager::class.java).clearDeviceOwnerApp(context.packageName)
    }

    private fun isInLockTask(context: Context): Boolean =
        context.getSystemService(ActivityManager::class.java).lockTaskModeState !=
            ActivityManager.LOCK_TASK_MODE_NONE
}
