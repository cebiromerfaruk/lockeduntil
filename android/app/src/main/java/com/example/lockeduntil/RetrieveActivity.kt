package com.lockeduntil.app

import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import java.util.Locale
import com.lockeduntil.app.LanguageUtils
import org.json.JSONObject
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException

class RetrieveActivity : AppCompatActivity() {
    private val client = OkHttpClient()
    private val baseUrl = "http://10.0.2.2:8080"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_retrieve)

        val lang = if (Locale.getDefault().language == "tr") "tr" else "en"

        val idInput = findViewById<EditText>(R.id.idInput)
        val passInput = findViewById<EditText>(R.id.passInput)
        val retrieveButton = findViewById<Button>(R.id.retrieveButton)
        val retrieveResult = findViewById<TextView>(R.id.retrieveResult)
        val homeButton = findViewById<Button>(R.id.homeButton)
        val languageButton = findViewById<Button>(R.id.languageToggleButton)

        homeButton.setOnClickListener { finish() }
        languageButton.setOnClickListener { LanguageUtils.toggleLanguage(this) }

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
