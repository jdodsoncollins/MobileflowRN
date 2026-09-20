const { withPodfile } = require('expo/config-plugins');

/**
 * Xcode 26/27 only support IPHONEOS_DEPLOYMENT_TARGET 15.0 and newer.
 * Some RN pods still ship 13.x resource bundles and fail the build.
 */
module.exports = function withMinIosPodTarget(config) {
  return withPodfile(config, (cfg) => {
    const needle = "config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.0'";
    if (cfg.modResults.contents.includes(needle)) return cfg;
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /react_native_post_install\([\s\S]*?\)\n/,
      (match) =>
        `${match}    installer.pods_project.targets.each do |target|\n      target.build_configurations.each do |config|\n        current = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']\n        if current.nil? || current.to_f < 15.0\n          ${needle}\n        end\n        # Xcode 14+ device builds fail signing CocoaPods resource bundles.\n        if target.respond_to?(:product_type) && target.product_type == 'com.apple.product-type.bundle'\n          config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'\n        end\n      end\n    end\n`,
    );
    return cfg;
  });
};
