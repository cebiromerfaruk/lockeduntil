package com.lockeduntil.app

import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
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

        val secretInput = findViewById<EditText>(R.id.secretInput)
        val emailInput = findViewById<EditText>(R.id.emailInput)
        val masterPassInput = findViewById<EditText>(R.id.masterPassInput)
        val viewPassInput = findViewById<EditText>(R.id.viewPassInput)
        val dateInput = findViewById<EditText>(R.id.dateInput)
        val storeButton = findViewById<Button>(R.id.storeButton)
        val storeResult = findViewById<TextView>(R.id.storeResult)
        val homeButton = findViewById<Button>(R.id.homeButton)

        homeButton.setOnClickListener { finish() }

        storeButton.setOnClickListener {
            val json = JSONObject().apply {
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
