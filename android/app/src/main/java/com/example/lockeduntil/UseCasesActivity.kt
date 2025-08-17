package com.lockeduntil.app

import android.os.Bundle
import android.content.Intent
import android.widget.Button
import android.widget.ImageButton
import androidx.appcompat.app.AppCompatActivity

class UseCasesActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_use_cases)

        val homeButton = findViewById<Button>(R.id.homeButton)
        val settingsButton = findViewById<ImageButton>(R.id.settingsButton)

        homeButton.setOnClickListener { finish() }
        settingsButton.setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }
    }
}
