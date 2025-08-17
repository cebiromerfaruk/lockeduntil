package com.lockeduntil.app

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.ImageButton
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val storeButton = findViewById<Button>(R.id.storeActivityButton)
        val retrieveButton = findViewById<Button>(R.id.retrieveActivityButton)
        val useCasesButton = findViewById<Button>(R.id.useCasesButton)
        val settingsButton = findViewById<ImageButton>(R.id.settingsButton)

        storeButton.setOnClickListener {
            startActivity(Intent(this, StoreActivity::class.java))
        }

        retrieveButton.setOnClickListener {
            startActivity(Intent(this, RetrieveActivity::class.java))
        }

        useCasesButton.setOnClickListener {
            startActivity(Intent(this, UseCasesActivity::class.java))
        }

        settingsButton.setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }
    }
}
