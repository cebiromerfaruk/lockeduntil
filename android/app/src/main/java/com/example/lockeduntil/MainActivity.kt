package com.example.lockeduntil

import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.Locale

class MainActivity : AppCompatActivity() {
    private val client = OkHttpClient()
    private val baseUrl = "http://10.0.2.2:8080"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val lang = if (Locale.getDefault().language == "tr") "tr" else "en"

        val secretInput = findViewById<EditText>(R.id.secretInput)
        val emailInput = findViewById<EditText>(R.id.emailInput)
        val masterPassInput = findViewById<EditText>(R.id.masterPassInput)
        val viewPassInput = findViewById<EditText>(R.id.viewPassInput)
        val dateInput = findViewById<EditText>(R.id.dateInput)
        val storeButton = findViewById<Button>(R.id.storeButton)
        val storeResult = findViewById<TextView>(R.id.storeResult)

        val idInput = findViewById<EditText>(R.id.idInput)
        val passInput = findViewById<EditText>(R.id.passInput)
        val retrieveButton = findViewById<Button>(R.id.retrieveButton)
        val retrieveResult = findViewById<TextView>(R.id.retrieveResult)

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

        retrieveButton.setOnClickListener {
            val json = JSONObject().apply {
                put("passphrase", passInput.text.toString())
                put("lang", lang)
            }
            val id = idInput.text.toString()
            val reqBody = json.toString().toRequestBody(JSON)
            val request = Request.Builder().url("$baseUrl/api/get/$id").post(reqBody).build()
            client.newCall(request).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    runOnUiThread { retrieveResult.text = e.message }
                }
                override fun onResponse(call: Call, response: Response) {
                    val body = response.body?.string() ?: ""
                    runOnUiThread { retrieveResult.text = body }
                }
            })
        }
    }

    companion object {
        private val JSON = "application/json; charset=utf-8".toMediaType()
    }
}
