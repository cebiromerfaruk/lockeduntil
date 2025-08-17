package com.lockeduntil.app

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_home)

        findViewById<Button>(R.id.btnStore).setOnClickListener {
            startActivity(Intent(this, StoreActivity::class.java))
        }
        findViewById<Button>(R.id.btnRetrieve).setOnClickListener {
            startActivity(Intent(this, RetrieveActivity::class.java))
        }
        findViewById<Button>(R.id.btnWhyTrust).setOnClickListener {
            startActivity(Intent(this, WhyTrustActivity::class.java))
        }
        findViewById<Button>(R.id.btnUseCases).setOnClickListener {
            startActivity(Intent(this, UseCasesActivity::class.java))
        }
    }
}
