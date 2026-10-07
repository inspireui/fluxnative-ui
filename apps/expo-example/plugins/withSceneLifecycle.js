// iOS 27 asserts at launch unless the app adopts the UIScene life cycle
// (`_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`). Expo
// SDK 57 ships `ExpoAppSceneDelegate` but its AppDelegate template still
// creates the window itself, so a build with the iOS 27 SDK (Xcode 27)
// crashes on launch. This plugin switches the generated app to the scene
// delegate. Drop it once the Expo template adopts scenes (SDK 58).
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const START_IN_APP_DELEGATE = /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)[\s\S]*?#endif\n/;

function withSceneDelegateAppDelegate(config) {
  return withAppDelegate(config, (mod) => {
    if (mod.modResults.language !== 'swift') {
      throw new Error('withSceneLifecycle expects a Swift AppDelegate');
    }
    let src = mod.modResults.contents;
    if (!src.includes('ExpoReactNativeFactoryProvider')) {
      src = src.replace(
        'class AppDelegate: ExpoAppDelegate {',
        'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {\n  var reactNativeFactoryModuleName: String { "main" }\n',
      );
    }
    // The scene delegate creates the window and starts React Native into it.
    src = src.replace(START_IN_APP_DELEGATE, '\n');
    if (!src.includes('ExpoReactNativeFactoryProvider') || src.includes('UIWindow(frame: UIScreen.main.bounds)')) {
      throw new Error('withSceneLifecycle: the AppDelegate template changed; update the plugin');
    }
    mod.modResults.contents = src;
    return mod;
  });
}

function withSceneManifest(config) {
  return withInfoPlist(config, (mod) => {
    mod.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
          },
        ],
      },
    };
    return mod;
  });
}

module.exports = function withSceneLifecycle(config) {
  return withSceneManifest(withSceneDelegateAppDelegate(config));
};
