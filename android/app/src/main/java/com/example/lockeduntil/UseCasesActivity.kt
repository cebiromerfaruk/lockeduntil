package com.lockeduntil.app

import android.os.Bundle
import android.widget.Button
import androidx.appcompat.app.AppCompatActivity
import com.lockeduntil.app.LanguageUtils

class UseCasesActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_use_cases)

        val homeButton = findViewById<Button>(R.id.homeButton)
        val languageButton = findViewById<Button>(R.id.languageToggleButton)

        homeButton.setOnClickListener { finish() }
        languageButton.setOnClickListener { LanguageUtils.toggleLanguage(this) }
    }
}
