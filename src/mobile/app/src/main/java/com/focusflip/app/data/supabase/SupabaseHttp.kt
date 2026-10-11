package com.focusflip.app.data.supabase

import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.ProtocolException
import java.net.URL

/** Thin REST client for the shared Fishtank Supabase project. */
class SupabaseHttp(
    private val supabaseUrl: String,
    private val publishableKey: String,
) {

    fun get(path: String, bearer: String): String = request("GET", path, bearer)

    fun post(path: String, body: JSONObject, bearer: String = publishableKey): JSONObject =
        JSONObject(request("POST", path, bearer, body).ifBlank { "{}" })

    fun patch(path: String, body: JSONObject, bearer: String): JSONArray =
        JSONArray(request("PATCH", path, bearer, body, prefer = "return=representation").ifBlank { "[]" })

    /** Any request, returning the raw body. Throws [SupabaseException] on an error status. */
    fun request(
        method: String,
        path: String,
        bearer: String,
        body: JSONObject? = null,
        prefer: String? = null,
    ): String {
        val connection = URL(supabaseUrl.trimEnd('/') + path).openConnection() as HttpURLConnection
        try {
            try {
                connection.requestMethod = method
            } catch (_: ProtocolException) {
                connection.requestMethod = "POST"
                connection.setRequestProperty("X-HTTP-Method-Override", method)
            }
            connection.connectTimeout = 15_000
            connection.readTimeout = 15_000
            connection.setRequestProperty("apikey", publishableKey)
            connection.setRequestProperty("Authorization", "Bearer $bearer")
            connection.setRequestProperty("Accept", "application/json")
            if (prefer != null) connection.setRequestProperty("Prefer", prefer)
            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.use { it.write(body.toString().toByteArray()) }
            }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (status !in 200..299) {
                val json = runCatching { JSONObject(text) }.getOrNull()
                val message = listOf("msg", "error_description", "message", "hint")
                    .firstNotNullOfOrNull { key -> json?.optString(key)?.takeIf { it.isNotBlank() } }
                val code = json?.optString("code")?.takeIf { it.isNotBlank() }
                throw SupabaseException(status, message ?: "Request failed ($status).", code)
            }
            return text
        } finally {
            connection.disconnect()
        }
    }
}

/** [code] is PostgREST's error code (e.g. PGRST202) when it sent one. */
class SupabaseException(val status: Int, message: String, val code: String? = null) : Exception(message)
