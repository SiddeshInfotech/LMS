{
  "targets": [
    {
      "target_name": "recorder_detect",
      "sources": [ "src/native/recorder_detect.cpp" ],
      "include_dirs": [
        "node_modules/node-addon-api"
      ],
      "dependencies": [
        "node_modules/node-addon-api/node_addon_api.gyp:node_addon_api"
      ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
      "msvs_settings": {
        "VCCLCompilerTool": { "ExceptionHandling": 1 }
      }
    }
  ]
}
