package com.lockeduntil.app

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.Spinner
import androidx.appcompat.app.AppCompatActivity
import java.util.Locale
import com.lockeduntil.app.LanguageUtils

class SettingsActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        val homeButton = findViewById<Button>(R.id.homeButton)
        val spinner = findViewById<Spinner>(R.id.languageSpinner)

        homeButton.setOnClickListener { finish() }

        val adapter = ArrayAdapter.createFromResource(
            this,
            R.array.language_names,
            android.R.layout.simple_spinner_item
        )
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        spinner.adapter = adapter

        val currentIndex = if (Locale.getDefault().language == "tr") 1 else 0
        spinner.setSelection(currentIndex)

        var first = true
        spinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>, view: View?, position: Int, id: Long) {
                if (first) { first = false; return }
                val lang = if (position == 1) "tr" else "en"
                LanguageUtils.setLanguage(lang, this@SettingsActivity)
                startActivity(Intent(this@SettingsActivity, MainActivity::class.java))
                finish()
            }
            override fun onNothingSelected(parent: AdapterView<*>) {}
        }
    }
}
