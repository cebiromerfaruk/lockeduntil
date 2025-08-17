package com.lockeduntil.app

import android.app.Activity
import java.util.Locale

object LanguageUtils {
    fun toggleLanguage(activity: Activity) {
        val current = Locale.getDefault().language
        val newLocale = if (current == "tr") Locale("en") else Locale("tr")
        Locale.setDefault(newLocale)
        val config = activity.resources.configuration
        config.setLocale(newLocale)
        activity.resources.updateConfiguration(config, activity.resources.displayMetrics)
        activity.recreate()
    }
}
