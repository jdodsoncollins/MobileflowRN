Pod::Spec.new do |s|
  s.name           = 'MobileflowOnDevicePlanner'
  s.version        = '0.1.0'
  s.summary        = 'On-device Command planner (Apple Intelligence / Foundation Models)'
  s.description    = 'Expo module bridging SystemLanguageModel for Mobileflow planning'
  s.license        = 'MIT'
  s.author         = 'Mobileflow'
  s.homepage       = 'https://github.com/jdodsoncollins/MobileflowRN'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
  s.frameworks = 'Foundation'
end
