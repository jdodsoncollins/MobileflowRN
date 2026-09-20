const {
  withAppDelegate,
  withInfoPlist,
  withXcodeProject,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SCENE_DELEGATE = `import Expo
import React
import UIKit

/// Building with the iOS 26+/27 SDK requires a UIScene lifecycle or the process is killed at launch.
@objc(SceneDelegate)
public class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  public var window: UIWindow?

  public func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else { return }
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window
    window.makeKeyAndVisible()

    func start() {
      appDelegate.reactNativeFactory?.startReactNative(
        withModuleName: "main",
        in: window,
        launchOptions: nil
      )
    }
#if DEBUG
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4, execute: start)
#else
    start()
#endif
  }

  public func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let url = URLContexts.first?.url else { return }
    _ = RCTLinkingManager.application(UIApplication.shared, open: url, options: [:])
  }

  public func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = RCTLinkingManager.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in }
    )
  }
}
`;

module.exports = function withIosSceneLifecycle(config) {
  config = withInfoPlist(config, (cfg) => {
    delete cfg.modResults.UIRequiresFullScreen;
    delete cfg.modResults.NSFaceIDUsageDescription;
    cfg.modResults.NSLocalNetworkUsageDescription =
      cfg.modResults.NSLocalNetworkUsageDescription ||
      'Mobileflow uses the local network to load the Metro bundler while developing.';
    const bonjour = new Set(
      []
        .concat(cfg.modResults.NSBonjourServices || [])
        .concat(['_metro._tcp', '_expo._tcp', '_packager._tcp']),
    );
    cfg.modResults.NSBonjourServices = [...bonjour];
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: 'SceneDelegate',
          },
        ],
      },
    };
    return cfg;
  });

  config = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projectName = cfg.modRequest.projectName ?? 'Mobileflow';
      const dest = path.join(
        cfg.modRequest.platformProjectRoot,
        projectName,
        'SceneDelegate.swift',
      );
      fs.writeFileSync(dest, SCENE_DELEGATE);
      return cfg;
    },
  ]);

  config = withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') return cfg;
    let contents = cfg.modResults.contents;

    contents = contents.replace(
      /#if os\(iOS\) \|\| os\(tvOS\)[\s\S]*?#endif\n/,
      '// Window + React Native start in SceneDelegate (iOS 26+/27 UIScene requirement).\n',
    );

    if (!contents.includes('configurationForConnecting')) {
      contents = contents.replace(
        /return super\.application\(application, didFinishLaunchingWithOptions: launchOptions\)\n  \}/,
        `return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  public func application(
    _ application: UIApplication,
    configurationForConnecting connectingSceneSession: UISceneSession,
    options: UIScene.ConnectionOptions
  ) -> UISceneConfiguration {
    let configuration = UISceneConfiguration(
      name: "Default Configuration",
      sessionRole: connectingSceneSession.role
    )
    configuration.delegateClass = SceneDelegate.self
    return configuration
  }`,
      );
    }

    if (contents.includes('jsBundleURL(forBundleRoot:') && !contents.includes('jsLocation = "localhost:8081"')) {
      contents = contents.replace(
        /override func bundleURL\(\) -> URL\? \{[\s\S]*?#if DEBUG\n    return RCTBundleURLProvider\.sharedSettings\(\)\.jsBundleURL\(forBundleRoot: "\.expo\/\.virtual-metro-entry"\)\n#else/,
        `override func bundleURL() -> URL? {
#if DEBUG
    let provider = RCTBundleURLProvider.sharedSettings()
    if provider.jsLocation == nil || provider.jsLocation?.isEmpty == true {
      provider.jsLocation = "localhost:8081"
    }
    return provider.jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else`,
      );
    }

    cfg.modResults.contents = contents;
    return cfg;
  });

  config = withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const projectName = cfg.modRequest.projectName ?? 'Mobileflow';
    const filePath = `${projectName}/SceneDelegate.swift`;
    if (!project.hasFile(filePath)) {
      project.addSourceFile(filePath, null, project.findPBXGroupKey({ name: projectName }));
    }
    return cfg;
  });

  return config;
};
