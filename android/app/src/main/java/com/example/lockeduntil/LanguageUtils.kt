package com.lockeduntil.app

import android.app.Activity
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat

object LanguageUtils {
    fun setLanguage(lang: String, recreateActivity: Activity? = null) {
        val locales = LocaleListCompat.forLanguageTags(lang) // "tr", "en-US"...
        AppCompatDelegate.setApplicationLocales(locales)
        recreateActivity?.recreate()
    }
}
