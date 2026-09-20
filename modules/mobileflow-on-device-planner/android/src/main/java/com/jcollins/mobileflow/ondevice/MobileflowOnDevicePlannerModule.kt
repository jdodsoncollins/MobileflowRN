package com.jcollins.mobileflow.ondevice

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Android on-device planner powered by Gemini Nano via ML Kit GenAI Prompt API / AICore.
 *
 * Device fragmentation is expected:
 * - tier none: AICore / Nano not present → heuristic only (UI hidden)
 * - tier geminiNano: standard on-device Nano
 * - tier geminiNanoHigh: higher-capability devices (more context / better model variant when API reports it)
 *
 * Never invents Webflow IDs; JS still grounds via PlannedCommandParser.
 */
class MobileflowOnDevicePlannerModule : Module() {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  override fun definition() = ModuleDefinition {
    Name("MobileflowOnDevicePlanner")

    AsyncFunction("getCapability") { promise: Promise ->
      scope.launch {
        try {
          promise.resolve(GeminiNanoBackend.getCapability())
        } catch (e: Exception) {
          promise.resolve(
            mapOf(
              "available" to false,
              "tier" to "none",
              "platform" to "android",
              "modelLabel" to null,
              "maxContextTokens" to 0,
              "detail" to (e.message ?: "Gemini Nano probe failed"),
            ),
          )
        }
      }
    }

    AsyncFunction("isAvailable") { promise: Promise ->
      scope.launch {
        try {
          promise.resolve(GeminiNanoBackend.isAvailable())
        } catch (_: Exception) {
          promise.resolve(false)
        }
      }
    }

    AsyncFunction("planCommandLines") { prompt: String, contextJSON: String, promise: Promise ->
      scope.launch {
        try {
          if (!GeminiNanoBackend.isAvailable()) {
            promise.resolve(null)
            return@launch
          }
          val lines = GeminiNanoBackend.planCommandLines(prompt, contextJSON)
          promise.resolve(lines)
        } catch (_: Exception) {
          promise.resolve(null)
        }
      }
    }
  }
}
