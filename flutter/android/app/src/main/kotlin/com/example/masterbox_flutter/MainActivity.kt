package com.example.masterbox_flutter

import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // The backend sends customer messages on this channel, so they can be
        // muted or kept separately in the phone's settings.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "messages",
                "客戶訊息",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply { description = "客戶在社群平台傳來的訊息" }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }
}
