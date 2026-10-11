package com.focusflip.app.data.apps

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Package names the user may open while the phone is locked. */
class WhitelistStore(context: Context) {

    private val prefs = context.getSharedPreferences("focusflip_whitelist", Context.MODE_PRIVATE)
    private val _packages = MutableStateFlow(prefs.getStringSet(KEY, emptySet())!!.toSet())
    val packages: StateFlow<Set<String>> = _packages.asStateFlow()

    fun set(packageName: String, allowed: Boolean) {
        val next = if (allowed) _packages.value + packageName else _packages.value - packageName
        prefs.edit().putStringSet(KEY, next).apply()
        _packages.value = next
    }

    fun contains(packageName: String) = packageName in _packages.value

    private companion object {
        const val KEY = "packages"
    }
}
