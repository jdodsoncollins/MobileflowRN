import ExpoModulesCore
import Foundation

#if canImport(FoundationModels)
import FoundationModels
#endif

/**
 * On-device planner for iOS.
 * Uses Apple Intelligence / Foundation Models (SystemLanguageModel) when available
 * (iOS 26+ with Apple Intelligence support). Older devices report unavailable.
 */
public class MobileflowOnDevicePlannerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MobileflowOnDevicePlanner")

    AsyncFunction("getCapability") { () -> [String: Any] in
      return self.capabilityDict()
    }

    AsyncFunction("isAvailable") { () -> Bool in
      return self.isModelAvailable()
    }

    AsyncFunction("planCommandLines") { (prompt: String, contextJSON: String) -> String? in
      return await self.generateCommandLines(prompt: prompt, contextJSON: contextJSON)
    }
  }

  private func isModelAvailable() -> Bool {
    #if canImport(FoundationModels)
    if #available(iOS 26.0, *) {
      switch SystemLanguageModel.default.availability {
      case .available:
        return true
      default:
        return false
      }
    }
    #endif
    return false
  }

  private func capabilityDict() -> [String: Any] {
    let available = isModelAvailable()
    #if canImport(FoundationModels)
    if #available(iOS 26.0, *), available {
      return [
        "available": true,
        "tier": "appleIntelligence",
        "platform": "ios",
        "modelLabel": "Apple Intelligence (SystemLanguageModel)",
        "maxContextTokens": 4096,
        "detail": "Foundation Models available. Plans use loaded page/collection IDs only.",
      ]
    }
    #endif
    return [
      "available": false,
      "tier": "none",
      "platform": "ios",
      "modelLabel": NSNull(),
      "maxContextTokens": 0,
      "detail": "Apple Intelligence / Foundation Models not available on this device or OS. Heuristic planner only.",
    ]
  }

  private func generateCommandLines(prompt: String, contextJSON: String) async -> String? {
    #if canImport(FoundationModels)
    if #available(iOS 26.0, *) {
      guard isModelAvailable() else { return nil }
      do {
        let instructions = Self.buildInstructions(contextJSON: contextJSON)
        let session = LanguageModelSession(instructions: instructions)
        let user = """
        User request: \(prompt)

        Respond ONLY with Mobileflow command lines (one step per line). No prose.
        Allowed heads: PUBLISH_SITE | PUBLISH_PAGE <pageId> | SEO_FIX <pageId> | CMS_DRAFT <collectionId> | READ_SUMMARY | UPLOAD_ASSET
        Use only IDs listed in the system instructions. Prefer 1–4 lines.
        """
        let response = try await session.respond(to: user)
        let text = String(describing: response.content)
        let lines = text
          .split(whereSeparator: \.isNewline)
          .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
          .filter { !$0.isEmpty }
          .filter { line in
            let head = line.split(separator: " ").first.map { String($0).uppercased() } ?? ""
            return [
              "PUBLISH_SITE", "PUBLISH_PAGE", "SEO_FIX", "CMS_DRAFT",
              "READ_SUMMARY", "UPLOAD_ASSET",
            ].contains(head)
          }
        if lines.isEmpty { return nil }
        return lines.joined(separator: "\n")
      } catch {
        return nil
      }
    }
    #endif
    return nil
  }

  private static func buildInstructions(contextJSON: String) -> String {
    // contextJSON is produced by JS; pass through for grounding.
    return """
    You are Mobileflow, a phone-native Webflow control plane planner.
    Output only command lines for a reviewable plan. Never invent page or collection IDs.
    Prefer reversible drafts over publish. Prefer 1–4 steps.

    Context JSON (loaded IDs only — never invent others):
    \(contextJSON)

    Command grammar:
    - PUBLISH_SITE
    - PUBLISH_PAGE <pageId>
    - SEO_FIX <pageId>
    - CMS_DRAFT <collectionId>
    - READ_SUMMARY
    - UPLOAD_ASSET
    """
  }
}
