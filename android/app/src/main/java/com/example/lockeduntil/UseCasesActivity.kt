package com.lockeduntil.app

import android.os.Bundle
import android.widget.Button
import androidx.appcompat.app.AppCompatActivity

class UseCasesActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_use_cases)

        val homeButton = findViewById<Button>(R.id.homeButton)
        homeButton.setOnClickListener { finish() }
    }
}
