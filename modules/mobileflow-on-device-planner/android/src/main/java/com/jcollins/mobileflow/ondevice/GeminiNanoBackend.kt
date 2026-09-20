package com.jcollins.mobileflow.ondevice

import android.os.Build
import java.util.concurrent.atomic.AtomicReference

/**
 * Thin adapter over ML Kit GenAI Prompt API (Gemini Nano).
 * Uses reflection so unit/export environments without the GenAI classes still compile;
 * at runtime on a real device with the dependency linked, real Nano is used.
 *
 * Tiers allow fragmentation: more capable devices report geminiNanoHigh.
 */
object GeminiNanoBackend {
  private val cachedTier = AtomicReference<String?>(null)

  fun isAvailable(): Boolean {
    val cap = getCapability()
    return cap["available"] == true
  }

  fun getCapability(): Map<String, Any?> {
    val probe = probeRuntime()
    return mapOf(
      "available" to probe.available,
      "tier" to probe.tier,
      "platform" to "android",
      "modelLabel" to probe.modelLabel,
      "maxContextTokens" to probe.maxContextTokens,
      "detail" to probe.detail,
    )
  }

  fun planCommandLines(prompt: String, contextJSON: String): String? {
    if (!isAvailable()) return null
    return generateWithPromptApi(prompt, contextJSON)
  }

  private data class Probe(
    val available: Boolean,
    val tier: String,
    val modelLabel: String?,
    val maxContextTokens: Int,
    val detail: String,
  )

  private fun probeRuntime(): Probe {
    cachedTier.get()?.let { tier ->
      if (tier == "none") {
        return Probe(
          false,
          "none",
          null,
          0,
          "Gemini Nano / AICore not available on this device.",
        )
      }
    }

    // Require a modern enough OS; AICore is device-fragmented beyond API level.
    if (Build.VERSION.SDK_INT < 31) {
      return Probe(
        false,
        "none",
        null,
        0,
        "Android 12+ required for on-device Gemini Nano class models.",
      )
    }

    return try {
      // Reflect ML Kit GenAI Prompt so missing classes don't crash class load.
      val statusClass = Class.forName("com.google.mlkit.genai.prompt.GenAiPrompt")
      // Prefer FeatureStatus / getClient if present — API surface evolves in beta.
      val clientMethod = statusClass.methods.firstOrNull { it.name == "getClient" || it.name == "getInstance" }
      val client = clientMethod?.invoke(null)

      val highEnd = isHighCapabilityDevice()
      val tier = if (highEnd) "geminiNanoHigh" else "geminiNano"
      val tokens = if (highEnd) 8192 else 2048
      cachedTier.set(tier)

      Probe(
        available = client != null,
        tier = tier,
        modelLabel = if (highEnd) "Gemini Nano (high-capability device)" else "Gemini Nano",
        maxContextTokens = tokens,
        detail = if (highEnd) {
          "AICore / Gemini Nano path available with expanded context budget for this device class."
        } else {
          "AICore / Gemini Nano path available. Capability varies by OEM and model download state."
        },
      )
    } catch (_: ClassNotFoundException) {
      cachedTier.set("none")
      Probe(
        false,
        "none",
        null,
        0,
        "ML Kit GenAI Prompt classes not on classpath or AICore not installed.",
      )
    } catch (_: Exception) {
      cachedTier.set("none")
      Probe(
        false,
        "none",
        null,
        0,
        "Gemini Nano capability probe failed.",
      )
    }
  }

  /**
   * Heuristic for "more capable" Android devices without hardcoding one OEM.
   * Real quality still depends on AICore model packs; this only adjusts tier metadata
   * and prompt budget hints.
   */
  private fun isHighCapabilityDevice(): Boolean {
    val model = (Build.MODEL ?: "").lowercase()
    val device = (Build.DEVICE ?: "").lowercase()
    val product = (Build.PRODUCT ?: "").lowercase()
    val brand = (Build.BRAND ?: "").lowercase()
    val fingerprint = "$brand $model $device $product"

    // Known higher-tier on-device AI devices / series (fragmentation allowlist, not exclusive).
    val markers = listOf(
      "pixel 9", "pixel 10", "pixel 8 pro", "pixel 9 pro", "pixel 10 pro",
      "pixel fold", "pixel tablet",
      "galaxy s24", "galaxy s25", "galaxy z fold", "galaxy z flip",
      "magic6", "magic7", "magic v",
      "xiaomi 14", "xiaomi 15", "mix fold",
      "oneplus 12", "oneplus 13",
      "sony xperia 1", // when AICore present
    )
    if (markers.any { fingerprint.contains(it) }) return true

    // Newer API + high RAM often correlates with Nano High packs (best-effort).
    if (Build.VERSION.SDK_INT >= 35) {
      val rt = Runtime.getRuntime()
      val maxMb = rt.maxMemory() / (1024 * 1024)
      if (maxMb >= 512) return true
    }
    return false
  }

  private fun generateWithPromptApi(prompt: String, contextJSON: String): String? {
    return try {
      // Attempt Prompt API via reflection for beta API stability.
      // Expected pattern (evolves):
      //   val client = Generation.getClient()
      //   val result = Tasks.await(client.generateContent(request))
      val promptText = buildPrompt(prompt, contextJSON)

      val generationClass = Class.forName("com.google.mlkit.genai.prompt.Generation")
      val getClient = generationClass.methods.firstOrNull {
        it.name == "getClient" && it.parameterCount == 0
      } ?: return generateFallbackStub(promptText)

      val client = getClient.invoke(null) ?: return null

      // Try common generate method names
      val generate = client.javaClass.methods.firstOrNull { m ->
        (m.name == "generateContent" || m.name == "generate" || m.name == "run") &&
          m.parameterCount in 1..2
      } ?: return generateFallbackStub(promptText)

      val result = if (generate.parameterCount == 1) {
        generate.invoke(client, promptText)
      } else {
        generate.invoke(client, promptText, null)
      }

      extractText(result)?.let { filterCommandLines(it) }
    } catch (_: ClassNotFoundException) {
      null
    } catch (_: Exception) {
      null
    }
  }

  /** When reflection shape mismatches beta SDK, return null so JS uses heuristic. */
  private fun generateFallbackStub(@Suppress("UNUSED_PARAMETER") promptText: String): String? = null

  private fun extractText(result: Any?): String? {
    if (result == null) return null
    if (result is String) return result
    // Tasks.await style wrappers often expose getResult() / getText()
    val cls = result.javaClass
    for (name in listOf("getText", "getResult", "text", "content")) {
      try {
        val m = cls.methods.firstOrNull { it.name == name && it.parameterCount == 0 } ?: continue
        val v = m.invoke(result)
        when (v) {
          is String -> return v
          else -> extractText(v)?.let { return it }
        }
      } catch (_: Exception) {
      }
    }
    return result.toString().takeIf { it.isNotBlank() && !it.startsWith(cls.name) }
  }

  private fun buildPrompt(userPrompt: String, contextJSON: String): String {
    val high = isHighCapabilityDevice()
    val stepBudget = if (high) "1–6" else "1–4"
    return """
      You are Mobileflow, a phone Webflow control plane planner.
      Output ONLY command lines (one per line). No markdown, no explanation.
      Allowed heads: PUBLISH_SITE | PUBLISH_PAGE <pageId> | SEO_FIX <pageId> | CMS_DRAFT <collectionId> | READ_SUMMARY | UPLOAD_ASSET
      Never invent page or collection IDs not present in context JSON.
      Prefer reversible drafts over publish. Prefer $stepBudget steps.

      Context JSON:
      $contextJSON

      User request:
      $userPrompt
    """.trimIndent()
  }

  private fun filterCommandLines(text: String): String? {
    val allowed = setOf(
      "PUBLISH_SITE", "PUBLISH_PAGE", "SEO_FIX", "CMS_DRAFT", "READ_SUMMARY", "UPLOAD_ASSET",
    )
    val lines = text.lineSequence()
      .map { it.trim() }
      .filter { it.isNotEmpty() }
      .filter { line ->
        val head = line.split(Regex("\\s+")).firstOrNull()?.uppercase() ?: ""
        allowed.contains(head)
      }
      .toList()
    return if (lines.isEmpty()) null else lines.joinToString("\n")
  }
}
