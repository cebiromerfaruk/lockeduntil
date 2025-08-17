package com.lockeduntil.app

import android.app.DatePickerDialog
import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.ImageButton
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import java.util.Calendar
import java.util.Locale
import org.json.JSONObject
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException

class StoreActivity : AppCompatActivity() {
    private val client = OkHttpClient()
    private val baseUrl = "http://10.0.2.2:8080"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_store)

        val lang = if (Locale.getDefault().language == "tr") "tr" else "en"

        val titleInput = findViewById<EditText>(R.id.titleInput)
        val secretInput = findViewById<EditText>(R.id.secretInput)
        val emailInput = findViewById<EditText>(R.id.emailInput)
        val masterPassInput = findViewById<EditText>(R.id.masterPassInput)
        val viewPassInput = findViewById<EditText>(R.id.viewPassInput)
        val dateInput = findViewById<EditText>(R.id.dateInput)
        val storeButton = findViewById<Button>(R.id.storeButton)
        val storeResult = findViewById<TextView>(R.id.storeResult)
        val homeButton = findViewById<Button>(R.id.homeButton)
        val settingsButton = findViewById<ImageButton>(R.id.settingsButton)

        homeButton.setOnClickListener { finish() }
        settingsButton.setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }

        dateInput.setOnClickListener {
            val calendar = Calendar.getInstance()
            DatePickerDialog(
                this,
                { _, year, month, dayOfMonth ->
                    val m = (month + 1).toString().padStart(2, '0')
                    val d = dayOfMonth.toString().padStart(2, '0')
                    dateInput.setText("$year-$m-$d")
                },
                calendar.get(Calendar.YEAR),
                calendar.get(Calendar.MONTH),
                calendar.get(Calendar.DAY_OF_MONTH)
            ).show()
        }

        storeButton.setOnClickListener {
            val json = JSONObject().apply {
                put("title", titleInput.text.toString())
                put("secret", secretInput.text.toString())
                put("email", emailInput.text.toString())
                put("masterPass", masterPassInput.text.toString())
                put("viewPass", viewPassInput.text.toString())
                put("lang", lang)
                val d = dateInput.text.toString()
                if (d.isNotEmpty()) put("unlockDate", d)
            }
            val reqBody = json.toString().toRequestBody(JSON)
            val request = Request.Builder().url("$baseUrl/api/store").post(reqBody).build()
            client.newCall(request).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    runOnUiThread { storeResult.text = e.message }
                }
                override fun onResponse(call: Call, response: Response) {
                    val body = response.body?.string() ?: ""
                    runOnUiThread { storeResult.text = body }
                }
            })
        }
    }

    companion object {
        private val JSON = "application/json; charset=utf-8".toMediaType()
    }
}
