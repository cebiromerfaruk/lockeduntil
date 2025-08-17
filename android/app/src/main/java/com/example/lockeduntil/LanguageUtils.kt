package com.lockeduntil.app

import android.app.Activity
import java.util.Locale

object LanguageUtils {
    fun setLanguage(activity: Activity, lang: String) {
        val newLocale = Locale(lang)
        Locale.setDefault(newLocale)
        val config = activity.resources.configuration
        config.setLocale(newLocale)
        activity.resources.updateConfiguration(config, activity.resources.displayMetrics)
        activity.applicationContext.resources.updateConfiguration(config, activity.resources.displayMetrics)
    }
}
